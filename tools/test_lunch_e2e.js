// Webbläsartester för veckans lunch. Kör: node tools/test_lunch_e2e.js [ut-mapp för skärmdumpar]
// Startar en lokal server för site/, styr datum med page.clock och nätverket med page.route.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");

const PORT = 8790, BASE = `http://localhost:${PORT}/`;
const OUT = process.argv[2] || path.join(__dirname, "..", "verify", "lunch");
const VECKA46 = fs.readFileSync(path.join(__dirname, "testdata/vecka46.csv"), "utf8");
const HEAD = "Tidstämpel,Vecka,Måndag,Tisdag,Onsdag,Torsdag,Fredag,Pris\n";
const SHEET = "**/spreadsheets/**";

const csvResponse = (body) => ({ status: 200, headers: { "content-type": "text/csv; charset=utf-8", "access-control-allow-origin": "*" }, body });

async function shoot(page, file) {
  await page.evaluate(async () => {
    const img = document.querySelector(".lunch-photo img"); img.loading = "eager";
    if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r; });
    document.querySelector("#site-header").style.visibility = "hidden";
  });
  // Helsideskärmdump beskuren till avsnittet (elementskärmdumpar av höga avsnitt ritar inte alltid ut bilder)
  const r = await page.evaluate(() => { const b = document.querySelector("#lunch").getBoundingClientRect(); return { x: 0, y: b.top + scrollY, width: document.documentElement.clientWidth, height: b.height }; });
  await page.screenshot({ path: file, fullPage: true, clip: r });
}
async function open(browser, { width = 1440, time, route, scale = 1 }) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: scale });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  if (time) await page.clock.setFixedTime(new Date(time));
  if (route) await page.route(SHEET, route);
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const b = document.querySelector("#lunch-box"); return b && b.dataset.state !== "laddar"; }, null, { timeout: 15000 });
  const ms = Date.now() - t0;
  const info = await page.evaluate(() => {
    const b = document.querySelector("#lunch-box");
    return {
      state: b.dataset.state,
      week: b.querySelector("[data-l=week]").hidden ? null : b.querySelector("[data-l=week]").textContent,
      price: b.querySelector("[data-l=price]").textContent,
      note: b.querySelector("[data-l=note]").hidden ? null : b.querySelector("[data-l=note]").textContent,
      days: [...b.querySelectorAll(".day")].map((d) => ({
        dag: d.querySelector("h3").firstChild.textContent,
        today: !!d.querySelector(".today"),
        ratter: [...d.querySelectorAll(".dish-line")].map((x) => x.textContent),
        bold: [...d.querySelectorAll(".dish-line strong")].map((x) => x.textContent),
        closed: !!d.querySelector(".closed"),
      })),
      text: b.querySelector("[data-l=days]").innerText,
      imgs: b.querySelectorAll("[data-l=days] img").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  return { page, errors, info, ms };
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(["OK  ", name]); }
  catch (e) { results.push(["FEL ", name + "\n      " + e.message.split("\n").slice(0, 6).join("\n      ")]); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(__dirname, "serve.js"), String(PORT)], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const browser = await chromium.launch();
  const fixture = (body) => (route) => route.fulfill(csvResponse(body));

  await check("Aktuell vecka finns (onsdag v46): 5 dagar, onsdag markerad, pris från formuläret", async () => {
    const { page, errors, info } = await open(browser, { time: "2026-11-11T12:00:00+01:00", route: fixture(VECKA46) });
    assert.equal(info.state, "meny"); assert.equal(info.week, "Vecka 46"); assert.equal(info.price, "145 kr");
    assert.deepEqual(info.days.map((d) => d.dag), ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"]);
    assert.deepEqual(info.days.map((d) => d.today), [false, false, true, false, false]);
    assert.deepEqual(info.days.map((d) => d.ratter.length), [4, 5, 4, 4, 4]);
    assert.equal(info.days[0].bold[0], "Hemgjorda pannbiffar");
    assert.ok(info.days[4].ratter[1].startsWith("Panerad rödspätta"));
    assert.equal(info.overflow, 0); assert.deepEqual(errors, []);
    await page.close();
  });

  await check("Aktuell vecka saknas (v48): reservläge, ingen gammal meny", async () => {
    const { page, errors, info } = await open(browser, { time: "2026-11-25T12:00:00+01:00", route: fixture(VECKA46) });
    assert.equal(info.state, "reserv"); assert.match(info.text, /Veckans lunch publiceras på måndag\./); assert.equal(info.week, null);
    assert.equal(info.days.length, 0); assert.ok(!/pannbiffar/i.test(info.text));
    assert.deepEqual(errors, []);
    await page.close();
  });

  await check("Två svar för samma vecka: det senaste vinner, pris från formuläret skriver över", async () => {
    const csv = HEAD + '2026-11-12 09.15.00,46,"Rättad måndag",b,c,d,e,150\n2026-11-09 07.00.00,46,"Första måndag",b,c,d,e,145\n';
    const { page, info } = await open(browser, { time: "2026-11-12T12:00:00+01:00", route: fixture(csv) });
    assert.equal(info.days[0].ratter[0], "Rättad måndag"); assert.equal(info.price, "150 kr");
    await page.close();
  });

  await check("Helg med nästa veckas meny: lördag visar v47, ingen dag markerad", async () => {
    const csv = VECKA46.trimEnd() + '\n2026-11-14 15.00.00,47,"Köttbullar med potatismos",b,c,d,e,\n';
    const { page, info } = await open(browser, { time: "2026-11-14T10:00:00+01:00", route: fixture(csv) });
    assert.equal(info.week, "Vecka 47"); assert.equal(info.note, "Menyn för nästa vecka");
    assert.ok(info.days.every((d) => !d.today)); assert.equal(info.price, "145 kr");
    await page.close();
  });

  await check("Helg utan nästa veckas meny: söndag visar v46", async () => {
    const { page, info } = await open(browser, { time: "2026-11-15T18:00:00+01:00", route: fixture(VECKA46) });
    assert.equal(info.week, "Vecka 46"); assert.equal(info.note, null); assert.ok(info.days.every((d) => !d.today));
    await page.close();
  });

  await check("Tomma dagar visas som Stängt", async () => {
    const csv = HEAD + '2026-11-09 07.00.00,46,"Pannbiff med potatis","","   ",Fisk,Pasta,\n';
    const { page, info } = await open(browser, { time: "2026-11-11T12:00:00+01:00", route: fixture(csv) });
    assert.deepEqual(info.days.map((d) => d.closed), [false, true, true, false, false]);
    await page.close();
  });

  await check("Hämtningen misslyckas (nätverket blockerat): reservläge", async () => {
    const { page, info } = await open(browser, { time: "2026-11-11T12:00:00+01:00", route: (r) => r.abort("failed") });
    assert.equal(info.state, "reserv"); assert.match(info.text, /publiceras på måndag/);
    await page.close();
  });

  await check("Hämtningen tar över 5 sekunder: reservläge efter cirka 5 s", async () => {
    const slow = async (r) => { await new Promise((x) => setTimeout(x, 7000)); try { await r.fulfill(csvResponse(VECKA46)); } catch (e) {} };
    const { page, info, ms } = await open(browser, { time: "2026-11-11T12:00:00+01:00", route: slow });
    assert.equal(info.state, "reserv"); assert.ok(ms >= 4500 && ms < 6900, "tog " + ms + " ms");
    await page.close();
  });

  await check("Text från kalkylarket sätts som text, aldrig som HTML", async () => {
    const csv = HEAD + '2026-11-09 07.00.00,46,"<img src=x onerror=""document.title=\'hackad\'""> serveras med <b>sås</b>",b,c,d,e,\n';
    const { page, info } = await open(browser, { time: "2026-11-11T12:00:00+01:00", route: fixture(csv) });
    assert.equal(info.imgs, 0); assert.match(info.days[0].ratter[0], /<img src=x/);
    assert.notEqual(await page.title(), "hackad");
    await page.close();
  });

  await check("Laddning: höjden är reserverad (sidan nedanför flyttar sig inte mycket)", async () => {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.clock.setFixedTime(new Date("2026-11-11T12:00:00+01:00"));
      let release; const gate = new Promise((r) => (release = r));
      await page.route(SHEET, async (r) => { await gate; await r.fulfill(csvResponse(VECKA46)); });
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#lunch-box.is-loading .loading");
      const before = await page.evaluate(() => document.querySelector(".food-row").getBoundingClientRect().top + scrollY);
      release();
      await page.waitForFunction(() => document.querySelector("#lunch-box").dataset.state === "meny");
      const after = await page.evaluate(() => document.querySelector(".food-row").getBoundingClientRect().top + scrollY);
      const shift = Math.abs(after - before);
      results.push(["    ", `  ${width}px: innehållet nedanför flyttade sig ${Math.round(shift)} px vid laddning`]);
      assert.ok(shift < 200, width + "px: hoppade " + shift + " px");
      await page.close();
    }
  });

  await check("Ingen horisontell scroll 300–1920 px med riktig vecka 46", async () => {
    const page = await browser.newPage();
    await page.clock.setFixedTime(new Date("2026-11-11T12:00:00+01:00"));
    await page.route(SHEET, fixture(VECKA46));
    const bad = [];
    for (let w = 300; w <= 1920; w += 40) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelector("#lunch-box").dataset.state === "meny");
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > 0) bad.push(w + ":" + o);
    }
    assert.deepEqual(bad, []);
    await page.close();
  });

  // Skärmdumpar: riktig data (hämtas från Google på riktigt) och reservläge
  for (const width of [1440, 390]) {
    const live = await open(browser, { width, scale: 2 });
    results.push(["    ", `  ${width}px riktig hämtning: ${live.info.state}, ${live.info.week}, ${live.ms} ms, fel: ${live.errors.length ? live.errors.join(" | ") : "inga"}`]);
    await shoot(live.page, path.join(OUT, `lunch-riktig-${width}.png`));
    await live.page.close();
    const fb = await open(browser, { width, scale: 2, time: "2026-11-11T12:00:00+01:00", route: (r) => r.abort("failed") });
    await shoot(fb.page, path.join(OUT, `lunch-reserv-${width}.png`));
    await fb.page.close();
    const wd = await open(browser, { width, scale: 2, time: "2026-11-11T12:00:00+01:00", route: fixture(VECKA46) });
    await shoot(wd.page, path.join(OUT, `lunch-onsdag-${width}.png`));
    await wd.page.close();
  }

  await browser.close(); server.kill();
  for (const [s, n] of results) console.log(s + n);
  const failed = results.filter(([s]) => s.startsWith("FEL")).length;
  console.log(failed ? `\n${failed} test misslyckades` : "\nAlla test gick igenom");
  process.exit(failed ? 1 : 0);
})();
