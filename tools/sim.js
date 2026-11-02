// Balance sim: plays N fast games per strategy in headless Chrome. Usage: node sim.js [N] [cfg]
const puppeteer = require('puppeteer-core');
const [,, N = '60', CFGV = ''] = process.argv;
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const out = {};
  for (const strat of ['passive', 'smart', 'reckless', 'random']) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${process.env.NJ_URL || 'http://localhost:8000/'}?fast&seed=1${CFGV ? '&cfg=' + CFGV : ''}`, { waitUntil: 'networkidle0' });
    const res = await p.evaluate(async (strat, N) => {
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const SENS = { goodmonth: 1, scam: 2, credit: 1, festive: 1, wedding: 1, phone: 0, funeral: 0, doubler: 1, family: 1, malaria: 0, eneo: 0, rent: 1, machinebreak: 0 };
      const rnd = Math.random;
      const games = [];
      document.querySelector('#btn-play').click();
      for (let g = 0; g < N; g++) {
        let guard = 0;
        while (!document.querySelector('.end-card') && guard++ < 3000) {
          await tick();
          const P = document.querySelector('#panel'); if (P.classList.contains('hidden')) continue;
          const ph = P.dataset.phase, S = window.__njangi.state;
          const en = [...P.querySelectorAll('.choice:not([disabled])')];
          const clk = (sel) => { const e = P.querySelector(sel); if (e) e.click(); return !!e; };
          if (ph === 'plan') { if (strat !== 'reckless') clk('[data-a=auto]'); clk('[data-act=plan-done]'); continue; }
          if (ph === 'event') { const id = [...S.used].pop(); let i = strat === 'random' ? Math.floor(rnd() * en.length) : strat === 'reckless' ? 0 : SENS[id]; (en[i] || en[0]).click(); continue; }
          if (ph === 'bill') { const v = strat === 'reckless' ? 'loan' : (P.querySelector('.choice[data-v=jar]:not([disabled])') ? 'jar' : P.querySelector('.choice[data-v=cash]:not([disabled])') ? 'cash' : 'loan'); clk(`.choice[data-v=${v}]`); continue; }
          if (ph === 'contribute') { clk('[data-v=pay]') || clk(strat === 'random' && rnd() < .5 ? '[data-v=default]' : '[data-v=cover]'); continue; }
          if (ph === 'auction') {
            let bid = 0; const fire = document.querySelectorAll('.bubble .need.high').length;
            if (strat === 'smart' && S.month <= 3) bid = fire ? 17000 : 11000;
            if (strat === 'reckless') bid = 18000;
            if (strat === 'random' && rnd() < .35) bid = 1000 * Math.floor(rnd() * 19);
            if (bid) { const r = P.querySelector('#bid'); r.value = bid; r.dispatchEvent(new Event('input')); clk('#b-bid'); } else clk('#b-pass');
            continue;
          }
          if (ph === 'potyours') { if (!clk('.choice[data-v=machine]:not([disabled])')) { if (strat !== 'reckless') clk('.choice[data-v=debt]:not([disabled])'); clk('[data-act=done]'); } continue; }
          clk('.btn.primary') || clk('.btn');
        }
        const r = window.__njangi.results(), S = window.__njangi.state;
        games.push({ stars: r.nStars, net: r.net, won: S.wonMonth, bid: S.wonBid, mach: S.machine ? S.machineMonth : 0, debt: S.debt + S.owed, jar: S.jar, trust: S.trust, on: r.stars.map((s) => +s.on).join('') });
        document.querySelector('#btn-again').click(); await tick();
      }
      return games;
    }, strat, Number(N));
    const avg = (f) => (res.reduce((a, g) => a + f(g), 0) / res.length);
    const dist = [0, 1, 2, 3, 4].map((k) => res.filter((g) => g.stars === k).length);
    const goalRate = [0, 1, 2, 3].map((i) => Math.round(100 * avg((g) => +g.on[i])));
    out[strat] = { avgStars: avg((g) => g.stars).toFixed(2), dist, goalRate_machine_jar_debt_trust: goalRate, avgNet: Math.round(avg((g) => g.net)), avgWonMonth: avg((g) => g.won).toFixed(1), machineRate: Math.round(100 * avg((g) => g.mach ? 1 : 0)), errs: errs.slice(0, 3) };
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
