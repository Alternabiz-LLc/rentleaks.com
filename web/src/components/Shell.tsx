import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { catalogOrigin } from "@/lib/site";
import { logoutAction } from "@/app/actions/auth";

export async function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const user = await getCurrentUser();
  const catalog = catalogOrigin();

  return (
    <div className="rl-app">
      <header className="rl-top">
        <div className="rl-top__inner">
          <Link className="rl-mark" href="/">
            <span>RL</span> RentLeaks
          </Link>
          <nav className="rl-nav" aria-label="App">
            <Link href="/stays?type=room">Rooms</Link>
            <Link href="/stays?type=coliving">Co-living</Link>
            <Link href="/stays?type=furnished">Furnished</Link>
            <Link href="/stays?type=short-term">1-month+</Link>
            <Link href="/stays?type=lease-break">Lease-break</Link>
            <Link href="/stays?view=map">Map</Link>
            <Link href="/stays">Stays</Link>
            <Link href="/list">List a place</Link>
            {user ? <Link href="/account">{user.name.split(" ")[0]}</Link> : null}
          </nav>
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
      <footer className="rl-foot">
        <a href={`${catalog}/rent.html`}>Public catalog</a>
        <Link href="/">Home</Link>
        <Link href="/stays">Stays</Link>
        <Link href="/list">List a place</Link>
      </footer>
    </div>
  );
}
