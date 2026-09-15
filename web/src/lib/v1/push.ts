/**
 * Push notifications through Expo's push service.
 *
 * Fire-and-forget by design: a failed push must never fail the write that
 * caused it (a message is still sent if the recipient's phone is off). Tokens
 * Expo reports as DeviceNotRegistered are pruned so they stop costing calls.
 */
import { prisma } from "@/lib/prisma";

const ENDPOINT = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function pushToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return;
  try {
    const devices = await prisma.pushDevice.findMany({ where: { userId: { in: userIds } } });
    if (!devices.length) return;

    const messages = devices.map((d) => ({
      to: d.token,
      sound: "default",
      title: payload.title.slice(0, 120),
      body: payload.body.slice(0, 180),
      data: payload.data ?? {},
    }));

    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(chunk) });
      const out = (await res.json().catch(() => null)) as { data?: Array<{ status: string; details?: { error?: string } }> } | null;
      const dead = (out?.data || [])
        .map((r, idx) => (r.status === "error" && r.details?.error === "DeviceNotRegistered" ? chunk[idx].to : null))
        .filter((t): t is string => !!t);
      if (dead.length) await prisma.pushDevice.deleteMany({ where: { token: { in: dead } } });
    }
  } catch (err) {
    console.warn("[push] not delivered:", err instanceof Error ? err.message : err);
  }
}
