// Enhetstester för veckans lunch. Kör: node --test tools/test_lunch.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const L = require("../site/assets/js/lunch.js");

const vecka46 = fs.readFileSync(path.join(__dirname, "testdata/vecka46.csv"), "utf8");
// Ett klockslag i Stockholm, som Date
const sthlm = (iso) => new Date(iso + "+01:00");

test("CSV: kommatecken, citattecken, radbrytningar, CRLF och BOM", () => {
  const csv = '﻿a,b,c\r\n"x, y","rad 1\nrad 2","säger ""hej"""\r\n,,\r\n"",tom,\n';
  assert.deepEqual(L.parseCSV(csv), [
    ["a", "b", "c"],
    ["x, y", "rad 1\nrad 2", 'säger "hej"'],
    ["", "tom", ""],
  ]);
});

test("CSV: riktiga vecka 46 ger rubrik + en rad, 4–5 rätter per dag", () => {
  const rows = L.parseCSV(vecka46);
  assert.deepEqual(rows[0], ["Tidstämpel", "Vecka", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Pris"]);
  assert.equal(rows.length, 2);
  const e = L.toEntries(rows)[0];
  assert.equal(e.week, 46);
  assert.equal(e.pris, "145 kr");
  assert.deepEqual(e.days.map((d) => d.ratter.length), [4, 5, 4, 4, 4]);
  assert.equal(e.days[0].ratter[0], "Hemgjorda pannbiffar serveras med potatismos, gräddsås, rårörda lingon och inlagd gurka");
  // Gemen första bokstav blir versal, stavning rörs inte
  assert.equal(e.days[4].ratter[1], "Panerad rödspätta serveras med kokt potatis, kall citronsås, gröna ärtor och citron");
  assert.ok(e.days[1].ratter[3].endsWith("färsk persiljacc"));
});

test("Text: mellanslag, tomma rader och versal", () => {
  assert.deepEqual(L.dayLines("  panerad   rödspätta \n\n   \n älg  med  sås  "), ["Panerad rödspätta", "Älg med sås"]);
  assert.equal(L.cleanDish("   "), "");
});

test("Delning av rättens namn: bara vid säkra skarvar", () => {
  assert.deepEqual(L.splitDish("Hemgjorda pannbiffar serveras med potatismos"), { head: "Hemgjorda pannbiffar", tail: "serveras med potatismos" });
  assert.deepEqual(L.splitDish("Pasta med kyckling i krämig currysås toppas med färsk persilja"), { head: "Pasta med kyckling i krämig currysås", tail: "toppas med färsk persilja" });
  assert.deepEqual(L.splitDish("Ugnsbakad laxfilé med kokt potatis, ärtor"), { head: "Ugnsbakad laxfilé", tail: "med kokt potatis, ärtor" });
  assert.deepEqual(L.splitDish("Spaghetti Bolognese toppas med parmesanost"), { head: "Spaghetti Bolognese", tail: "toppas med parmesanost" });
  assert.equal(L.splitDish("Dagens soppa"), null);
  assert.equal(L.splitDish("Med kärlek"), null);
  assert.deepEqual(L.splitDish("Fisk med ris"), { head: "Fisk", tail: "med ris" });
  assert.equal(L.splitDish("Lax med"), null); // inget efter skarven
});

test("Pris", () => {
  assert.equal(L.normalizePrice("145:-"), "145 kr");
  assert.equal(L.normalizePrice(" 150 kr "), "150 kr");
  assert.equal(L.normalizePrice("145"), "145 kr");
  assert.equal(L.normalizePrice(""), null);
  assert.equal(L.normalizePrice("145 kr inkl. dryck"), "145 kr inkl. dryck");
});

test("ISO-vecka", () => {
  assert.deepEqual(L.isoWeek(2026, 11, 14), { year: 2026, week: 46 });
  assert.deepEqual(L.isoWeek(2026, 11, 16), { year: 2026, week: 47 });
  assert.deepEqual(L.isoWeek(2027, 1, 1), { year: 2026, week: 53 });
  assert.deepEqual(L.isoWeek(2021, 1, 3), { year: 2020, week: 53 });
  // Söndag 23.30 i Stockholm är fortfarande samma vecka trots att UTC-datumet är detsamma
  const t = L.stockholmDate(new Date("2026-11-15T23:30:00+01:00"));
  assert.deepEqual([t.y, t.m, t.d, t.wd], [2026, 11, 15, 0]);
});

const head = "Tidstämpel,Vecka,Måndag,Tisdag,Onsdag,Torsdag,Fredag,Pris\n";
const rad = (ts, v, mon, pris = "") => `${ts},${v},"${mon}",b,c,d,e,${pris}\n`;

test("Val: aktuell vecka finns (onsdag) och dagens dag markeras", () => {
  const m = L.pickMenu(L.toEntries(L.parseCSV(vecka46)), sthlm("2026-11-11T12:00:00"));
  assert.equal(m.week, 46);
  assert.equal(m.todayIndex, 2);
  assert.equal(m.isNextWeek, false);
});

test("Val: aktuell vecka saknas ger null", () => {
  assert.equal(L.pickMenu(L.toEntries(L.parseCSV(vecka46)), sthlm("2026-11-25T12:00:00")), null);
});

test("Val: två svar för samma vecka, det senaste vinner (även om det står först)", () => {
  const csv = head + rad("2026-11-12 09.00.00", 46, "Rättad meny") + rad("2026-11-09 08.00.00", 46, "Första menyn");
  assert.equal(L.pickMenu(L.toEntries(L.parseCSV(csv)), sthlm("2026-11-12T12:00:00")).entry.days[0].ratter[0], "Rättad meny");
});

test("Val: helg visar nästa vecka om den finns, annars den här", () => {
  const csv = head + rad("2026-11-09 08.00.00", 46, "Vecka 46") + rad("2026-11-13 15.00.00", 47, "Vecka 47");
  const lor = sthlm("2026-11-14T10:00:00");
  const m = L.pickMenu(L.toEntries(L.parseCSV(csv)), lor);
  assert.equal(m.week, 47); assert.equal(m.isNextWeek, true); assert.equal(m.todayIndex, -1);
  const m2 = L.pickMenu(L.toEntries(L.parseCSV(head + rad("2026-11-09 08.00.00", 46, "Vecka 46"))), lor);
  assert.equal(m2.week, 46); assert.equal(m2.isNextWeek, false); assert.equal(m2.todayIndex, -1);
});

test("Val: samma veckonummer från förra året visas aldrig", () => {
  const csv = head + rad("2025-11-10 08.00.00", 46, "Förra året");
  assert.equal(L.pickMenu(L.toEntries(L.parseCSV(csv)), sthlm("2026-11-11T12:00:00")), null);
});

test("Tomma dagar blir tomma listor, helt tomma svar ignoreras", () => {
  const csv = head + '2026-11-09 08.00.00,46,"Köttbullar","",  ,"",Fisk,\n2026-11-10 08.00.00,46,,,,,,\n';
  const es = L.toEntries(L.parseCSV(csv));
  assert.equal(es.length, 1);
  assert.deepEqual(es[0].days.map((d) => d.ratter.length), [1, 0, 0, 0, 1]);
  assert.equal(es[0].pris, null);
});
