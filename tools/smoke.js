const puppeteer = require('puppeteer-core');
const [,, q = '', shot = '/tmp/s.png'] = process.argv;
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  p.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); }); p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
  await p.goto('' + (process.env.NJ_URL || 'http://localhost:8000/') + '' + q, { waitUntil: 'networkidle0' }); await new Promise(r=>setTimeout(r,800));
  await p.screenshot({ path: shot }); await b.close();
})();
