import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { clientKey, handle, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { sendMail } from "@/lib/v1/mail";
import { issueResetToken } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/**
 * Request a reset link. Always answers the same way, whether or not the
 * address has an account, so the endpoint cannot be used to discover members.
 */
export const POST = handle(async (req: Request) => {
  rateLimit(`forgot:${clientKey(req)}`, 5, 15 * 60_000);
  const body = await readJson(req);
  const email = str(body.email, 200).toLowerCase();
  rateLimit(`forgot-email:${email}`, 3, 60 * 60_000);

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user) {
    const token = await issueResetToken(user.id);
    const link = `${appUrl().replace(/\/$/, "")}/reset?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "Reset your RentLeaks password",
      text:
        `Hi ${user.name.split(/\s+/)[0]},\n\n` +
        `Use this link to choose a new password. It works once and expires in 30 minutes:\n\n${link}\n\n` +
        `If you didn't ask for this, ignore this email — your password stays the same.\n\n` +
        `RentLeaks will never ask you for payment by email.`,
    });
  }
  return ok({ ok: true, message: "If that email has an account, a reset link is on its way. It expires in 30 minutes." });
});
