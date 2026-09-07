import { redirect } from "next/navigation";
import { signInAction, signUpAction } from "@/app/actions/auth";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { safePath } from "@/lib/site";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const next = safePath(params.next || "/");
  if (user) redirect(next);

  const signup = params.mode === "signup";
  const error =
    params.error === "invalid"
      ? "Check the email and password, then try again."
      : params.error === "exists"
        ? "That email already has an account. Sign in instead."
        : "";

  return (
    <Shell>
      <section className="rl-auth">
        <h1>{signup ? "Create a host account" : "Sign in"}</h1>
        <p>Demo host: host@rentleaks.com / rentleaks. Demo renter: renter@rentleaks.com / rentleaks.</p>
        {error ? <p className="rl-error">{error}</p> : null}
        {signup ? (
          <form action={signUpAction} className="rl-form">
            <input type="hidden" name="next" value={next} />
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" minLength={8} required />
            </label>
            <label>
              I am listing as
              <select name="role" defaultValue="host">
                <option value="host">Host</option>
                <option value="renter">Renter</option>
              </select>
            </label>
            <button className="rl-cta" type="submit">
              Create account
            </button>
          </form>
        ) : (
          <form action={signInAction} className="rl-form">
            <input type="hidden" name="next" value={next} />
            <label>
              Email
              <input name="email" type="email" defaultValue="host@rentleaks.com" required />
            </label>
            <label>
              Password
              <input name="password" type="password" defaultValue="rentleaks" required />
            </label>
            <button className="rl-cta" type="submit">
              Sign in
            </button>
          </form>
        )}
        <p>
          {signup ? (
            <a href={`/login?next=${encodeURIComponent(next)}`}>Already have an account? Sign in</a>
          ) : (
            <a href={`/login?mode=signup&next=${encodeURIComponent(next)}`}>Create an account</a>
          )}
        </p>
      </section>
    </Shell>
  );
}
