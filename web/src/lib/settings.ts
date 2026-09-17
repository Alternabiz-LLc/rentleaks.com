/**
 * Small editable settings stored in AppSetting.
 */
import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  mailingAddress: "mail.address",
  senderName: "mail.senderName",
  newsletterIntro: "mail.newsletterIntro",
  outboxHeartbeat: "cron.outboxAt",
  alertsHeartbeat: "cron.alertsAt",
  socialDefaultTime: "social.defaultTime",
  // "off" turns the instant reply to new leads off (default on).
  autopilot: "ops.autopilot",
  // "off" stops weekly "still available?" emails and auto-pause (default on).
  freshness: "ops.freshness",
  opsHeartbeat: "cron.opsAt",
  // Books: the owner's tax set-aside rate (percent) and invoice payment terms (days).
  taxRate: "books.taxRate",
  invoiceTerms: "books.terms",
  payInstructions: "books.payInstructions",
  // "off" stops the Monday owner report (default on); the last week it went out.
  weeklyReport: "ops.weeklyReport",
  weeklyReportAt: "ops.weeklyReportAt",
  // Enterprise: the licensed broker shown on every enterprise page, and optional "from" prices (JSON { packageId: "from $…" }).
  brokerName: "ent.brokerName",
  brokerLicence: "ent.brokerLicence",
  brokerStates: "ent.brokerStates",
  brokerPhone: "ent.brokerPhone",
  brokerAddress: "ent.brokerAddress",
  brokerEmail: "ent.brokerEmail",
  enterprisePrices: "ent.prices",
  // "off" pauses the public request form (default on).
  enterpriseForm: "ent.form",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export async function getSettings(keys: SettingKey[]): Promise<Record<string, string>> {
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

export async function getSetting(key: SettingKey, fallback = "") {
  const all = await getSettings([key]);
  return all[key] ?? fallback;
}

export async function setSetting(key: SettingKey, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
