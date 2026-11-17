const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/home/user/cantino/verify';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const w of [360, 390, 430, 540, 768, 1024, 1440, 1920]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    p.on('console', m => { if (m.type() === 'error' && !/google|maps|gstatic/.test(m.text())) errs.push(w + ': ' + m.text()); });
    p.on('pageerror', e => errs.push(w + ' pageerror: ' + e.message));
    await p.goto(URL, { waitUntil: 'networkidle' });
    // skrolla igenom för att trigga lazy load och reveal
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(900);
    const r = await p.evaluate(() => {
      const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
      const wide = [];
      document.querySelectorAll('body *').forEach(e => { const b = e.getBoundingClientRect(); if (b.width && (b.right > iw + 1 || b.left < -1)) { if (!e.closest('.tabs-scroll') && !e.closest('[hidden]') && getComputedStyle(e).position !== 'fixed') wide.push(e.tagName + '.' + e.className + ' ' + Math.round(b.left) + '..' + Math.round(b.right)); } });
      const txt = document.body.innerText; const br = (txt.match(/[^\n]*[\[\]][^\n]*/g) || []);
      return { sw, iw, ok: sw <= iw, wide: wide.slice(0, 6), brackets: br.slice(0, 5) };
    });
    console.log(w, r.ok ? 'OK' : 'ÖVERFLÖDE', r.sw, r.iw, r.wide.length ? JSON.stringify(r.wide) : '', r.brackets.length ? 'HAKPARENTES: ' + JSON.stringify(r.brackets) : '');
    if ([390, 768, 1440].includes(w)) await p.screenshot({ path: `${OUT}/hela-${w}.png`, fullPage: true });
    await p.close();
  }
  console.log(errs.length ? errs.join('\n') : 'inga konsolfel');
  await b.close();
})();
