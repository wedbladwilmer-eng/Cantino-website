// Schemalagd funktion: startar ett nytt bygge kl. 10:30 svensk tid, måndag–fredag.
// Bygget hämtar då veckans lunch från kvartersmenyn (högst ett anrop per dag).
//
// Netlify anger scheman i UTC. 10:30 i Stockholm är 09:30 UTC på vintern (CET) och 08:30 UTC på
// sommaren (CEST). Funktionen körs därför båda tiderna, men startar bara ett bygge när klockan
// i Stockholm faktiskt är 10. Resultat: exakt ett bygge per vardag, hela året.

export const config = { schedule: "30 8,9 * * 1-5" };

export function arDags(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Stockholm", hour: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return p.hour === "10" && !["Sat", "Sun"].includes(p.weekday);
}

export default async () => {
  if (!arDags()) { console.log("[lunch] inte 10 i Stockholm just nu, inget bygge"); return new Response("skip"); }
  const hook = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!hook) { console.log("[lunch] NETLIFY_BUILD_HOOK_URL saknas"); return new Response("ingen hook", { status: 500 }); }
  const url = hook + (hook.includes("?") ? "&" : "?") + "trigger_title=" + encodeURIComponent("Veckans lunch (daglig)");
  const r = await fetch(url, { method: "POST", body: "lunch-dagligen" });
  console.log("[lunch] bygge startat, svar " + r.status); // hookens adress loggas aldrig
  return new Response("ok");
};
