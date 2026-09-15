/**
 * Move-in / move-out condition reports — the renter's deposit evidence.
 *
 * RentLeaks never holds a deposit, so the most useful thing it can do about
 * deposits is help the renter prove the state of the home. Photos are copied
 * into the app's private documents folder, timestamped, optionally located,
 * and fingerprinted (SHA-256) so a later PDF can show the image is the one
 * captured that day. Everything stays on the phone until the renter exports.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

export type ConditionItem = {
  id: string;
  uri: string;
  note: string;
  takenAt: string;
  lat?: number;
  lng?: number;
  sha256?: string;
};

export type ConditionRoom = { id: string; name: string; items: ConditionItem[]; notes: string };

export type ConditionReport = {
  id: string;
  kind: "move-in" | "move-out";
  title: string;
  address: string;
  landlord: string;
  createdAt: string;
  rooms: ConditionRoom[];
};

const INDEX = "rl.condition.v1";

export const DEFAULT_ROOMS = ["Entry & hallway", "Living room", "Kitchen", "Bathroom", "Bedroom", "Windows & doors", "Appliances", "Meters (photo the readings)"];

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export async function listReports(): Promise<ConditionReport[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX);
    return raw ? (JSON.parse(raw) as ConditionReport[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(all: ConditionReport[]) {
  await AsyncStorage.setItem(INDEX, JSON.stringify(all));
}

export async function getReport(id: string) {
  return (await listReports()).find((r) => r.id === id) ?? null;
}

export async function saveReport(report: ConditionReport) {
  const all = await listReports();
  const i = all.findIndex((r) => r.id === report.id);
  if (i >= 0) all[i] = report;
  else all.unshift(report);
  await writeAll(all);
}

export async function createReport(kind: ConditionReport["kind"], title: string, address: string) {
  const report: ConditionReport = {
    id: uid(),
    kind,
    title: title || (kind === "move-in" ? "Move-in report" : "Move-out report"),
    address,
    landlord: "",
    createdAt: new Date().toISOString(),
    rooms: DEFAULT_ROOMS.map((name) => ({ id: uid(), name, items: [], notes: "" })),
  };
  await saveReport(report);
  return report;
}

function reportDir(id: string) {
  const dir = new Directory(Paths.document, "condition", id);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export async function deleteReport(id: string) {
  const all = await listReports();
  await writeAll(all.filter((r) => r.id !== id));
  try {
    const dir = new Directory(Paths.document, "condition", id);
    if (dir.exists) dir.delete();
  } catch {
    /* already gone */
  }
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Copies a captured photo into private storage and fingerprints it. */
export async function keepPhoto(reportId: string, sourceUri: string, coords?: { lat: number; lng: number }): Promise<ConditionItem> {
  const id = uid();
  const dest = new File(reportDir(reportId), `${id}.jpg`);
  await new File(sourceUri).copy(dest);
  let sha256: string | undefined;
  try {
    const bytes = await dest.arrayBuffer();
    sha256 = hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes)));
  } catch {
    sha256 = undefined;
  }
  return { id, uri: dest.uri, note: "", takenAt: new Date().toISOString(), lat: coords?.lat, lng: coords?.lng, sha256 };
}

export function removePhotoFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* ignore */
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Self-contained HTML for expo-print. Images are inlined so the PDF stands alone. */
export async function reportHtml(r: ConditionReport) {
  const rooms: string[] = [];
  for (const room of r.rooms) {
    if (!room.items.length && !room.notes) continue;
    const photos: string[] = [];
    for (const it of room.items) {
      let data = "";
      try {
        data = await new File(it.uri).base64();
      } catch {
        data = "";
      }
      photos.push(`
        <figure>
          ${data ? `<img src="data:image/jpeg;base64,${data}" />` : "<div class='missing'>Image file missing</div>"}
          <figcaption>
            <b>${new Date(it.takenAt).toLocaleString()}</b>
            ${it.lat != null ? ` · ${it.lat.toFixed(5)}, ${it.lng?.toFixed(5)}` : ""}
            ${it.note ? `<br/>${esc(it.note)}` : ""}
            ${it.sha256 ? `<br/><code>SHA-256 ${it.sha256}</code>` : ""}
          </figcaption>
        </figure>`);
    }
    rooms.push(`<section><h2>${esc(room.name)}</h2>${room.notes ? `<p>${esc(room.notes)}</p>` : ""}<div class="grid">${photos.join("")}</div></section>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#10242a;padding:24px}
    h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;border-bottom:1px solid #d7e4e7;padding-bottom:4px;margin-top:24px}
    .meta{color:#5b6f75;font-size:12px} .grid{display:flex;flex-wrap:wrap;gap:10px}
    figure{width:48%;margin:0;page-break-inside:avoid} img{width:100%;border-radius:6px}
    figcaption{font-size:10px;color:#2f4a52;margin-top:4px;word-break:break-all} code{font-size:8px;color:#6b7f85}
    .missing{height:120px;background:#edf4f6;display:flex;align-items:center;justify-content:center;font-size:11px}
    footer{margin-top:32px;font-size:10px;color:#6b7f85}
  </style></head><body>
    <h1>${esc(r.title)}</h1>
    <div class="meta">${r.kind === "move-in" ? "Move-in" : "Move-out"} condition report · ${esc(r.address || "Address not given")}
    ${r.landlord ? ` · Landlord/agent: ${esc(r.landlord)}` : ""} · started ${new Date(r.createdAt).toLocaleString()}</div>
    ${rooms.join("") || "<p>No photos recorded.</p>"}
    <footer>Generated with the RentLeaks app. Photos were captured in-app; timestamps and SHA-256 fingerprints were recorded at capture.
    Send this to your landlord on move-in day and keep a copy. RentLeaks does not hold deposits.</footer>
  </body></html>`;
}
