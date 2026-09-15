import { Shell } from "@/components/Shell";
import { ResetForm } from "./ResetForm";

/**
 * Where the reset email lands. On a phone with the app installed, the
 * universal link opens the app instead; everywhere else this page does it.
 */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <Shell>
      <section className="rl-auth">
        <h1>{token ? "Choose a new password" : "Reset your password"}</h1>
        <ResetForm token={token && /^[a-f0-9]{64}$/i.test(token) ? token : ""} />
        <p>
          <a href="/login">Back to sign in</a>
        </p>
      </section>
    </Shell>
  );
}
