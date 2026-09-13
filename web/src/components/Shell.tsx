import { Suspense } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/auth";

export async function Shell({
  children,
  wide = false,
  fill = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
  fill?: boolean;
}) {
  const user = await getCurrentUser();

  return (
    <div className={fill ? "rl-app rl-app--fill" : "rl-app"}>
      <header className="rl-top">
        <div className="rl-top__inner">
          <Link className="rl-mark" href="/">
            <span>RL</span> RentLeaks
          </Link>
          <Suspense fallback={<nav className="rl-nav" aria-label="App" />}>
            <AppNav accountName={user?.name.split(" ")[0]} />
          </Suspense>
          {user ? (
            <form action={logoutAction}>
              <button className="rl-ghost" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <Link className="rl-cta" href="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className={wide ? "rl-main rl-main--browse" : "rl-main"}>{children}</main>
      <SiteFooter />
    </div>
  );
}
