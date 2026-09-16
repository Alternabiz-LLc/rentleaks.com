import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, Switch, View } from "react-native";
import MapView, { Circle } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api, uploadFile } from "@/api/client";
import { keys, useHostDraft, useMeta } from "@/api/hooks";
import type { City } from "@/api/types";
import { isHostRole, useAuth } from "@/auth/AuthProvider";
import { DateField } from "@/components/DateField";
import { RequireAuth } from "@/components/RequireAuth";
import { StickyFooter } from "@/components/Screen";
import { Badge, Button, Card, Chip, EmptyState, Field, Icon, IconButton, Notice, Row, Section, Segmented, Text } from "@/components/ui";
import {
  ACCESS,
  AMENITIES,
  FEE_TYPES,
  PHOTO_TIPS,
  PRIVACY,
  blankDraft,
  clearDraft,
  draftFromEditable,
  loadDraft,
  photoWarnings,
  saveDraft,
  type ComposerDraft,
  type Photo,
} from "@/features/composer";
import { PETS, isoToday, money } from "@/lib/format";
import { allInOf, checkListing, rulesFor, scanText, type ListingDraft } from "@/shared/listing-rules";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";

const STEPS = ["Basics", "The space", "Money", "Dates", "Photos", "Words", "Review"] as const;

const TYPES = [
  { id: "room", label: "Room" },
  { id: "coliving", label: "Co-living" },
  { id: "furnished", label: "Furnished apartment" },
  { id: "short-term", label: "1-month+ stay" },
  { id: "aparthotel", label: "Aparthotel" },
  { id: "lease-break", label: "Lease takeover" },
];

export default function NewListing() {
  return (
    <RequireAuth icon="key-outline" title="List your home" body="Sign in with a hosting account to create a listing.">
      <Composer />
    </RequireAuth>
  );
}

/**
 * One composer, two modes. With `?id=` it loads a stored listing and submits
 * with PUT — the same seven steps, the same gate, and the listing goes back
 * into review. Without it, a new listing with a locally autosaved draft.
 */
function Composer() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ role?: string; id?: string }>();
  const editingId = typeof params.id === "string" && params.id ? params.id : undefined;
  const meta = useMeta();
  const existing = useHostDraft(editingId);
  const [d, setD] = useState<ComposerDraft>(() => blankDraft(params.role === "manager" || params.role === "tenant" ? params.role : "owner"));
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [serverChecks, setServerChecks] = useState<Array<{ id: string; title: string; why: string }>>([]);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    if (editingId) return;
    loadDraft().then((saved) => {
      if (saved && (saved.title || saved.cityId || saved.photos.length)) {
        Alert.alert("Continue your draft?", saved.title || "You have an unfinished listing.", [
          { text: "Start over", style: "destructive", onPress: () => void clearDraft() },
          { text: "Continue", onPress: () => setD(saved) },
        ]);
      }
      setHydrated(true);
    });
  }, [editingId]);

  useEffect(() => {
    if (existing.data) setD(draftFromEditable(existing.data.draft));
  }, [existing.data]);

  useEffect(() => {
    if (hydrated && !editingId) void saveDraft(d);
  }, [d, hydrated, editingId]);

  const set = (patch: Partial<ComposerDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const city = meta.data?.cities.find((c) => c.id === d.cityId);
  const rules = useMemo(
    () => (city ? rulesFor({ cityId: city.id, citySlug: city.slug, cityName: city.name, state: city.state, country: city.country }) : null),
    [city],
  );

  const gateDraft: ListingDraft = {
    role: d.role,
    housingType: d.housingType,
    cityId: d.cityId,
    citySlug: city?.slug,
    cityName: city?.name,
    state: city?.state,
    country: city?.country,
    title: d.title,
    neighborhood: d.neighborhood,
    address: d.address,
    description: d.description,
    price: d.price,
    deposit: d.deposit,
    fees: d.fees,
    availableFrom: d.availableFrom,
    availableUntil: d.availableUntil,
    minStayMonths: d.minStayMonths,
    maxStayMonths: d.maxStayMonths,
    leaseEnd: d.leaseEnd || undefined,
    consentStatus: d.housingType === "lease-break" ? d.consentStatus : undefined,
    registrationNumber: d.registrationNumber,
    photoCount: d.photos.filter((p) => p.status === "done").length,
  };
  const checks = city ? checkListing(gateDraft) : [];
  const blockers = checks.filter((c) => c.blocking && !c.ok);

  /* Geocode on the phone (Apple/Google geocoders, no key) when the review
     step opens, so the pin lands on the street rather than the city centre.
     The server re-checks the point is near the city before keeping it. */
  const geoKey = city && d.address ? `${d.address}|${d.neighborhood}|${city.id}` : "";
  const geocodedFor = useRef<string>("");
  const [geocoding, setGeocoding] = useState(false);
  useEffect(() => {
    if (step !== 6 || !geoKey || geocodedFor.current === geoKey || !city) return;
    geocodedFor.current = geoKey;
    setGeocoding(true);
    Location.geocodeAsync(`${d.address}, ${d.neighborhood ? `${d.neighborhood}, ` : ""}${city.name}, ${city.countryName}`)
      .then((hits) => {
        const h = hits[0];
        if (h && Math.abs(h.latitude - city.lat) < 0.55 && Math.abs(h.longitude - city.lng) < 0.75) {
          setD((prev) => ({ ...prev, lat: h.latitude, lng: h.longitude }));
        } else {
          setD((prev) => ({ ...prev, lat: undefined, lng: undefined }));
        }
      })
      .catch(() => {})
      .finally(() => setGeocoding(false));
  }, [step, geoKey, city, d.address, d.neighborhood]);

  if (!isHostRole(user)) {
    return (
      <EmptyState
        icon="key-outline"
        title="This is a renting account"
        body="Listing needs a hosting account. Create one with the same email from the website, or contact us to switch."
      />
    );
  }

  const go = (n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  const publish = async () => {
    const uploading = d.photos.some((p) => p.status === "uploading");
    if (uploading) return Alert.alert("Photos still uploading", "Give it a moment.");
    setPublishing(true);
    setServerChecks([]);
    try {
      const payload = {
        ...d,
        photos: d.photos.filter((p) => p.status === "done" && p.path).map((p) => p.path),
        pets: d.pets,
        vouchers: rules?.soiProtected ? true : d.vouchers,
        consentStatus: d.housingType === "lease-break" ? d.consentStatus : undefined,
      };
      const res = editingId
        ? await api<{ id: string }>(`/api/v1/host/listings/${encodeURIComponent(editingId)}`, { method: "PUT", timeoutMs: 30_000, body: payload })
        : await api<{ id: string }>("/api/v1/host/listings", { timeoutMs: 30_000, body: payload });
      if (!editingId) await clearDraft();
      qc.invalidateQueries({ queryKey: keys.host });
      qc.invalidateQueries({ queryKey: keys.listing(res.id) });
      if (editingId) qc.invalidateQueries({ queryKey: keys.hostDraft(editingId) });
      Alert.alert(
        editingId ? "Changes sent for review" : "Sent for review",
        editingId
          ? "It’s off the catalogue until a person has checked the changes — usually within a day. Your enquiry threads are untouched."
          : "A person reviews every listing before renters see it — usually within a day. We’ll notify you.",
        [{ text: "View it", onPress: () => router.replace(`/listing/${encodeURIComponent(res.id)}`) }],
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const details = e.details as { checks?: Array<{ id: string; title: string; why: string }> } | undefined;
        setServerChecks(details?.checks ?? []);
      }
      Alert.alert("Not published yet", e instanceof Error ? e.message : "Try again.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen options={{ title: editingId ? `Edit · ${STEPS[step]}` : STEPS[step] }} />
      {editingId && existing.isLoading ? (
        <View style={{ padding: space.lg }}>
          <Notice tone="brand" title="Loading your listing…" />
        </View>
      ) : null}
      {existing.isError ? (
        <View style={{ padding: space.lg }}>
          <Notice tone="alert" title="Couldn’t load this listing" body={existing.error instanceof Error ? existing.error.message : "Try again."} />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: space.lg, paddingTop: space.sm }}>
        {STEPS.map((s, i) => (
          <Pressable key={s} accessibilityLabel={`Step ${i + 1}: ${s}`} onPress={() => go(i)} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.c.brand : t.c.line }} />
        ))}
      </View>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        {step === 0 ? <StepBasics d={d} set={set} cities={meta.data?.cities ?? []} city={city} /> : null}
        {step === 1 ? <StepSpace d={d} set={set} /> : null}
        {step === 2 ? <StepMoney d={d} set={set} city={city} rules={rules} /> : null}
        {step === 3 ? <StepDates d={d} set={set} rules={rules} /> : null}
        {step === 4 ? <StepPhotos d={d} setD={setD} /> : null}
        {step === 5 ? <StepWords d={d} set={set} /> : null}
        {step === 6 ? (
          <Section title="Ready to publish?" kicker={`${checks.filter((c) => c.ok).length} of ${checks.length} checks pass`}>
            {!city ? <Notice tone="warn" title="Pick a city on the first step" body="The checks depend on the market’s rules." /> : null}
            <Card padded={false}>
              {checks.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => go(stepFor(c.id))}
                  style={{ flexDirection: "row", gap: space.md, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}
                >
                  <Icon name={c.ok ? "checkmark-circle" : c.blocking ? "close-circle" : "alert-circle"} size={22} color={c.ok ? t.c.success : c.blocking ? t.c.alert : t.c.warn} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="h3">{c.title}</Text>
                    <Text variant="small" tone="ink2">{c.why}</Text>
                  </View>
                </Pressable>
              ))}
            </Card>
            {serverChecks.length ? (
              <Notice tone="alert" title="The server’s check disagreed" body={serverChecks.map((c) => `${c.title}: ${c.why}`).join("\n")} />
            ) : null}
            <Card style={{ gap: space.sm }}>
              <Text variant="micro" tone="ink3">Renters will see</Text>
              <Text variant="price" tone="value">{money(allInOf(d), city?.currency)} /mo all-in</Text>
              <Text variant="h3">{d.title || "Untitled listing"}</Text>
              <Text variant="small" tone="ink3">{TYPES.find((x) => x.id === d.housingType)?.label} · {d.neighborhood || "—"}, {city?.name ?? "—"}</Text>
            </Card>
            {city ? (
              <Card padded={false} style={{ gap: 0 }}>
                <View style={{ height: 150 }}>
                  <MapView
                    style={{ flex: 1 }}
                    pointerEvents="none"
                    liteMode
                    userInterfaceStyle={t.dark ? "dark" : "light"}
                    region={{ latitude: d.lat ?? city.lat, longitude: d.lng ?? city.lng, latitudeDelta: d.lat ? 0.02 : 0.15, longitudeDelta: d.lng ? 0.02 : 0.15 }}
                  >
                    {d.lat != null && d.lng != null ? <Circle center={{ latitude: d.lat, longitude: d.lng }} radius={300} strokeColor={t.c.brand} fillColor={t.c.brandSoft + "99"} /> : null}
                  </MapView>
                </View>
                <Text variant="small" tone="ink3" style={{ padding: space.md }}>
                  {geocoding
                    ? "Finding the address on the map…"
                    : d.lat != null
                      ? "Renters see this area — never the exact point unless you chose “full address”."
                      : "Couldn’t place the address; the pin will sit near the city centre. Check the street address on the first step."}
                </Text>
              </Card>
            ) : null}
            <Segmented
              value={d.status}
              onChange={(v) => set({ status: v })}
              options={[{ value: "active", label: "Publish when approved" }, { value: "coming-soon", label: "Coming soon" }]}
            />
            <Text variant="small" tone="ink3">Every listing is reviewed by a person before renters see it. Nothing here is charged to renters by RentLeaks.</Text>
          </Section>
        ) : null}
      </ScrollView>
      <StickyFooter>
        <View style={{ flexDirection: "row", gap: space.md }}>
          {step > 0 ? <Button label="Back" variant="secondary" style={{ flex: 1 }} onPress={() => go(step - 1)} /> : null}
          {step < STEPS.length - 1 ? (
            <Button label="Next" style={{ flex: 2 }} onPress={() => go(step + 1)} />
          ) : (
            <Button label={blockers.length ? `${blockers.length} to fix` : editingId ? "Resubmit for review" : "Submit for review"} style={{ flex: 2 }} disabled={!city || blockers.length > 0 || (!!editingId && !existing.data)} loading={publishing} onPress={publish} />
          )}
        </View>
      </StickyFooter>
    </SafeAreaView>
  );
}

function stepFor(checkId: string) {
  return (
    {
      basics: 0,
      photos: 4,
      fees: 2,
      deposit: 2,
      broker: 2,
      movein: 2,
      registration: 2,
      minstay: 3,
      window: 3,
      leaseend: 3,
      consent: 3,
      wording: 5,
      description: 5,
    } as Record<string, number>
  )[checkId] ?? 0;
}

type StepProps = { d: ComposerDraft; set: (p: Partial<ComposerDraft>) => void };

function StepBasics({ d, set, cities, city }: StepProps & { cities: City[]; city?: City }) {
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const t = useTheme();
  return (
    <>
      <Section title="Who is listing?">
        <Segmented
          value={d.role}
          onChange={(role) => set({ role, housingType: role === "tenant" ? "lease-break" : d.housingType === "lease-break" ? "room" : d.housingType })}
          options={[{ value: "owner", label: "Owner" }, { value: "manager", label: "Agent / manager" }, { value: "tenant", label: "Departing tenant" }]}
        />
        <Text variant="small" tone="ink3">
          {d.role === "manager"
            ? "You act for the owner. In markets like New York, a landlord’s agent cannot charge the renter a broker fee."
            : d.role === "tenant"
              ? "You are passing on your own lease — a sublet or an assignment."
              : "You own the home and handle the let yourself."}
        </Text>
      </Section>
      <Section title="What kind of home?">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TYPES.map((x) => (
            <Chip key={x.id} label={x.label} selected={d.housingType === x.id} onPress={() => set({ housingType: x.id })} />
          ))}
        </View>
      </Section>
      <Section title="Where is it?">
        <Pressable onPress={() => setPicking(true)} accessibilityRole="button">
          <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Icon name="location-outline" size={22} color={t.c.brand} />
            <Text style={{ flex: 1 }} tone={city ? "ink" : "ink3"}>{city ? `${city.name}${city.state ? `, ${city.state}` : ""} · ${city.currency}` : "Choose a city"}</Text>
            <Icon name="chevron-down" size={18} color={t.c.ink3} />
          </Card>
        </Pressable>
        {city?.neighborhoods.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {city.neighborhoods.slice(0, 24).map((n) => (
              <Chip key={n} label={n} selected={d.neighborhood === n} onPress={() => set({ neighborhood: n })} />
            ))}
          </ScrollView>
        ) : null}
        <Field label="Neighbourhood" value={d.neighborhood} onChangeText={(v) => set({ neighborhood: v })} />
        <Field label="Street address" hint="Never published in full unless you choose so below." value={d.address} onChangeText={(v) => set({ address: v })} autoComplete="street-address" />
        <Field label="Unit (optional)" value={d.unit} onChangeText={(v) => set({ unit: v })} />
      </Section>
      <Section title="How much of the address renters see">
        {PRIVACY.map((p) => (
          <Pressable key={p.value} onPress={() => set({ addressPrivacy: p.value })} accessibilityRole="radio" accessibilityState={{ checked: d.addressPrivacy === p.value }}>
            <Card style={{ flexDirection: "row", gap: space.md, alignItems: "center", borderColor: d.addressPrivacy === p.value ? t.c.brand : t.c.line }}>
              <Icon name={d.addressPrivacy === p.value ? "radio-button-on" : "radio-button-off"} size={20} color={t.c.brand} />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{p.label}</Text>
                <Text variant="small" tone="ink3">{p.body}</Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </Section>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.c.bg }}>
          <View style={{ padding: space.lg, gap: space.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text variant="h2" style={{ flex: 1 }}>Choose a city</Text>
              <IconButton name="close" label="Close" onPress={() => setPicking(false)} />
            </View>
            <Field label="Search" value={q} onChangeText={setQ} autoFocus />
          </View>
          <FlatList
            data={cities.filter((c) => !q || `${c.name} ${c.state} ${c.countryName}`.toLowerCase().includes(q.toLowerCase()))}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space.lg }}
            renderItem={({ item }) => (
              <Row
                label={`${item.name}${item.state ? `, ${item.state}` : ""}`}
                value={item.countryName}
                onPress={() => {
                  set({ cityId: item.id, neighborhood: "" });
                  setPicking(false);
                }}
              />
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function Stepper({ label, value, onChange, min = 0, max = 20, step = 1 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 6 }}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <IconButton name="remove" label={`Fewer ${label}`} onPress={() => onChange(Math.max(min, value - step))} />
      <Text variant="h3" style={{ minWidth: 36, textAlign: "center" }}>{value}</Text>
      <IconButton name="add" label={`More ${label}`} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

function StepSpace({ d, set }: StepProps) {
  const t = useTheme();
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  return (
    <>
      <Section title="Size">
        <Card>
          <Stepper label="Bedrooms" value={d.beds} onChange={(beds) => set({ beds })} />
          <Stepper label="Bathrooms" value={d.baths} step={0.5} onChange={(baths) => set({ baths })} />
        </Card>
        <Field label="Square feet (optional)" keyboardType="number-pad" value={d.sqft ? String(d.sqft) : ""} onChangeText={(v) => set({ sqft: Number(v.replace(/\D/g, "")) || 0 })} />
      </Section>
      <Section title="Furnishing">
        <Segmented value={d.furnishedLevel} onChange={(furnishedLevel) => set({ furnishedLevel })} options={[{ value: "fully", label: "Furnished" }, { value: "partly", label: "Partly" }, { value: "unfurnished", label: "Unfurnished" }]} />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <Text style={{ flex: 1 }}>Private bathroom</Text>
            <Switch value={d.privateBath} onValueChange={(privateBath) => set({ privateBath })} trackColor={{ true: t.c.brand, false: t.c.lineStrong }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <Text style={{ flex: 1 }}>Work-ready (desk, chair, fast Wi-Fi)</Text>
            <Switch value={d.workplaceReady} onValueChange={(workplaceReady) => set({ workplaceReady })} trackColor={{ true: t.c.brand, false: t.c.lineStrong }} />
          </View>
        </Card>
      </Section>
      <Section title="Pets">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(PETS).map(([k, label]) => (
            <Chip key={k} label={label} selected={d.pets === k} onPress={() => set({ pets: k })} />
          ))}
        </View>
      </Section>
      <Section title="Included">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {AMENITIES.map(([k, label]) => (
            <Chip key={k} label={label} selected={d.amenities.includes(k)} onPress={() => set({ amenities: toggle(d.amenities, k) })} />
          ))}
        </View>
      </Section>
      <Section title="Access" kicker="About the building, never the person">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ACCESS.map(([k, label]) => (
            <Chip key={k} label={label} selected={d.access.includes(k)} onPress={() => set({ access: toggle(d.access, k) })} />
          ))}
        </View>
      </Section>
    </>
  );
}

function StepMoney({ d, set, city, rules }: StepProps & { city?: City; rules: ReturnType<typeof rulesFor> | null }) {
  const t = useTheme();
  const cur = city?.currency ?? "USD";
  const allIn = allInOf(d);
  const cap = rules?.depositCapMonths != null ? Math.round(d.price * rules.depositCapMonths) : null;
  const addFee = (type: string) => {
    const def = FEE_TYPES.find((f) => f.type === type);
    if (!def || d.fees.some((f) => f.type === type)) return;
    set({ fees: [...d.fees, { type, amount: 0, cadence: def.cadence, mandatory: true }] });
  };
  const num = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

  return (
    <>
      <Section title="Rent" kicker={`In ${cur}`}>
        <Field label="Base rent per month" keyboardType="number-pad" value={d.price ? String(d.price) : ""} onChangeText={(v) => set({ price: num(v) })} />
        <Field
          label="Security deposit"
          keyboardType="number-pad"
          value={d.deposit ? String(d.deposit) : ""}
          onChangeText={(v) => set({ deposit: num(v) })}
          error={cap != null && d.deposit > cap ? `Over this market’s cap of ${money(cap, cur)}.` : null}
          hint={cap != null ? `Capped here at ${rules?.depositCapMonths} month(s) of rent — ${money(cap, cur)}. Paid to you, never to RentLeaks.` : "Paid to you directly, never to RentLeaks."}
        />
      </Section>
      <Section title="Every fee, itemised" kicker="Required — even if it’s none">
        {d.fees.map((f, i) => {
          const def = FEE_TYPES.find((x) => x.type === f.type);
          const barred =
            (f.type === "broker" && f.amount > 0 && rules && !rules.landlordAgentMayChargeTenant) ||
            (["admin", "move_in", "key"].includes(f.type) && f.amount > 0 && rules?.applicationFeeBanned);
          return (
            <Card key={f.type} style={{ gap: space.sm, borderColor: barred ? t.c.alert : t.c.line }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text variant="h3" style={{ flex: 1 }}>{def?.label ?? f.type}</Text>
                <Badge label={f.cadence === "monthly" ? "Monthly" : "One-off"} />
                <IconButton name="trash-outline" label={`Remove ${def?.label}`} tone={t.c.alert} style={{ marginLeft: 8 }} onPress={() => set({ fees: d.fees.filter((_, j) => j !== i) })} />
              </View>
              <Field
                label={`Amount (${cur})`}
                keyboardType="number-pad"
                value={f.amount ? String(f.amount) : ""}
                placeholder="0"
                onChangeText={(v) => set({ fees: d.fees.map((x, j) => (j === i ? { ...x, amount: num(v) } : x)) })}
                error={barred ? "Not allowed in this market — it will block publication." : null}
              />
            </Card>
          );
        })}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {FEE_TYPES.filter((f) => !d.fees.some((x) => x.type === f.type)).map((f) => (
            <Chip key={f.type} label={f.label} icon="add" onPress={() => addFee(f.type)} />
          ))}
        </View>
        {!d.fees.length ? (
          <Button label="There are no extra fees" variant="secondary" icon="checkmark" onPress={() => set({ fees: [{ type: "utilities", amount: 0, cadence: "monthly", mandatory: true }] })} />
        ) : null}
        <Card style={{ backgroundColor: t.c.valueSoft, borderColor: t.c.valueSoft }}>
          <Text variant="micro" tone="value">Headline price renters see</Text>
          <Text variant="price" tone="value">{money(allIn, cur)} /mo all-in</Text>
        </Card>
      </Section>
      {rules?.registrationRequired ? (
        <Section title="Registration number">
          <Field label="Registration / permit number" value={d.registrationNumber} onChangeText={(registrationNumber) => set({ registrationNumber })} hint={rules.registrationSrc ? `Required under ${rules.registrationSrc.label}.` : "Required in this market."} />
        </Section>
      ) : null}
      <Section title="Housing vouchers">
        {rules?.soiProtected ? (
          <Notice tone="brand" title="Accepted — required here" body="Source of income is protected in this market, so vouchers are accepted on every listing. Apply any income test to the renter’s share only." />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1 }}>I accept housing vouchers</Text>
            <Switch value={d.vouchers} onValueChange={(vouchers) => set({ vouchers })} trackColor={{ true: t.c.brand, false: t.c.lineStrong }} />
          </View>
        )}
      </Section>
    </>
  );
}

function StepDates({ d, set, rules }: StepProps & { rules: ReturnType<typeof rulesFor> | null }) {
  return (
    <>
      <Section title="Availability" kicker="Both dates — it’s how renters search">
        <View style={{ flexDirection: "row", gap: space.md }}>
          <DateField label="Available from" value={d.availableFrom || undefined} minimum={isoToday()} onChange={(v) => set({ availableFrom: v ?? "" })} />
          <DateField label="Available until" value={d.availableUntil || undefined} minimum={d.availableFrom || isoToday(30)} onChange={(v) => set({ availableUntil: v ?? "" })} />
        </View>
      </Section>
      <Section title="Length of stay">
        <Card>
          <Stepper label="Minimum months" value={d.minStayMonths} min={1} max={24} onChange={(minStayMonths) => set({ minStayMonths, maxStayMonths: Math.max(minStayMonths, d.maxStayMonths) })} />
          <Stepper label="Maximum months" value={d.maxStayMonths} min={d.minStayMonths} max={36} onChange={(maxStayMonths) => set({ maxStayMonths })} />
        </Card>
        {rules ? <Text variant="small" tone="ink3">This market’s floor is {rules.minStayDays} days{rules.minStaySrc ? ` (${rules.minStaySrc.label})` : ""}.</Text> : null}
      </Section>
      {d.housingType === "lease-break" ? (
        <Section title="Your lease">
          <DateField label="Lease ends" value={d.leaseEnd || undefined} minimum={isoToday()} onChange={(v) => set({ leaseEnd: v ?? "" })} />
          <Segmented value={d.takeoverType} onChange={(takeoverType) => set({ takeoverType })} options={[{ value: "sublet", label: "Sublet (you stay on)" }, { value: "assignment", label: "Assignment (they take over)" }]} />
          <Text variant="small" tone="ink3">Landlord consent</Text>
          <Segmented value={d.consentStatus} onChange={(consentStatus) => set({ consentStatus })} options={[{ value: "pending", label: "Not yet" }, { value: "granted", label: "Granted" }, { value: "not-required", label: "Not required" }]} />
          {rules?.sublet?.silenceIsConsent && d.takeoverType === "sublet" ? (
            <Notice
              tone="brand"
              title="The statutory clock applies here"
              body={`${rules.sublet.statute}: the landlord has ${rules.sublet.infoWindowDays ?? "—"} days to ask for information and ${rules.sublet.decisionWindowDays ?? "—"} days to decide. Send your request in writing and keep proof.`}
            />
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

/* Listing photos are stored at this size: sharp on any phone or laptop screen,
   typically 300-500 KB, so storage and page weight stay low. Same values as
   web/src/lib/image-resize.ts. */
const PHOTO_MAX_EDGE = 1920;
const PHOTO_QUALITY = 0.8;

function StepPhotos({ d, setD }: { d: ComposerDraft; setD: React.Dispatch<React.SetStateAction<ComposerDraft>> }) {
  const t = useTheme();
  const [tips, setTips] = useState(d.photos.length === 0);

  const patchPhoto = (uri: string, patch: Partial<Photo>) =>
    setD((prev) => ({ ...prev, photos: prev.photos.map((p) => (p.uri === uri ? { ...p, ...patch } : p)) }));

  const addAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const fresh: Photo[] = assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height, size: a.fileSize ?? undefined, status: "uploading" }));
    setD((prev) => ({ ...prev, photos: [...prev.photos, ...fresh].slice(0, 24) }));
    for (const p of fresh) {
      try {
        /* Resize to a sane long edge and re-encode before upload: faster on
           mobile data, and strips most EXIF (including GPS) from the file. */
        const ctx = ImageManipulator.ImageManipulator.manipulate(p.uri);
        if ((p.width ?? 0) > PHOTO_MAX_EDGE || (p.height ?? 0) > PHOTO_MAX_EDGE) {
          ctx.resize((p.width ?? 0) >= (p.height ?? 0) ? { width: PHOTO_MAX_EDGE } : { height: PHOTO_MAX_EDGE });
        }
        const ref = await ctx.renderAsync();
        const out = await ref.saveAsync({ compress: PHOTO_QUALITY, format: ImageManipulator.SaveFormat.JPEG });
        const up = await uploadFile(out.uri, "image/jpeg");
        patchPhoto(p.uri, { status: "done", path: up.path, uri: up.url });
      } catch (e) {
        patchPhoto(p.uri, { status: "error", error: e instanceof Error ? e.message : "Upload failed" });
      }
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 24, quality: 1, exif: false });
    if (!res.canceled) await addAssets(res.assets);
  };

  const shoot = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera access needed", "Allow camera access in Settings to take photos here.");
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false });
    if (!res.canceled) await addAssets(res.assets);
  };

  const done = d.photos.filter((p) => p.status === "done").length;

  return (
    <>
      <Section title="Photos" kicker={`${done} uploaded · at least 4`}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Button label="Take photo" icon="camera-outline" style={{ flex: 1 }} onPress={shoot} />
          <Button label="From library" icon="images-outline" variant="secondary" style={{ flex: 1 }} onPress={pick} />
        </View>
        <Pressable onPress={() => setTips((v) => !v)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="bulb-outline" size={18} color={t.c.value} />
          <Text tone="value" variant="label">{tips ? "Hide" : "Show"} nine photography tips that get enquiries</Text>
        </Pressable>
        {tips ? (
          <Card style={{ gap: space.md }}>
            {PHOTO_TIPS.map(([icon, title, body]) => (
              <View key={title} style={{ flexDirection: "row", gap: space.md }}>
                <Icon name={icon} size={20} color={t.c.brand} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{title}</Text>
                  <Text variant="small" tone="ink2">{body}</Text>
                </View>
              </View>
            ))}
            <Text variant="small" tone="ink3">A person reviews every listing. Photographs are mostly what they look at.</Text>
          </Card>
        ) : null}
      </Section>
      <View style={{ gap: space.md }}>
        {d.photos.map((p, i) => {
          const warn = photoWarnings(p, d.photos);
          return (
            <Card key={`${p.uri}-${i}`} padded={false} style={{ flexDirection: "row" }}>
              <Image source={{ uri: p.uri }} style={{ width: 110, height: 90 }} contentFit="cover" />
              <View style={{ flex: 1, padding: space.sm, gap: 4 }}>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {i === 0 ? <Badge label="Cover" tone="value" /> : null}
                  {p.status === "uploading" ? <Badge label="Uploading…" tone="brand" /> : null}
                  {p.status === "error" ? <Badge label={p.error ?? "Failed"} tone="alert" /> : null}
                </View>
                {warn.map((w) => (
                  <Text key={w} variant="small" tone="warn">{w}</Text>
                ))}
                <View style={{ flexDirection: "row", gap: 6, marginTop: "auto" }}>
                  {i > 0 ? (
                    <IconButton name="arrow-up" label="Move up" size={16} onPress={() => setD((prev) => {
                      const photos = [...prev.photos];
                      [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
                      return { ...prev, photos };
                    })} />
                  ) : null}
                  {i > 0 ? (
                    <IconButton name="star-outline" label="Make cover" size={16} onPress={() => setD((prev) => ({ ...prev, photos: [prev.photos[i], ...prev.photos.filter((_, j) => j !== i)] }))} />
                  ) : null}
                  <IconButton name="trash-outline" label="Remove photo" size={16} tone={t.c.alert} onPress={() => setD((prev) => ({ ...prev, photos: prev.photos.filter((_, j) => j !== i) }))} />
                </View>
              </View>
            </Card>
          );
        })}
      </View>
      <Section title="Video tour (optional)">
        <Field label="Link to a walkthrough" placeholder="https://…" autoCapitalize="none" keyboardType="url" value={d.tourUrl} onChangeText={(tourUrl) => setD((prev) => ({ ...prev, tourUrl }))} />
      </Section>
    </>
  );
}

function StepWords({ d, set }: StepProps) {
  const hits = scanText(`${d.title} ${d.description}`);
  return (
    <>
      <Section title="Title">
        <Field label="A plain description of the home" placeholder="Sunny private room with desk, 5 min to the L" value={d.title} onChangeText={(title) => set({ title })} maxLength={120} />
      </Section>
      <Section title="Description">
        <Field
          label="What it’s like to live there"
          value={d.description}
          onChangeText={(description) => set({ description })}
          multiline
          maxLength={6000}
          hint={`${d.description.trim().length} characters · 120+ recommended. Who else lives there, what is genuinely included, what the building is like at 8am.`}
        />
        {hits.length ? (
          <Notice
            tone="alert"
            icon="hand-left-outline"
            title={`“${hits[0]}” can’t be published`}
            body="It states a preference about who may live here. Describe the home, not the person you want in it — fair-housing law applies to every listing."
          />
        ) : (
          <Notice tone="success" icon="checkmark-circle-outline" title="Wording is publishable" body="Nothing states a preference about who may live here." />
        )}
      </Section>
    </>
  );
}
