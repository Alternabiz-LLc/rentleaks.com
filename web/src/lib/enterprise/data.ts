/**
 * Enterprise: the database side — licence settings, the public config the
 * static pages read, deliverable checklists, owner statements and the facts
 * the advisor and the client pages use. The catalogue itself is pure
 * (./catalog) so the website builder and the tests share it.
 */
import { canAccess } from "@/lib/access";
import { booksToday } from "@/lib/books/data";
import { fmtCents } from "@/lib/books/core";
import { prisma } from "@/lib/prisma";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { brokerComplete, brokerLine, licensedIn, monthName, PACKAGE, PACKAGES, statementDue, statementMonth, type BrokerDetails } from "./catalog";

const DAY = 86_400_000;

export const NY_NOTICE_URL = "https://dos.ny.gov/system/files/documents/2025/03/nys-housing-and-anti-discrimination-notice_02.2025.pdf";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function enterpriseSettings() {
  const s = await getSettings([
    SETTING_KEYS.brokerName,
    SETTING_KEYS.brokerLicence,
    SETTING_KEYS.brokerStates,
    SETTING_KEYS.brokerPhone,
    SETTING_KEYS.brokerAddress,
    SETTING_KEYS.brokerEmail,
    SETTING_KEYS.enterprisePrices,
    SETTING_KEYS.enterpriseForm,
  ]);
  const broker: BrokerDetails = {
    name: s[SETTING_KEYS.brokerName] ?? "",
    licence: s[SETTING_KEYS.brokerLicence] ?? "",
    states: s[SETTING_KEYS.brokerStates] ?? "",
    phone: s[SETTING_KEYS.brokerPhone] ?? "",
    address: s[SETTING_KEYS.brokerAddress] ?? "",
    email: s[SETTING_KEYS.brokerEmail] ?? "",
  };
  return { broker, prices: parsePrices(s[SETTING_KEYS.enterprisePrices] ?? ""), formOpen: s[SETTING_KEYS.enterpriseForm] !== "off" };
}

/** { packageId: "from $1,500 / building" } — only known packages, short strings. */
export function parsePrices(json: string): Record<string, string> {
  try {
    const v = JSON.parse(json || "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k, x]) => PACKAGE.has(k) && typeof x === "string" && x.trim())
        .map(([k, x]) => [k, String(x).replace(/\s+/g, " ").trim().slice(0, 60)]),
    );
  } catch {
    return {};
  }
}

/** What rentleaks.com/enterprise/ reads: licence strip, "from" prices, whether the form is open. */
export async function publicConfig() {
  const { broker, prices, formOpen } = await enterpriseSettings();
  const complete = brokerComplete(broker);
  return {
    broker: complete
      ? { name: broker.name, licence: broker.licence, states: broker.states, phone: broker.phone, address: broker.address, email: broker.email, line: brokerLine(broker), nyNotice: licensedIn(broker, "NY") ? NY_NOTICE_URL : null }
      : null,
    prices,
    formOpen,
  };
}

export async function enterpriseTeam() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "staff"] }, suspendedAt: null, NOT: { passwordHash: "" } },
    select: { id: true, email: true, name: true, role: true, staffAccess: true },
  });
  return users.filter((u) => canAccess(u, "enterprise"));
}

export async function alertEnterpriseTeam(subject: string, text: string) {
  const team = await enterpriseTeam();
  await Promise.allSettled(team.map((u) => sendMail({ to: u.email, subject, text })));
  return team.map((u) => u.email);
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * The deliverable checklist for a package, due dates spread over the first
 * weeks (the first step in two days, then about every four). Skipped when the
 * engagement already has tasks, so signing twice never doubles the list.
 */
export async function seedTasks(engagementId: string, packageId: string | null, start = booksToday()) {
  const pkg = packageId ? PACKAGE.get(packageId) : undefined;
  if (!pkg) return 0;
  const have = await prisma.engagementTask.count({ where: { engagementId } });
  if (have) return 0;
  const made = await prisma.engagementTask.createMany({
    data: pkg.tasks.map((title, i) => ({ engagementId, title, position: i, dueDate: addDays(start, i === 0 ? 2 : 2 + i * 4) })),
  });
  return made.count;
}

export function engagementTitle(clientName: string, company: string | null | undefined, packageId: string | null | undefined) {
  const pkg = packageId ? PACKAGE.get(packageId) : undefined;
  return `${company || clientName} — ${pkg ? pkg.name : "Custom scope"}`.slice(0, 160);
}

export type ExpenseLine = { label: string; amountCents: number };

export function parseExpenseLines(json: string): ExpenseLine[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v)
      ? v
          .map((x) => x as Partial<ExpenseLine>)
          .filter((x) => typeof x.label === "string" && Number.isFinite(x.amountCents))
          .map((x) => ({ label: String(x.label).slice(0, 120), amountCents: Math.round(Number(x.amountCents)) }))
      : [];
  } catch {
    return [];
  }
}

/** Emails the owner their monthly statement. */
export async function sendStatement(id: string) {
  const st = await prisma.ownerStatement.findUnique({ where: { id }, include: { property: true } });
  if (!st) return { ok: false as const, error: "That statement no longer exists." };
  const p = st.property;
  const { broker } = await enterpriseSettings();
  const money = (c: number) => fmtCents(c, p.currency);
  const first = p.ownerName.trim().split(/\s+/)[0] || "there";
  const lines = parseExpenseLines(st.expenseLines);
  const rows: Array<[string, string, boolean?]> = [
    ["Rent collected for you", money(st.collectedCents)],
    ...lines.map((l): [string, string] => [`Paid for you: ${l.label}`, `− ${money(l.amountCents)}`]),
    ...(lines.length ? [] : st.expensesCents ? [["Expenses paid for you", `− ${money(st.expensesCents)}`] as [string, string]] : []),
    ["Management fee", `− ${money(st.feeCents)}`],
    ["Net to you", money(st.netCents), true],
  ];
  const occ = p.units ? `${st.occupied} of ${p.units} units occupied` : "";
  const from = broker.name || "RentLeaks";
  const text =
    `Hi ${first},\n\nYour statement for ${p.name} — ${monthName(st.month)}.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}` +
    `${occ ? `\n\n${occ}.` : ""}${st.note ? `\n\n${st.note}` : ""}\n\nRent we collect for you is client money: it is held separately from our own funds and paid out to you, less the items above.` +
    `\n\nQuestions about any line? Just reply.\n\n${from}${brokerLine(broker) ? `\n${brokerLine(broker)}` : ""}`;
  const html =
    `<!doctype html><html><body style="margin:0;background:#f2f6f6"><div style="max-width:600px;margin:0 auto;padding:28px;background:#fff;font:15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#0f2328">` +
    `<p style="margin:0;color:#56696f;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Owner statement · ${esc(monthName(st.month))}</p><h1 style="margin:6px 0 18px;font-size:22px">${esc(p.name)}</h1>` +
    `<p>Hi ${esc(first)}, here is how ${esc(p.name)} did last month.</p>` +
    `<table width="100%" role="presentation" style="border-collapse:collapse;font-size:14px">${rows
      .map(([k, v, bold]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e3ecee${bold ? ";font-weight:700" : ""}">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e3ecee;text-align:right${bold ? ";font-weight:700;font-size:16px" : ""}">${esc(v)}</td></tr>`)
      .join("")}</table>` +
    `${occ ? `<p style="color:#56696f">${esc(occ)}.</p>` : ""}${st.note ? `<p style="white-space:pre-line">${esc(st.note)}</p>` : ""}` +
    `<p style="padding:12px 14px;border-radius:10px;background:#f2f6f6;font-size:13px">Rent we collect for you is client money: it is held separately from our own funds and paid out to you, less the items above.</p>` +
    `<p style="color:#7d8f94;font-size:12px;margin-top:24px">${esc(from)}${brokerLine(broker) ? `<br>${esc(brokerLine(broker))}` : ""}</p></div></body></html>`;
  const mail = await sendMail({ to: p.ownerEmail, subject: `${p.name} — statement for ${monthName(st.month)}: ${money(st.netCents)} to you`, text, html, purpose: "transactional" });
  if (!mail.delivered && mail.transport !== "console") return { ok: false as const, error: mail.error ?? `Not delivered (${mail.transport}).` };
  await prisma.ownerStatement.update({ where: { id }, data: { sentAt: new Date() } });
  const contact = await prisma.contact.findUnique({ where: { email: p.ownerEmail.toLowerCase() }, select: { id: true } });
  if (contact) await prisma.contactActivity.create({ data: { contactId: contact.id, kind: "email", subject: `Owner statement ${st.month} sent`, body: p.name } }).catch(() => undefined);
  return { ok: true as const, logged: !mail.delivered };
}

/** Numbers the advisor and the overview use. Every query is guarded: a missing table must not break the desk. */
export async function enterpriseFacts(now = new Date()) {
  const today = booksToday(now);
  const safe = <T,>(p: Promise<T>, f: T) => p.catch(() => f);
  const [waiting, settings, props, overdueTasks] = await Promise.all([
    safe(prisma.serviceRequest.count({ where: { status: "new", createdAt: { lt: new Date(now.getTime() - DAY) } } }), 0),
    safe(enterpriseSettings(), null),
    safe(prisma.managedProperty.findMany({ where: { status: "active" }, select: { id: true, status: true, statements: { select: { month: true }, orderBy: { month: "desc" }, take: 1 } } }), []),
    safe(prisma.engagementTask.count({ where: { doneAt: null, dueDate: { lt: today }, engagement: { status: { in: ["signed", "active"] } } } }), 0),
  ]);
  const anyWork = await safe(prisma.engagement.count(), 0);
  const requests = await safe(prisma.serviceRequest.count(), 0);
  return {
    requestsWaiting: waiting,
    brokerMissing: settings ? !brokerComplete(settings.broker) : false,
    statementsDue: props.filter((p) => statementDue({ status: p.status, lastMonth: p.statements[0]?.month ?? null }, today)).length,
    statementMonth: statementMonth(today),
    overdueTasks,
    inUse: anyWork + requests > 0,
  };
}

/** Everything enterprise about one client, for their account page. */
export async function clientEnterprise(email: string, userId: string) {
  const e = email.toLowerCase();
  const safe = <T,>(p: Promise<T>, f: T) => p.catch(() => f);
  const [requests, engagements, properties] = await Promise.all([
    safe(prisma.serviceRequest.findMany({ where: { email: e, status: { not: "spam" } }, orderBy: { createdAt: "desc" }, take: 20 }), []),
    safe(prisma.engagement.findMany({ where: { OR: [{ clientEmail: e }, { userId }] }, orderBy: { createdAt: "desc" }, take: 20, include: { tasks: { select: { doneAt: true } } } }), []),
    safe(prisma.managedProperty.findMany({ where: { ownerEmail: e }, orderBy: { createdAt: "desc" }, take: 20, include: { statements: { orderBy: { month: "desc" }, take: 1 } } }), []),
  ]);
  return { requests, engagements, properties };
}

export const packageOptions = () => PACKAGES.map((p) => ({ id: p.id, label: `${p.track} · ${p.name}` }));

export function deskLink(path: string) {
  return `${appUrl().replace(/\/$/, "")}${path}`;
}
