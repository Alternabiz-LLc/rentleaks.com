import Link from "next/link";
import { Fraunces } from "next/font/google";
import "@/app/gate.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

/** A focused sign-in page: brand, one title, one job. */
export function Gate({
  kicker,
  title,
  sub,
  steps,
  wide = false,
  children,
}: {
  kicker: string;
  title: string;
  sub?: React.ReactNode;
  steps?: Array<{ label: string; state: "done" | "on" | "todo" }>;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className={`gt ${display.variable}`}>
      <section className={`gt__box${wide ? " gt__box--wide" : ""}`} aria-labelledby="gt-title">
        <header className="gt__head">
          <Link className="gt__brand" href="/" prefetch={false}>
            <span>RL</span> RentLeaks desk
          </Link>
          <p className="gt__kicker">{kicker}</p>
          <h1 id="gt-title">{title}</h1>
          {sub ? <p>{sub}</p> : null}
        </header>
        <div className="gt__body">
          {steps ? (
            <ol className="gt__steps" aria-label="Progress">
              {steps.map((s) => (
                <li key={s.label} className={s.state === "on" ? "is-on" : s.state === "done" ? "is-done" : undefined} aria-current={s.state === "on" ? "step" : undefined}>
                  {s.label}
                </li>
              ))}
            </ol>
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}
