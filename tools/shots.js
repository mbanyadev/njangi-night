// Plays one full game with animations on, screenshots each phase once, checks errors + overflow.
// Usage: node shots.js lang outdir [seed] [extra-query]
const puppeteer = require('puppeteer-core');
const [,, LANG = 'en', OUT = '/tmp/shots', SEED = '7', EXTRA = ''] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('' + (process.env.NJ_URL || 'http://localhost:8000/') + '?lang=' + LANG + '&seed=' + SEED + EXTRA, { waitUntil: 'networkidle0' });
  await p.evaluate(() => localStorage.clear());
  await sleep(1200); let n = 0; const seen = {}; const warn = [];
  const shot = async (name) => { await p.screenshot({ path: `${OUT}/${LANG}-${String(++n).padStart(2, '0')}-${name}.png` }); };
  await shot('title');
  await p.click('#btn-play'); await sleep(900);
  let guard = 0;
  while (guard++ < 400) {
    await sleep(350);
    if (await p.$('.end-card')) { await sleep(2600); await shot('end'); const ov = await p.$eval('.end-card', (e) => e.scrollHeight - e.clientHeight); if (ov > 2) warn.push('end-card overflow ' + ov); break; }
    const info = await p.evaluate(() => { const P = document.querySelector('#panel'); if (P.classList.contains('hidden')) return null; const S = window.__njangi.state; return { ph: P.dataset.phase, m: S.month, ov: P.scrollHeight - P.clientHeight, wide: [...P.querySelectorAll('*')].some((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'visible' && e.clientWidth > 0 && !['INPUT'].includes(e.tagName)) }; });
    if (!info) continue;
    if (info.ov > 2) warn.push(`panel overflow ${info.ov}px in ${info.ph} m${info.m}`);
    const key = info.ph; if (!seen[key] || (['event', 'auction', 'winner', 'eventResult', 'payday'].includes(key) && seen[key] < 2)) { seen[key] = (seen[key] || 0) + 1; await sleep(500); await shot(key + '-m' + info.m); }
    const P = '#panel';
    const click = async (sel) => { const e = await p.$(P + ' ' + sel); if (e) { await e.click(); return true; } return false; };
    if (info.ph === 'plan') { await click('[data-a=auto]'); await sleep(200); await click('[data-act=plan-done]'); continue; }
    if (info.ph === 'event') { const c = await p.$$(P + ' .choice:not([disabled])'); await c[Math.min(1, c.length - 1)].click(); continue; }
    if (info.ph === 'bill') { (await click('.choice[data-v=jar]:not([disabled])')) || (await click('.choice[data-v=cash]:not([disabled])')) || (await click('.choice[data-v=loan]')); continue; }
    if (info.ph === 'contribute') { (await click('[data-v=pay]')) || (await click('[data-v=cover]')); await sleep(2600); if (!seen.needs) { seen.needs = 1; await shot('needs'); } continue; }
    if (info.ph === 'auction') { if (info.m === 2) { await p.$eval('#bid', (r) => { r.value = 17000; r.dispatchEvent(new Event('input')); }); await sleep(300); await shot('bid'); await click('#b-bid'); } else await click('#b-pass'); await sleep(2900); await shot('reveal-m' + info.m); continue; }
    if (info.ph === 'potyours') { if (await click('.choice[data-v=machine]:not([disabled])')) { await sleep(1300); await shot('machine'); } await click('[data-act=done]'); continue; }
    (await click('.btn.primary')) || (await click('.btn'));
  }
  const fin = await p.evaluate(() => { const r = window.__njangi.results(); return { stars: r.nStars, net: r.net }; });
  console.log(LANG, JSON.stringify(fin), 'shots', n, 'ERRORS:', errs.length ? errs : 'none', 'WARN:', warn.length ? [...new Set(warn)] : 'none');
  await b.close();
})();
