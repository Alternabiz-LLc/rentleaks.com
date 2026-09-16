import { BrowseWorkspace } from "@/components/BrowseWorkspace";
import { Shell } from "@/components/Shell";
import { StaysHero } from "@/components/StaysHero";
import { publicListings, toBrowseListing } from "@/lib/listings";
import { sponsorSeed } from "@/lib/sponsored-placement";

function asPositiveInt(value?: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export default async function StaysPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    type?: string;
    view?: string;
    q?: string;
    max?: string;
    stay?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const cityId = params.city || "";
  const housingType = params.type || "";
  const q = params.q || "";
  const max = params.max || "";
  const stay = params.stay || "";
  const from = params.from || "";
  const to = params.to || "";
  const rows = await publicListings({
    cityId: cityId || undefined,
    housingType: housingType || undefined,
    q: q || undefined,
    max: asPositiveInt(max),
    stay: asPositiveInt(stay),
    from,
    to,
  });

  return (
    <Shell wide>
      <StaysHero
        rows={rows}
        housingType={housingType}
        cityId={cityId}
        q={q}
        max={max}
        stay={stay}
        from={from}
        to={to}
      />
      <BrowseWorkspace
        listings={rows.map(toBrowseListing)}
        cityId={cityId}
        housingType={housingType}
        q={q}
        max={max}
        stay={stay}
        from={from}
        to={to}
        view={params.view}
        sponsorSeed={sponsorSeed(cityId)}
      />
    </Shell>
  );
}
