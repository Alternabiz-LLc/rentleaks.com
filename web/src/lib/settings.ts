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
