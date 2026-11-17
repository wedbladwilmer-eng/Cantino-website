  "use strict";
  var TZ = "Europe/Stockholm";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var getJSON = function (name) { return fetch("/data/" + name + ".json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(name); return r.json(); }); };
  function stockholmNow() {
    var p = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    var y = +p.year, m = +p.month, d = +p.day;
    return { y: y, m: m, d: d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), t: +p.hour + (+p.minute) / 60 };
  }
  var now = stockholmNow();

  /* ---- Header: blir mörk när man skrollar förbi heron ---- */
  var header = $("#site-header");
  if (header && !document.body.classList.contains("page-sub")) {
    var onScroll = function () { header.classList.toggle("is-solid", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---- Mobilmeny ---- */
  var menu = $("#mobile-menu"), openBtn = $("#menu-open"), closeBtn = $("#menu-close");
  function setMenu(open) {
    menu.hidden = !open; openBtn.setAttribute("aria-expanded", String(open));
    document.documentElement.style.overflow = open ? "hidden" : "";
    (open ? closeBtn : openBtn).focus();
  }
  if (menu) {
  openBtn.addEventListener("click", function () { setMenu(true); });
  closeBtn.addEventListener("click", function () { setMenu(false); });
  menu.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (menu.hidden) return;
    if (e.key === "Escape") setMenu(false);
    if (e.key === "Tab") {
      var f = menu.querySelectorAll("a, button"); var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.matchMedia("(min-width: 1000px)").addEventListener("change", function (m) { if (m.matches && !menu.hidden) setMenu(false); });
  }

  /* ---- Länkar och inställningar från data/site.json ---- */
  var site = { formular: "", lankar: {} };
  var siteReady = getJSON("site").then(function (s) {
    site = s;
    document.querySelectorAll("[data-link]").forEach(function (a) { var u = (s.lankar || {})[a.dataset.link]; if (u) a.href = u; });
  }).catch(function () {});

  /* ---- Kvällsmenyn: ritar en kategori ---- */
  function renderCategory(cat, max) {
    var box = el("div", "menu-cat");
    box.appendChild(el("h3", null, cat.namn));
    if (cat.notis) box.appendChild(el("p", "notis", cat.notis));
    var n = 0;
    cat.ratter.forEach(function (r) {
      if (max && n >= max) return;
      if (r.rubrik) { box.appendChild(el("p", "sub", r.rubrik)); return; }
      n++;
      var d = el("div", "dish");
      var name = el("p", "name", r.namn);
      if (r.vegetarisk) name.appendChild(el("span", "tag", "Veg"));
      if (r.husets) name.appendChild(el("span", "tag", "Husets"));
      d.appendChild(name);
      d.appendChild(el("p", "price", r.pris));
      if (r.beskrivning) d.appendChild(el("p", "desc", r.beskrivning));
      box.appendChild(d);
    });
    return box;
  }
