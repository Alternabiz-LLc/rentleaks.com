import assert from "node:assert/strict";
import { createServer, Socket, type AddressInfo } from "node:net";
import { Duplex } from "node:stream";
import { test } from "node:test";
import { buildMessage, dotStuff, encodeHeader, smtpSend, type SocketConnect } from "../src/lib/v1/smtp";

/** A plain-TCP stand-in for cloudflare:sockets `connect`. */
const nodeConnect: SocketConnect = ({ hostname, port }) => {
  const sock = new Socket();
  sock.connect(port, hostname);
  const web = Duplex.toWeb(sock) as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };
  return { readable: web.readable, writable: web.writable, close: () => void sock.destroy() };
};

function fakeServer(opts: { auth?: string; rejectRcpt?: boolean } = {}) {
  const transcript: string[] = [];
  let data = "";
  const server = createServer((c) => {
    let inData = false;
    let buf = "";
    c.write("220 fake ESMTP\r\n");
    c.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            c.write("250 queued\r\n");
          } else data += `${line}\n`;
          continue;
        }
        transcript.push(line);
        const cmd = line.split(" ")[0].toUpperCase();
        if (cmd === "EHLO") c.write(`250-fake\r\n250-SIZE 1000000\r\n250 AUTH ${opts.auth ?? "PLAIN LOGIN"}\r\n`);
        else if (cmd === "AUTH" && line.includes("PLAIN")) {
          const creds = Buffer.from(line.split(" ")[2], "base64").toString("utf8").split(String.fromCharCode(0));
          c.write(creds[1] === "me@x.io" && creds[2] === "pw" ? "235 ok\r\n" : "535 bad\r\n");
        } else if (cmd === "AUTH") c.write("334 VXNlcm5hbWU6\r\n");
        else if (cmd === "MAIL") c.write("250 ok\r\n");
        else if (cmd === "RCPT") c.write(opts.rejectRcpt ? "550 no such user\r\n" : "250 ok\r\n");
        else if (cmd === "DATA") {
          inData = true;
          c.write("354 go\r\n");
        } else if (cmd === "QUIT") c.end("221 bye\r\n");
        else if (/^[A-Za-z0-9+/=]+$/.test(line) && transcript.at(-2)?.startsWith("AUTH LOGIN")) c.write("334 UGFzc3dvcmQ6\r\n");
        else if (/^[A-Za-z0-9+/=]+$/.test(line)) c.write("235 ok\r\n");
        else c.write("502 ?\r\n");
      }
    });
  });
  return new Promise<{ port: number; transcript: string[]; data: () => string; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ port: (server.address() as AddressInfo).port, transcript, data: () => data, close: () => server.close() }),
    ),
  );
}

const MSG = {
  from: { name: "RentLeaks", email: "me@x.io" },
  to: "ada@example.com",
  subject: "Héllo",
  text: "line one\n.starts with a dot",
  html: "<p>hi</p>",
  headers: { "List-Unsubscribe": "<https://x.io/u>" },
};

test("sends a message with AUTH PLAIN", async () => {
  const s = await fakeServer();
  try {
    await smtpSend({ host: "127.0.0.1", port: s.port, user: "me@x.io", pass: "pw", secure: true, timeoutMs: 3000 }, MSG, nodeConnect);
    assert.ok(s.transcript.some((l) => l === "MAIL FROM:<me@x.io>"));
    assert.ok(s.transcript.some((l) => l === "RCPT TO:<ada@example.com>"));
    const body = s.data();
    assert.match(body, /^From: RentLeaks <me@x\.io>/m);
    assert.match(body, /^Subject: =\?UTF-8\?B\?/m);
    assert.match(body, /^List-Unsubscribe: <https:\/\/x\.io\/u>/m);
    assert.match(body, /multipart\/alternative/);
  } finally {
    s.close();
  }
});

test("falls back to AUTH LOGIN and reports a rejected recipient", async () => {
  const s = await fakeServer({ auth: "LOGIN", rejectRcpt: true });
  try {
    await assert.rejects(
      smtpSend({ host: "127.0.0.1", port: s.port, user: "me@x.io", pass: "pw", secure: true, timeoutMs: 3000 }, MSG, nodeConnect),
      /RCPT TO rejected: 550/,
    );
    assert.ok(s.transcript.includes("AUTH LOGIN"));
  } finally {
    s.close();
  }
});

test("bad password is reported, headers can't be injected, dots are stuffed", async () => {
  const s = await fakeServer();
  try {
    await assert.rejects(
      smtpSend({ host: "127.0.0.1", port: s.port, user: "me@x.io", pass: "nope", secure: true, timeoutMs: 3000 }, MSG, nodeConnect),
      /AUTH rejected: 535/,
    );
  } finally {
    s.close();
  }
  const raw = buildMessage({ ...MSG, subject: "Hi\r\nBcc: evil@x.io", html: undefined });
  assert.doesNotMatch(raw, /^Bcc:/m);
  assert.equal(encodeHeader("plain"), "plain");
  assert.equal(dotStuff("a\n.b\n..c"), "a\r\n..b\r\n...c");
});
