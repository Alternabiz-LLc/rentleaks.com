import { redirect } from "next/navigation";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; type?: string; view?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.city) query.set("city", params.city);
  if (params.type) query.set("type", params.type);
  query.set("view", params.view || "split");
  const qs = query.toString();
  redirect(qs ? `/stays?${qs}` : "/stays");
}
