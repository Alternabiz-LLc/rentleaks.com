"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, returnTo } from "@/lib/admin/flash";
import { prisma } from "@/lib/prisma";
import { isAction, isTrigger, RECIPES, runPlaybooks, TRIGGERS } from "@/lib/ops/playbooks";

const PATH = "/admin/playbooks";
const UNITS: Record<string, number> = { min: 1, hour: 60, day: 1440 };

/** One click: a ready-made recipe, added switched off so it can be read first. */
export async function addRecipe(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("automation");
  if (!guard.ok) back(path, "err", guard.error);
  const r = RECIPES.find((x) => x.id === field(fd, "recipe", 40));
  if (!r) back(path, "err", "Unknown recipe.");
  const pb = await prisma.playbook.create({
    data: { name: r.name, trigger: r.trigger, waitMinutes: r.waitMinutes, action: r.action, subject: r.subject, body: r.body, enabled: false, createdById: guard.user.id },
  });
  await audit(guard.user.id, "playbook.create", "playbook", pb.id, { recipe: r.id });
  revalidatePath(PATH);
  back(`${PATH}?edit=${pb.id}`, "ok", `“${r.name}” added, switched off. Read it, then switch it on.`);
}

export async function savePlaybook(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("automation");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const name = field(fd, "name", 80);
  const trigger = field(fd, "trigger", 40);
  const action = field(fd, "action", 40);
  const amount = Math.round(Number(field(fd, "wait", 6)));
  const unit = UNITS[field(fd, "unit", 6)] ?? 60;
  const subject = field(fd, "subject", 200);
  const body = field(fd, "body", 6000);
  if (name.length < 2) back(path, "err", "Give the playbook a name.");
  if (!isTrigger(trigger)) back(path, "err", "Pick when it should run.");
  if (!isAction(action)) back(path, "err", "Pick what it should do.");
  if (!Number.isFinite(amount) || amount < 0 || amount * unit > 180 * 1440) back(path, "err", "The wait must be between 0 and 180 days.");
  if (action === "send_email" && (subject.length < 3 || body.length < 10)) back(path, "err", "An email needs a subject and a message.");
  const data = { name, trigger, action, waitMinutes: amount * unit, subject, body };
  const pb = id
    ? await prisma.playbook.update({ where: { id }, data })
    : await prisma.playbook.create({ data: { ...data, enabled: false, createdById: guard.user.id } });
  await audit(guard.user.id, id ? "playbook.edit" : "playbook.create", "playbook", pb.id, { trigger, action, wait: data.waitMinutes });
  revalidatePath(PATH);
  back(`${PATH}?edit=${pb.id}`, "ok", id ? "Saved." : `Created, switched off — ${TRIGGERS[trigger].label.charAt(0).toLowerCase()}${TRIGGERS[trigger].label.slice(1)}.`);
}

export async function playbookAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("automation");
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op", 20);
  const id = field(fd, "id", 60);

  if (op === "run") {
    const n = await runPlaybooks(new Date());
    await audit(guard.user.id, "playbook.run", "playbook", "all", { fired: n });
    revalidatePath(PATH);
    back(path, "ok", n ? `Ran now — ${n} action${n === 1 ? "" : "s"} taken. See the log.` : "Ran now — nothing was due.");
  }

  const pb = await prisma.playbook.findUnique({ where: { id } });
  if (!pb) back(path, "err", "That playbook no longer exists.");

  if (op === "on" || op === "off") {
    await prisma.playbook.update({ where: { id }, data: { enabled: op === "on" } });
    await audit(guard.user.id, `playbook.${op}`, "playbook", id);
    revalidatePath(PATH);
    back(path, "ok", op === "on" ? `“${pb.name}” is on — it runs every 5 minutes.` : `“${pb.name}” is off.`);
  }
  if (op === "delete") {
    await prisma.playbook.delete({ where: { id } });
    await audit(guard.user.id, "playbook.delete", "playbook", id, { name: pb.name });
    revalidatePath(PATH);
    back(PATH, "ok", `“${pb.name}” deleted.`);
  }
  back(path, "err", "Unknown action.");
}
