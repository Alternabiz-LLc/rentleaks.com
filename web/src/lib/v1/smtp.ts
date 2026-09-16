/**
 * A small SMTP client for Cloudflare Workers (TCP sockets).
 *
 * Enough for one message per connection to a normal submission server such as
 * Namecheap Private Email (mail.privateemail.com): implicit TLS on 465 or
 * STARTTLS on 587, AUTH PLAIN/LOGIN, a multipart/alternative body.
 *
 * The socket function comes from `cloudflare:sockets`, which only the Worker
 * entry (worker.ts) can import; it hands it over on globalThis. Tests pass
 * their own.
 */
import { randomBytes } from "crypto";

export type SmtpSocket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void> | void;
  startTls?(): SmtpSocket;
};

export type SocketConnect = (
  address: { hostname: string; port: number },
  options: { secureTransport: "on" | "off" | "starttls"; allowHalfOpen?: boolean },
) => SmtpSocket;

export type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  /** HELO name */
  clientName?: string;
  timeoutMs?: number;
};

export type SmtpMessage = {
  from: { name?: string; email: string };
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};

const CRLF = "\r\n";
const NUL = String.fromCharCode(0);

export function socketConnect(): SocketConnect | null {
  const fn = (globalThis as unknown as { __rlSocketConnect?: SocketConnect }).__rlSocketConnect;
  return typeof fn === "function" ? fn : null;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function wrap76(s: string) {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 76) out.push(s.slice(i, i + 76));
  return out.join(CRLF);
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

/** RFC 2047 encoded-word for non-ASCII header text. */
export function encodeHeader(value: string) {
  const clean = oneLine(value);
  return /^[ -~]*$/.test(clean) ? clean : `=?UTF-8?B?${b64(clean)}?=`;
}

function address(a: { name?: string; email: string }) {
  const email = a.email.replace(/[\r\n<>]/g, "");
  return a.name ? `${encodeHeader(a.name.replace(/"/g, ""))} <${email}>` : `<${email}>`;
}

/** Builds the full RFC 5322 message (CRLF line endings, not yet dot-stuffed). */
export function buildMessage(msg: SmtpMessage, now = new Date()) {
  const boundary = `rl-${randomBytes(12).toString("hex")}`;
  const domain = msg.from.email.split("@")[1] || "localhost";
  const headers: Record<string, string> = {
    From: address(msg.from),
    To: address({ email: msg.to }),
    Subject: encodeHeader(msg.subject),
    Date: now.toUTCString().replace("GMT", "+0000"),
    "Message-ID": `<${randomBytes(16).toString("hex")}@${domain}>`,
    "MIME-Version": "1.0",
  };
  if (msg.replyTo) headers["Reply-To"] = oneLine(msg.replyTo);
  for (const [k, v] of Object.entries(msg.headers || {})) {
    if (/^[A-Za-z0-9-]+$/.test(k)) headers[k] = oneLine(String(v));
  }
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  const text = wrap76(b64(msg.text));
  if (!msg.html) {
    lines.push("Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", text);
    return lines.join(CRLF);
  }
  lines.push(
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    text,
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(msg.html)),
    `--${boundary}--`,
  );
  return lines.join(CRLF);
}

/** Normalises line endings and escapes lines that start with a dot. */
export function dotStuff(data: string) {
  return data
    .split(/\r?\n/)
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join(CRLF);
}

class Conversation {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buffer = "";
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  constructor(
    socket: SmtpSocket,
    private timeoutMs: number,
  ) {
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  /** Reads one (possibly multi-line) reply. */
  async reply(): Promise<{ code: number; text: string }> {
    const deadline = Date.now() + this.timeoutMs;
    const lines: string[] = [];
    for (;;) {
      const nl = this.buffer.indexOf("\n");
      if (nl >= 0) {
        const line = this.buffer.slice(0, nl).replace(/\r$/, "");
        this.buffer = this.buffer.slice(nl + 1);
        lines.push(line);
        if (/^\d{3}( |$)/.test(line)) {
          return { code: Number(line.slice(0, 3)), text: lines.map((l) => l.slice(4)).join("\n") };
        }
        continue;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("SMTP server timed out");
      let timer: ReturnType<typeof setTimeout> | undefined;
      const chunk = await Promise.race([
        this.reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("SMTP server timed out")), remaining);
        }),
      ]).finally(() => clearTimeout(timer));
      if (chunk.done) throw new Error("SMTP connection closed");
      this.buffer += this.decoder.decode(chunk.value, { stream: true });
    }
  }

  async send(line: string) {
    await this.writer.write(this.encoder.encode(line + CRLF));
  }

  async command(line: string, expect: number[], label = line.split(" ")[0]) {
    await this.send(line);
    const r = await this.reply();
    if (!expect.includes(r.code)) throw new Error(`${label} rejected: ${r.code} ${r.text}`);
    return r;
  }

  release() {
    this.reader.releaseLock();
    this.writer.releaseLock();
  }
}

export async function smtpSend(opts: SmtpOptions, msg: SmtpMessage, connect: SocketConnect) {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const helo = opts.clientName || "rentleaks.com";
  let socket = connect(
    { hostname: opts.host, port: opts.port },
    { secureTransport: opts.secure ? "on" : "starttls", allowHalfOpen: false },
  );
  let talk = new Conversation(socket, timeoutMs);
  try {
    const greet = await talk.reply().catch((err: unknown) => {
      throw new Error(`could not reach ${opts.host}:${opts.port} (${err instanceof Error ? err.message : String(err)})`);
    });
    if (greet.code !== 220) throw new Error(`SMTP greeting: ${greet.code} ${greet.text}`);
    let ehlo = await talk.command(`EHLO ${helo}`, [250]);

    if (!opts.secure) {
      if (!/STARTTLS/i.test(ehlo.text) || !socket.startTls) throw new Error("The server does not offer STARTTLS; use port 465.");
      await talk.command("STARTTLS", [220]);
      talk.release();
      socket = socket.startTls();
      talk = new Conversation(socket, timeoutMs);
      ehlo = await talk.command(`EHLO ${helo}`, [250]);
    }

    const auth = /AUTH[ =]([^\n]*)/i.exec(ehlo.text)?.[1]?.toUpperCase() || "PLAIN LOGIN";
    if (auth.includes("PLAIN")) {
      await talk.command(`AUTH PLAIN ${b64(NUL + opts.user + NUL + opts.pass)}`, [235], "AUTH");
    } else {
      await talk.command("AUTH LOGIN", [334], "AUTH");
      await talk.command(b64(opts.user), [334], "AUTH");
      await talk.command(b64(opts.pass), [235], "AUTH");
    }

    await talk.command(`MAIL FROM:<${msg.from.email}>`, [250], "MAIL FROM");
    await talk.command(`RCPT TO:<${msg.to.replace(/[<>\r\n]/g, "")}>`, [250, 251], "RCPT TO");
    await talk.command("DATA", [354]);
    await talk.send(`${dotStuff(buildMessage(msg))}${CRLF}.`);
    const done = await talk.reply();
    if (done.code !== 250) throw new Error(`Message rejected: ${done.code} ${done.text}`);
    await talk.send("QUIT").catch(() => undefined);
  } finally {
    try {
      await socket.close();
    } catch {
      /* already closed */
    }
  }
}
