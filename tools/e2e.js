const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8766/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const log = (ok, msg) => console.log((ok ? 'OK   ' : 'FEL  ') + msg);
  await p.goto(URL, { waitUntil: 'networkidle' });
  // Ring-länkar
  const tels = await p.$$eval('a[href^="tel:"]', a => [...new Set(a.map(x => x.getAttribute('href')))]);
  log(tels.length === 1 && tels[0] === 'tel:+46760292626', 'Ring-länkar: ' + tels.join(', '));
  // Hamburgermeny
  await p.click('#menu-open'); log(await p.isVisible('#mobile-menu'), 'Hamburgermeny öppnas');
  await p.keyboard.press('Escape'); log(await p.isHidden('#mobile-menu'), 'Stängs med Escape');
  await p.click('#menu-open'); await p.click('#mobile-menu a[href="#meny"]');
  await p.waitForTimeout(700); log(await p.isHidden('#mobile-menu'), 'Länk i menyn stänger menyn och hoppar till Meny');
  // Menyflikar
  await p.click('#tab-pizza'); await p.waitForTimeout(500);
  log(await p.getAttribute('#tab-pizza', 'aria-selected') === 'true' && await p.isVisible('#p-pizza') && await p.isVisible('#menu-photo svg.pizza-art'), 'Fliken Pizza visar pizzor och pizzabild');
  await p.focus('#tab-pizza'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
  log(await p.getAttribute('#tab-desserter', 'aria-selected') === 'true' && await p.evaluate(() => document.activeElement.id) === 'tab-desserter', 'Piltangent höger flyttar till Desserter');
  const img = await p.getAttribute('#menu-photo img', 'src'); log(/vin-/.test(img || ''), 'Bilden byts med fliken: ' + img);
  const tabsW = await p.$eval('.tabs-scroll', e => [e.scrollWidth, e.clientWidth]); log(tabsW[0] > tabsW[1], 'Flikraden skrollar i sidled i egen rad (' + tabsW.join(' > ') + ')');
  // Åtgärdsrad
  await p.evaluate(() => window.scrollTo(0, 3000)); await p.waitForTimeout(300); await p.evaluate(() => window.scrollBy(0, 600)); await p.waitForTimeout(500);
  log(await p.$eval('#action-bar', e => e.classList.contains('is-hidden')), 'Åtgärdsraden döljs vid skroll nedåt');
  await p.evaluate(() => window.scrollBy(0, -400)); await p.waitForTimeout(500);
  log(!(await p.$eval('#action-bar', e => e.classList.contains('is-hidden'))), 'Visas igen vid skroll uppåt');
  // Formulär: validering
  await p.click('#f-submit'); await p.waitForTimeout(300);
  const errs = await p.$$eval('.field-error:not([hidden])', e => e.map(x => x.textContent));
  log(errs.length === 6, 'Tomt formulär ger ' + errs.length + ' svenska felmeddelanden: ' + errs[0]);
  await p.fill('#f-email', 'fel-adress'); await p.click('#f-submit');
  log((await p.textContent('#e-email')).includes('giltig'), 'Ogiltig e-post: ' + await p.textContent('#e-email'));
  // Länkar
  const links = await p.$$eval('[data-link]', a => a.map(x => x.dataset.link + '=' + x.href));
  console.log('     Externa länkar:', [...new Set(links)].join(' | '));
  log(await p.$eval('.map iframe', f => f.src.includes('google.com/maps') && f.loading === 'lazy' && !!f.title), 'Kartan är en Google Maps-iframe med lazy och title');
  // Hakparenteser
  const br = await p.evaluate(() => (document.body.innerText.match(/[\[\]]/g) || []).length); log(br === 0, 'Hakparenteser i synlig text: ' + br);
  await b.close();
})();
