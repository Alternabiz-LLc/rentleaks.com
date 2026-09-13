import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import VerifyDesk from "@/components/VerifyDesk";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Verify your account — RentLeaks" };

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/verify");

  return (
    <Shell>
      <section className="container page-hero">
        <h1>Verification</h1>
        <p>
          The document is checked in your browser and discarded. There is no upload endpoint, and the founder view
          shows verification status rather than anything to open.
        </p>
      </section>
      <section className="rl-page">
        <div className="container">
          <VerifyDesk status={user.identity?.status || "unverified"} name={user.name} />
        </div>
      </section>
    </Shell>
  );
}
