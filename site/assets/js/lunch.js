/* Veckans lunch från ett publicerat Google-kalkylark (svar från ett Google-formulär).
   Rena funktioner först (testas i tools/test_lunch.js), sedan uppritningen i webbläsaren.
   All text från kalkylarket sätts med textContent, aldrig som HTML. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CantinoLunch = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DAGAR = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
  var DAY_MS = 86400000;

  /* ---------- CSV (RFC 4180) ----------
     Fält inom citattecken kan innehålla kommatecken, radbrytningar och "" (ett citattecken). */
  function parseCSV(text) {
    text = String(text || "");
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], field = "", i = 0, n = text.length, quoted = false, c;
    while (i < n) {
      c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === "") { quoted = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r" || c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
        i += (c === "\r" && text[i + 1] === "\n") ? 2 : 1;
        continue;
      }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (f) { return f.trim() !== ""; }); });
  }

  /* ---------- Datum och veckor (Europe/Stockholm) ---------- */
  function stockholmDate(date) {
    var p = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date || new Date()).forEach(function (x) { p[x.type] = x.value; });
    var y = +p.year, m = +p.month, d = +p.day;
    return { y: y, m: m, d: d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
  }
  // ISO 8601: veckan börjar på måndag, vecka 1 innehåller årets första torsdag.
  function isoWeek(y, m, d) {
    var dt = new Date(Date.UTC(y, m - 1, d)), day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    var year = dt.getUTCFullYear();
    return { year: year, week: Math.ceil(((dt - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7) };
  }
  // Måndagen i en ISO-vecka, som UTC-millisekunder.
  function isoMonday(year, week) {
    var jan4 = new Date(Date.UTC(year, 0, 4)), day = jan4.getUTCDay() || 7;
    return Date.UTC(year, 0, 4) - (day - 1) * DAY_MS + (week - 1) * 7 * DAY_MS;
  }

  // "2026-11-14 13.23.44" (svenskt Google-format) eller "2026-11-14 13:23:44". Annars null.
  function parseTimestamp(s) {
    var m = String(s || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  // "46", "v46", "Vecka 46" -> 46. Annars null.
  function parseWeek(s) {
    var m = String(s || "").match(/\d{1,2}/);
    var w = m ? +m[0] : NaN;
    return w >= 1 && w <= 53 ? w : null;
  }

  /* ---------- Text från formuläret ---------- */
  function cleanDish(s) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s ? s.charAt(0).toLocaleUpperCase("sv-SE") + s.slice(1) : "";
  }
  function dayLines(field) {
    return String(field || "").split(/\r\n|\r|\n/).map(cleanDish).filter(Boolean);
  }
  // Delar "Hemgjorda pannbiffar serveras med potatismos" i rättens namn och resten.
  // Bara vid tydliga skarvar; annars null och hela raden visas som den är.
  var SPLITS = [" serveras med ", " toppas med ", " toppad med "];
  function splitDish(s) {
    var at = -1;
    SPLITS.forEach(function (sep) { var i = s.indexOf(sep); if (i > 0 && (at < 0 || i < at)) at = i; });
    if (at < 0) at = s.indexOf(" med ");
    if (at < 3 || at > 60) return null;
    var head = s.slice(0, at).trim(), tail = s.slice(at + 1).trim();
    if (!head || tail.split(" ").length < 2) return null;
    return { head: head, tail: tail };
  }
  // "145:-", "145", "145kr" -> "145 kr". Annan text visas som den är.
  function normalizePrice(s) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (!s) return null;
    var m = s.match(/^(\d{2,4})\s*(?::-|kr\.?|sek|kronor)?$/i);
    return m ? m[1] + " kr" : s;
  }

  /* ---------- Kalkylarkets rader ---------- */
  function norm(h) { return String(h || "").trim().toLowerCase(); }
  function toEntries(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(norm);
    var col = function (name) { return head.indexOf(norm(name)); };
    var iTs = col("Tidstämpel"), iWeek = col("Vecka"), iPris = col("Pris");
    var iDays = DAGAR.map(col);
    if (iWeek < 0) return [];
    return rows.slice(1).map(function (r, idx) {
      return {
        order: idx,
        ts: iTs >= 0 ? parseTimestamp(r[iTs]) : null,
        week: parseWeek(r[iWeek]),
        pris: iPris >= 0 ? normalizePrice(r[iPris]) : null,
        days: DAGAR.map(function (name, k) { return { dag: name, ratter: iDays[k] >= 0 ? dayLines(r[iDays[k]]) : [] }; })
      };
    }).filter(function (e) { return e.week && e.days.some(function (d) { return d.ratter.length; }); });
  }

  /* Väljer menyn som ska visas.
     Vardag: den här veckan. Lördag och söndag: nästa vecka om den finns, annars den här.
     Flera svar för samma vecka: senaste tidstämpeln vinner (vid lika: raden längst ner).
     Ett svar räknas bara om det skickades in från tre veckor före veckan till och med veckans söndag,
     så att samma veckonummer från förra året aldrig visas som om det gällde nu. */
  function pickMenu(entries, now) {
    var t = stockholmDate(now), cur = isoWeek(t.y, t.m, t.d);
    var weekend = t.wd === 0 || t.wd === 6;
    var nextMon = isoMonday(cur.year, cur.week) + 7 * DAY_MS, nd = new Date(nextMon);
    var next = isoWeek(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
    var targets = weekend ? [next, cur] : [cur];
    for (var k = 0; k < targets.length; k++) {
      var w = targets[k], mon = isoMonday(w.year, w.week);
      var from = mon - 21 * DAY_MS, to = mon + 7 * DAY_MS;
      var best = null;
      entries.forEach(function (e) {
        if (e.week !== w.week) return;
        if (e.ts !== null && (e.ts < from || e.ts >= to)) return;
        var key = e.ts === null ? -Infinity : e.ts;
        var bestKey = best ? (best.ts === null ? -Infinity : best.ts) : null;
        if (!best || key > bestKey || (key === bestKey && e.order > best.order)) best = e;
      });
      if (best) return {
        entry: best, week: w.week, isNextWeek: w === next && weekend,
        todayIndex: (!weekend && w === cur) ? t.wd - 1 : -1
      };
    }
    return null;
  }

  /* ---------- Uppritning i webbläsaren ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function fetchCSV(url, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () { if (ctrl) ctrl.abort(); reject(new Error("timeout")); }, timeoutMs);
    });
    var req = fetch(url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
    return Promise.race([req, timeout]).then(function (v) { clearTimeout(timer); return v; }, function (e) { clearTimeout(timer); throw e; });
  }

  function renderMenu(box, menu, cfg) {
    var e = menu.entry;
    var wk = box.querySelector("[data-l=week]");
    wk.textContent = "Vecka " + menu.week; wk.hidden = false;
    box.querySelector("[data-l=sep]").hidden = false;
    box.querySelector("[data-l=price]").textContent = e.pris || cfg.pris;
    var note = box.querySelector("[data-l=note]");
    if (menu.isNextWeek) { note.textContent = "Menyn för nästa vecka"; note.hidden = false; }
    var list = box.querySelector("[data-l=days]");
    list.textContent = "";
    e.days.forEach(function (day, i) {
      var li = el("li", "day");
      var h = el("h3", null, day.dag);
      if (i === menu.todayIndex) { h.appendChild(el("span", "today", "I dag")); li.setAttribute("aria-current", "date"); }
      li.appendChild(h);
      if (!day.ratter.length) { li.appendChild(el("p", "closed", "Stängt")); }
      else {
        var ul = el("ul", "dishes");
        day.ratter.forEach(function (r) {
          var item = el("li", "dish-line"), parts = splitDish(r);
          if (parts) { item.appendChild(el("strong", null, parts.head)); item.appendChild(document.createTextNode(" " + parts.tail)); }
          else item.textContent = r;
          ul.appendChild(item);
        });
        li.appendChild(ul);
      }
      list.appendChild(li);
    });
  }

  function renderFallback(box, cfg) {
    var list = box.querySelector("[data-l=days]");
    list.textContent = "";
    var li = el("li", "fallback");
    li.appendChild(el("p", null, "Veckans lunch publiceras på måndag."));
    var a = el("a", "textlink", "Se menyn på kvartersmenyn.se");
    a.href = cfg.kvartersmenynUrl; a.target = "_blank"; a.rel = "noopener";
    var p = el("p"); p.appendChild(a); li.appendChild(p);
    list.appendChild(li);
  }

  function mount(box, cfg, now) {
    box.classList.add("is-loading");
    var done = function () { box.classList.remove("is-loading"); };
    return fetchCSV(cfg.csvUrl, cfg.timeoutMs || 5000)
      .then(function (text) {
        var menu = pickMenu(toEntries(parseCSV(text)), now || new Date());
        if (!menu) throw new Error("ingen meny för veckan");
        renderMenu(box, menu, cfg);
        box.dataset.state = "meny";
      })
      .catch(function (err) {
        renderFallback(box, cfg);
        box.dataset.state = "reserv";
        if (typeof console !== "undefined") console.info("Veckans lunch: reservläge (" + err.message + ")");
      })
      .then(done);
  }

  return {
    parseCSV: parseCSV, isoWeek: isoWeek, isoMonday: isoMonday, stockholmDate: stockholmDate,
    parseTimestamp: parseTimestamp, parseWeek: parseWeek, cleanDish: cleanDish, dayLines: dayLines,
    splitDish: splitDish, normalizePrice: normalizePrice, toEntries: toEntries, pickMenu: pickMenu,
    mount: mount
  };
});
