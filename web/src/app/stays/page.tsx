import { BrowseWorkspace } from "@/components/BrowseWorkspace";
import { Shell } from "@/components/Shell";
import { publicListings, toBrowseListing } from "@/lib/listings";

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
  }>;
}) {
  const params = await searchParams;
  const cityId = params.city || "";
  const housingType = params.type || "";
  const q = params.q || "";
  const max = params.max || "";
  const stay = params.stay || "";
  const rows = await publicListings({
    cityId: cityId || undefined,
    housingType: housingType || undefined,
    q: q || undefined,
    max: asPositiveInt(max),
    stay: asPositiveInt(stay),
  });

  return (
    <Shell wide>
      <BrowseWorkspace
        listings={rows.map(toBrowseListing)}
        cityId={cityId}
        housingType={housingType}
        q={q}
        max={max}
        stay={stay}
        view={params.view}
      />
    </Shell>
  );
}
