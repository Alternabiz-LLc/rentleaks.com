/**
 * Make your own account the founder (admin) account and retire the demo logins.
 *
 *   npm run founder                         # asks for email, name and password
 *   npm run founder -- you@example.com      # email on the command line
 *
 * What it does, in one transaction:
 *   1. creates or updates the account with role "admin" and the new password;
 *   2. moves every listing owned by host@rentleaks.com to that account;
 *   3. deletes host@rentleaks.com and renter@rentleaks.com (their sessions,
 *      saved items and conversations go with them);
 *   4. signs the founder out everywhere else;
 *   5. optionally turns two-factor off, for a lost phone AND lost recovery
 *      codes — running this script needs the database itself, which is the
 *      proof of ownership. The desk asks to set it up again at next sign-in.
 *
 * The password is typed hidden and only its scrypt hash is stored.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const DEMO = ["host@rentleaks.com", "renter@rentleaks.com"];
const prisma = new PrismaClient();

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) out.output.write(s);
      else if (s.includes("\n") || s.includes("\r")) out.output.write("\n");
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

async function main() {
  const email = (process.argv[2] || (await ask("Founder email [y.dikoume@gmail.com]: ")) || "y.dikoume@gmail.com").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`"${email}" is not an email address.`);
  if (DEMO.includes(email)) throw new Error("Use your own email, not a demo address.");

  const name = (await ask("Your name [Yves Dikoume]: ")) || "Yves Dikoume";
  const password = await ask("New password (12+ characters, hidden): ", true);
  if (password.length < 12) throw new Error("Use at least 12 characters.");
  const again = await ask("Repeat it: ", true);
  if (again !== password) throw new Error("The two passwords don't match. Nothing was changed.");

  const passwordHash = hashPassword(password);
  const resetTwoFactor = /^y/i.test(await ask("Also turn off two-factor (lost phone and recovery codes)? [y/N]: "));

  const result = await prisma.$transaction(async (tx) => {
    const twoFactorOff = resetTwoFactor
      ? { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, mfaFailures: 0, mfaLockedUntil: null }
      : {};
    const founder = await tx.user.upsert({
      where: { email },
      update: { name, role: "admin", passwordHash, suspendedAt: null, suspendReason: null, ...twoFactorOff },
      create: { email, name, role: "admin", passwordHash, identity: { create: { status: "unverified", provider: "demo" } } },
    });

    const demos = await tx.user.findMany({ where: { email: { in: DEMO } }, select: { id: true } });
    const demoIds = demos.map((d) => d.id);

    const moved = demoIds.length
      ? await tx.listing.updateMany({ where: { hostId: { in: demoIds } }, data: { hostId: founder.id } })
      : { count: 0 };
    if (demoIds.length) {
      /* Threads on the moved listings pointed at the demo host; hand them over too. */
      await tx.conversation.updateMany({ where: { hostId: { in: demoIds } }, data: { hostId: founder.id } });
      await tx.lease.updateMany({ where: { hostId: { in: demoIds } }, data: { hostId: founder.id } });
      await tx.payment.updateMany({ where: { userId: { in: demoIds } }, data: { userId: founder.id } });
    }
    const removed = await tx.user.deleteMany({ where: { id: { in: demoIds } } });
    await tx.session.deleteMany({ where: { userId: founder.id } });
    if (resetTwoFactor) await tx.recoveryCode.deleteMany({ where: { userId: founder.id } });

    return { founder, moved: moved.count, removed: removed.count };
  });

  console.log(
    `\nDone. ${result.founder.email} is the founder account (${result.founder.name}).\n` +
      `Listings moved to you: ${result.moved}. Demo accounts removed: ${result.removed}.\n` +
      `Sign in on the web at /login or in the app with this email and your new password.` +
      (resetTwoFactor ? `\nTwo-factor is off: the desk will walk you through setting it up again at sign-in.` : `\nThe desk will ask for your two-factor code as usual.`),
  );
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
