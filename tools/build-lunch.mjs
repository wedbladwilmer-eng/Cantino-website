// Byggsteg på Netlify: hämtar veckans lunch från kvartersmenyns API och skriver site/data/lunch.json.
//
// Regler från kvartersmenyn: högst ETT anrop per dag, och nyckeln får aldrig hamna i webbläsaren.
// - Nyckel och kund-id läses bara från miljövariablerna KVARTERSMENYN_API_KEY och KVARTERSMENYN_CUSTOMER_ID.
// - Nyckeln skrivs aldrig ut: allt som loggas eller sparas tvättas från nyckel och kund-id.
// - Bygget misslyckas aldrig på grund av lunchen. Vid fel skrivs en lunch.json med status "saknas".
// - Anrop görs bara (a) i det schemalagda bygget (build hook med texten "lunch-dagligen"),
//   (b) om sajten ännu inte har någon lunch.json, eller (c) om LUNCH_HAMTA=ja är satt.
//   Har dagens hämtning redan gjorts återanvänds den publicerade filen, oavsett vad som startade bygget.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMenu, describe } from "./kvartersmenyn.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "site/data/lunch.json");
const STRUKTUR = path.join(ROOT, "site/data/kvartersmenyn-struktur.json");
const KEY = process.env.KVARTERSMENYN_API_KEY || "";
const CUSTOMER = process.env.KVARTERSMENYN_CUSTOMER_ID || "";
const SITE_URL = process.env.URL || "https://cantino-restaurang.netlify.app";

// Tar bort nyckel och kund-id ur all text som loggas eller sparas.
export function tvatta(s) {
  let t = String(s);
  for (const hemligt of [KEY, CUSTOMER, encodeURIComponent(KEY)]) if (hemligt) t = t.split(hemligt).join("***");
  return t;
}
const logg = (...a) => console.log("[lunch]", ...a.map(tvatta));

export function stockholmIdag(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

async function hamtaJson(url, ms) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } }); return { status: r.status, text: await r.text() }; }
  finally { clearTimeout(t); }
}

async function skriv(data) {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, tvatta(JSON.stringify(data, null, 2)) + "\n");
  logg(`skrev data/lunch.json: status=${data.status}${data.vecka ? ", vecka " + data.vecka : ""}`);
}

async function main() {
  const idag = stockholmIdag();
  const schemalagt = /lunch-dagligen/.test(process.env.INCOMING_HOOK_BODY || "");
  const tvinga = process.env.LUNCH_HAMTA === "ja";

  // Den publicerade filen (samma domän, inte kvartersmenyn)
  let tidigare = null;
  try { const r = await hamtaJson(SITE_URL + "/data/lunch.json", 8000); if (r.status === 200) tidigare = JSON.parse(r.text); } catch {}

  if (tidigare && tidigare.hamtad_datum === idag) { logg("dagens hämtning är redan gjord, återanvänder den"); return skriv(tidigare); }
  if (tidigare && !schemalagt && !tvinga) { logg("inget schemalagt bygge, återanvänder senaste hämtningen (" + tidigare.hamtad_datum + ")"); return skriv(tidigare); }

  const grund = { version: 1, kalla: "kvartersmenyn", hamtad: new Date().toISOString(), hamtad_datum: idag };
  if (!KEY || !CUSTOMER) { logg("KVARTERSMENYN_API_KEY eller KVARTERSMENYN_CUSTOMER_ID saknas, ingen hämtning"); return skriv({ ...grund, status: "saknas", orsak: "konfiguration" }); }

  const url = `https://www.kvartersmenyn.se/api_rest/get_menu/api_key/${encodeURIComponent(KEY)}/customer_id/${encodeURIComponent(CUSTOMER)}`;
  let svar;
  try { svar = await hamtaJson(url, 15000); }
  catch (e) { logg("nätverksfel: " + (e.name === "AbortError" ? "tidsgräns" : e.message)); return skriv({ ...grund, status: "saknas", orsak: "natverk" }); }
  logg(`kvartersmenyn svarade ${svar.status}, ${svar.text.length} tecken`);

  let json = null;
  try { json = JSON.parse(svar.text); } catch { logg("svaret är inte JSON"); }

  // Anonymiserad beskrivning av strukturen (fältnamn, typer och början av texterna), utan nyckel och kund-id
  if (json) {
    const struktur = { http_status: svar.status, hamtad: grund.hamtad, struktur: describe(json) };
    await fs.writeFile(STRUKTUR, tvatta(JSON.stringify(struktur, null, 2)) + "\n");
    logg("struktur sparad i data/kvartersmenyn-struktur.json");
  }

  const meny = svar.status === 200 && json ? parseMenu(json) : null;
  if (!meny) return skriv({ ...grund, status: "saknas", orsak: svar.status === 404 ? "ingen-meny" : "tolkning", http_status: svar.status });
  return skriv({ ...grund, status: "meny", ...meny });
}

main().catch((e) => {
  // Bygget får aldrig falla på lunchen
  console.log("[lunch] oväntat fel: " + tvatta(e && e.message));
  return skriv({ version: 1, status: "saknas", orsak: "fel", hamtad: new Date().toISOString(), hamtad_datum: stockholmIdag() }).catch(() => {});
});
