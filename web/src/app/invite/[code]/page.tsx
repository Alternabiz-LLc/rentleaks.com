import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { createSession, getCurrentUser, hashPassword } from "@/lib/auth";
import { contactFromUser } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { findUsableInvite, normaliseCode, redeemInvite } from "@/lib/trials";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your free listing trial — RentLeaks", robots: { index: false } };

async function activate(formData: FormData) {
  "use server";
  const code = normaliseCode(String(formData.get("code") || ""));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);
  const result = await redeemInvite(code, user);
  redirect(result.ok ? "/list?trial=1" : `/invite/${code}?error=${encodeURIComponent(result.reason)}`);
}

async function signUpAndActivate(formData: FormData) {
  "use server";
  const code = normaliseCode(String(formData.get("code") || ""));
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const back = (msg: string) => redirect(`/invite/${code}?error=${encodeURIComponent(msg)}`);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back("Add your name and a valid email.");
  if (password.length < 8) back("Use at least 8 characters for your password.");
  if (formData.get("terms") !== "on") back("Accept the terms to continue.");
  const found = await findUsableInvite(code);
  if (!found.ok) back(found.reason);
  if (await prisma.user.findUnique({ where: { email } })) {
    redirect(`/login?error=exists&next=${encodeURIComponent(`/invite/${code}`)}`);
  }
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: "host",
      identity: { create: { status: "unverified", provider: "demo" } },
    },
  });
  await contactFromUser(user, "invite");
  await createSession(user.id);
  const result = await redeemInvite(code, user);
  redirect(result.ok ? "/list?trial=1" : `/invite/${code}?error=${encodeURIComponent(result.reason)}`);
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const code = normaliseCode((await params).code);
  const { error } = await searchParams;
  const [found, user] = await Promise.all([findUsableInvite(code), getCurrentUser()]);
  const days = found.invite?.days ?? 7;

  return (
    <Shell>
      <section className="rl-auth">
        <h1>{found.ok ? `List free for ${days} days` : "Invitation unavailable"}</h1>
        {error ? <p className="rl-error">{error}</p> : null}
        {!found.ok ? (
          <p>
            {found.reason} You can still <Link href="/list">list a place</Link> at the posted rates.
          </p>
        ) : (
          <>
            <p>
              You&rsquo;ve been invited to list on RentLeaks free for your first {days} days: a listing page with photos, the
              all-in price and your dates, with viewing and booking requests sent straight to you. No card to start.
            </p>
            {user ? (
              <form action={activate} className="rl-form">
                <input type="hidden" name="code" value={code} />
                <p>Signed in as {user.email}.</p>
                <button className="rl-cta" type="submit">Activate my free {days} days</button>
              </form>
            ) : (
              <>
                <form action={signUpAndActivate} className="rl-form">
                  <input type="hidden" name="code" value={code} />
                  <label>
                    Name
                    <input name="name" required defaultValue={found.invite.name} autoComplete="name" />
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" required defaultValue={found.invite.email} autoComplete="email" />
                  </label>
                  <label>
                    Password
                    <input name="password" type="password" minLength={8} required autoComplete="new-password" />
                  </label>
                  <label className="rl-check">
                    <input name="terms" type="checkbox" required /> I accept the terms and community guidelines
                  </label>
                  <button className="rl-cta" type="submit">Create account and start my free trial</button>
                </form>
                <p>
                  <Link href={`/login?next=${encodeURIComponent(`/invite/${code}`)}`}>Already have an account? Sign in</Link>
                </p>
              </>
            )}
          </>
        )}
      </section>
    </Shell>
  );
}
