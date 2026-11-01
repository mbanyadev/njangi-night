/* Njangi Night — game UI. Vanilla JS, no build step. (c) Mbanya Dev */
(() => {
  const { CFG, MEMBERS, rng, aiNeed, aiBid, resolveAuction, impliedRate, NEED_LINES, round500 } = window.NjangiCore;
  const $ = (s, el = document) => el.querySelector(s);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const params = new URLSearchParams(location.search);
  let R = rng(Number(params.get('seed')) || (Date.now() & 0xffffff));
  const opts = { sound: true, calm: false, big: false, simple: false };
  const sleep = (ms) => new Promise((r) => setTimeout(r, opts.calm ? Math.min(ms, 120) : ms));
  const T = (normal, simple) => (opts.simple && simple ? simple : normal);

  /* ---------- layout scaling ---------- */
  function fit() {
    const s = Math.min(innerWidth / 1280, innerHeight / 720);
    $('#stage').style.transform = `scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  /* ---------- sound (WebAudio, no files) ---------- */
  let AC;
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.12, when = 0) {
    if (!opts.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio blocked */ }
  }
  const sfx = {
    click: () => tone(660, 0.06, 'triangle', 0.08),
    coin: () => { tone(1320, 0.08, 'square', 0.04); tone(1760, 0.12, 'square', 0.035, 0.06); },
    good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, i * 0.09)),
    bad: () => { tone(220, 0.25, 'sawtooth', 0.06); tone(165, 0.3, 'sawtooth', 0.05, 0.12); },
    win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.11, i * 0.1)),
    drum: () => { tone(110, 0.15, 'sine', 0.2); tone(90, 0.2, 'sine', 0.18, 0.18); },
  };
  document.addEventListener('click', (e) => { if (e.target.closest('button')) sfx.click(); });

  /* ---------- state ---------- */
  let S;
  function newState() {
    return {
      month: 1, cash: CFG.startCash, jar: 0, debt: 0, owed: 0, trust: CFG.startTrust, machine: false, machineMonth: 0,
      living: CFG.living, eligible: new Set(MEMBERS.map((m) => m.id)), pot: 0, pending: [], history: [],
      won: false, wonMonth: 0, wonBid: 0, wonGot: 0,
      stats: { borrowed: 0, interest: 0, shares: 0, leak: 0, jarSaves: 0, scamLost: 0, scamDodged: 0, defaults: 0, bnpl: false },
      deck: shuffle(EVENTS.map((e) => e.id)), lastEvent: null,
    };
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- HUD ---------- */
  const prev = {};
  function hud() {
    const set = (id, v, cls) => {
      const el = $('#s-' + id); el.textContent = fmt(v);
      if (prev[id] !== undefined && prev[id] !== v) { const c = el.parentElement; c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 260); }
      prev[id] = v;
    };
    set('cash', S.cash); set('jar', S.jar); set('debt', S.debt + S.owed); set('trust', S.trust);
    $('.chip.debt').classList.toggle('zero', S.debt + S.owed === 0);
    $('#months').innerHTML = '<span>Month</span>' + Array.from({ length: CFG.months }, (_, i) =>
      `<div class="pip ${i + 1 < S.month ? 'done' : i + 1 === S.month ? 'now' : ''}" aria-label="Month ${i + 1}">${i + 1}</div>`).join('');
    $('#pot-amt').textContent = fmt(S.pot);
  }
  function toast(text, kind, x, y) {
    const t = document.createElement('div'); t.className = 'toast ' + (kind || 'info'); t.textContent = text;
    t.style.left = x + 'px'; t.style.top = y + 'px'; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 1900);
  }
  const chipPos = (id) => { const r = $('.chip.' + id).getBoundingClientRect(), st = $('#stage').getBoundingClientRect(), s = st.width / 1280; return [(r.left - st.left + r.width / 2) / s, (r.bottom - st.top) / s + 26]; };
  function money(id, delta) { if (!delta) return; toast((delta > 0 ? '+' : '−') + fmt(Math.abs(delta)), delta > 0 ? 'pos' : 'neg', ...chipPos(id)); }

  /* ---------- seats ---------- */
  const SEAT_POS = { comfort: [110, 292], fru: [295, 262], kingsley: [455, 238], aicha: [825, 238], ndolo: [985, 262], you: [1170, 292] };
  function drawSeats() {
    $('#seats').innerHTML = MEMBERS.map((m) => `
      <div class="seat ${m.id === 'you' ? 'you' : ''}" id="seat-${m.id}" style="left:${SEAT_POS[m.id][0]}px;top:${SEAT_POS[m.id][1]}px">
        <div class="bubble"></div>
        <div class="av" style="background-image:url(${m.img})" role="img" aria-label="${m.name}"></div>
        <div class="nm">${m.name}</div><div class="role">${m.role}</div>
      </div>`).join('');
  }
  function bubble(id, html, cls = '') { const b = $(`#seat-${id} .bubble`); b.className = 'bubble ' + cls; b.innerHTML = html; requestAnimationFrame(() => b.classList.add('show')); }
  function clearBubbles() { document.querySelectorAll('.bubble').forEach((b) => b.classList.remove('show')); }
  function refreshSeats() { MEMBERS.forEach((m) => { const s = $('#seat-' + m.id); s.classList.toggle('won', !S.eligible.has(m.id)); s.classList.remove('winner'); }); }
  async function flyCoins(fromXY, toXY, n = 6) {
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div'); c.className = 'coin';
      c.style.left = fromXY[0] - 13 + (R() * 20 - 10) + 'px'; c.style.top = fromXY[1] - 13 + 'px'; $('#stage').appendChild(c);
      requestAnimationFrame(() => requestAnimationFrame(() => { c.style.left = toXY[0] - 13 + (R() * 30 - 15) + 'px'; c.style.top = toXY[1] - 13 + 'px'; }));
      setTimeout(() => { c.style.opacity = 0; }, 720); setTimeout(() => c.remove(), 950);
      if (i % 2 === 0) setTimeout(sfx.coin, 650);
      await sleep(70);
    }
  }
  const POT_XY = [640, 200];
  function confetti() {
    if (opts.calm) return;
    const cols = ['#ffc42e', '#ff6b5b', '#13a89e', '#5cb531', '#3fa9f5', '#7b3fa0'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div'); c.className = 'confetti'; c.style.left = R() * 1280 + 'px'; c.style.top = -20 - R() * 120 + 'px';
      c.style.background = cols[i % cols.length]; c.style.animationDuration = 1.8 + R() * 1.4 + 's'; c.style.animationDelay = R() * 0.4 + 's';
      $('#stage').appendChild(c); setTimeout(() => c.remove(), 3600);
    }
  }

  /* ---------- panel helper ---------- */
  function panel(html, onMount) {
    const p = $('#panel'); p.classList.remove('hidden'); p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
    p.innerHTML = html; if (onMount) onMount(p);
    const first = p.querySelector('.btn.primary, .choice:not([disabled])'); if (first) first.focus({ preventScroll: true });
  }
  const waitClick = (sel) => new Promise((res) => { document.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => res(b.dataset.v), { once: true })); });

  /* ---------- money ops ---------- */
  function addCash(v) { S.cash += v; money('cash', v); hud(); }
  function addJar(v) { S.jar += v; money('jar', v); hud(); }
  function borrow(v) { S.debt += v; S.stats.borrowed += v; S.cash += 0; money('debt', v); hud(); }
  function trust(v) { S.trust = Math.max(0, Math.min(100, S.trust + v)); toast((v > 0 ? '+' : '') + v + ' trust', v > 0 ? 'pos' : 'neg', ...chipPos('trust')); hud(); }

  /** Pay a bill: choose Jar / cash / Quick Cash. Resolves to the source used. */
  async function payBill(amount, why, fundOnly = false) {
    const canJar = fundOnly ? S.jar >= amount : S.jar > 0 && S.jar + S.cash >= amount, canCash = !fundOnly && S.cash >= amount;
    const jarPart = Math.min(S.jar, amount);
    panel(`<span class="tag life">💸 Bill to pay</span><h2>${why}: ${fmt(amount)} FCFA</h2>
      <p>${T('How will you pay? Money in the Trouble Jar is there for exactly this.', 'How do you pay? The Trouble Jar is for surprises like this.')}</p>
      <div class="choices">
        <button class="choice" data-v="jar" ${canJar ? '' : 'disabled'}><span class="t">🫙 Trouble Jar</span><span class="s">${canJar ? (jarPart < amount ? `Jar ${fmt(jarPart)} + cash ${fmt(amount - jarPart)}` : 'No interest, no stress.') : 'Not enough saved in the jar.'}</span></button>
        <button class="choice" data-v="cash" ${canCash ? '' : 'disabled'}><span class="t">💵 Pay cash</span><span class="s">${fundOnly ? 'Your pocket is already empty.' : canCash ? 'Careful: you need 10,000 for njangi tonight.' : 'Not enough cash.'}</span></button>
        <button class="choice" data-v="loan"><span class="t">📛 Quick Cash loan</span><span class="s">Instant… at 20% per month. ${fmt(amount)} becomes ${fmt(amount * 1.2)} next month.</span></button>
      </div>`);
    const v = await waitClick('#panel .choice');
    if (fundOnly) { // move money into cash so the caller can pay
      if (v === 'jar') { S.jar -= amount; money('jar', -amount); S.stats.jarSaves++; } else { borrow(amount); }
      addCash(amount); return v;
    }
    if (v === 'jar') { S.jar -= jarPart; money('jar', -jarPart); if (amount > jarPart) addCash(-(amount - jarPart)); S.stats.jarSaves++; hud(); }
    else if (v === 'cash') addCash(-amount);
    else { borrow(amount); }
    return v;
  }

  /* ---------- EVENTS ---------- */
  const EVENTS = [
    { id: 'malaria', icon: '🤒', title: 'Malaria knocks you down', text: 'Fever all night. The clinic wants 12,000 FCFA for tests and medicine.',
      choices: [{ t: 'Go to the clinic', s: 'Pay 12,000 — health first.', run: async () => { await payBill(12000, 'Clinic bill'); return ['good', 'You recover fast and get back to your machine.']; } },
        { t: 'Buy street pills', s: '2,000 now… but you might lose work days.', run: async () => { addCash(-2000); if (R() < 0.6) { addCash(-8000); return ['bad', 'You stayed sick for a week. Lost orders: 8,000.']; } return ['good', 'Lucky this time. Cheap can be expensive.']; } }] },
    { id: 'scam', icon: '📱', title: '“CONGRATULATIONS!!”', text: 'SMS: “You have WON 500,000 FCFA in the MoMo Mega Promo! Send 5,000 FCFA fees to 6XX XX XX XX to claim within 1 hour.”',
      choices: [{ t: 'Send the 5,000', s: 'Half a million is waiting…', run: async () => { addCash(-Math.min(S.cash, 5000)); S.stats.scamLost += 5000; return ['bad', 'The number is switched off. Real prizes never ask you to pay first.']; } },
        { t: 'Ignore and delete', s: 'Something feels off.', run: async () => { S.stats.scamDodged++; return ['good', 'Red flags: urgency, a fee to “unlock” money, an unknown number. You dodged it.']; } },
        { t: 'Warn the njangi group', s: 'Share the screenshot.', run: async () => { S.stats.scamDodged++; trust(4); return ['good', 'Kingsley almost fell for the same SMS. The group thanks you.']; } }] },
    { id: 'wedding', icon: '👗', title: 'A wedding order!', text: 'A bride wants 6 matching outfits. You must buy 10,000 of fabric now. She pays 22,000 on delivery next month… if she doesn’t change her mind.',
      choices: [{ t: 'Take the order', s: 'Spend 10,000 now, maybe earn 22,000.', run: async () => { if (S.cash < 10000) { await payBill(10000, 'Fabric'); } else addCash(-10000); const ok = R() < 0.8; S.pending.push({ month: S.month + 1, amount: ok ? 22000 : 4000, why: ok ? 'Wedding order paid' : 'Bride cancelled (fabric resold)' }); return ['info', 'Risk and reward: the money comes later, and not always.']; } },
        { t: 'Ask for a 50% deposit first', s: 'Safer, but she may walk away.', run: async () => { if (R() < 0.55) { addCash(11000); addCash(-10000); S.pending.push({ month: S.month + 1, amount: 11000, why: 'Wedding balance paid' }); return ['good', 'She agreed! A deposit protects your cash.']; } return ['info', 'She went to another tailor. No risk, no reward.']; } },
        { t: 'Decline', s: 'Keep your cash safe.', run: async () => ['info', 'You keep your cash. Sometimes safe is right.'] }] },
    { id: 'phone', icon: '📵', title: 'Your phone screen cracks', text: 'Clients call and WhatsApp you on it. Repair: 8,000. Or the shop offers a NEW phone: “only 5,000 a month!” (12 months).',
      choices: [{ t: 'Repair it', s: 'Pay 8,000 once.', run: async () => { await payBill(8000, 'Phone repair'); return ['good', 'Fixed. Total cost: 8,000.']; } },
        { t: 'New phone, 5,000/month', s: 'Shiny! Small payments…', run: async () => { S.living += 5000; S.stats.bnpl = true; return ['bad', '5,000 × 12 = 60,000 for a 40,000 phone. Your monthly costs went up by 5,000.']; } },
        { t: 'Live with the crack', s: 'Free… for now.', run: async () => { if (R() < 0.4) { addCash(-3000); return ['bad', 'You missed a client’s order message. −3,000.']; } return ['info', 'It still works. Needs vs wants.']; } }] },
    { id: 'funeral', icon: '🕊️', title: 'A neighbour’s funeral', text: 'The quarter is collecting contributions for the family. Everyone will remember who came.',
      choices: [{ t: 'Give 5,000', s: 'Community is your safety net too.', run: async () => { await payBill(5000, 'Funeral contribution'); trust(6); return ['good', 'Social ties are a kind of insurance.']; } },
        { t: 'Give 1,000', s: 'Something small.', run: async () => { addCash(-Math.min(S.cash, 1000)); trust(1); return ['info', 'You showed up. That matters.']; } },
        { t: 'Skip it', s: 'Keep every franc.', run: async () => { trust(-6); return ['bad', 'People noticed. Trust is money you can’t see.']; } }] },
    { id: 'doubler', icon: '🎲', title: '“Double your money in 2 weeks”', text: 'Kingsley’s cousin runs a “trading club”: give 10,000 today, get 20,000 in two weeks. “Everybody is joining!”',
      choices: [{ t: 'Join with 10,000', s: 'Everybody is joining…', run: async () => { await payBill(10000, '“Investment”'); S.stats.scamLost += 10000; return ['bad', 'The cousin vanished with everyone’s money. Promised “guaranteed” high returns = Ponzi.']; } },
        { t: 'Ask how it makes money', s: 'Who pays the profit?', run: async () => { S.stats.scamDodged++; return ['good', 'No real answer — profits paid from new members. You walk away.']; } }] },
    { id: 'eneo', icon: '💡', title: 'Power cut all week', text: 'ENEO cut the light. Your electric machine can’t run. A generator rental costs 4,000.',
      choices: [{ t: 'Rent the generator', s: '4,000 to keep orders moving.', run: async () => { await payBill(4000, 'Generator rental'); return ['good', 'Orders delivered on time. Spending to protect income.']; } },
        { t: 'Wait it out', s: 'Lose about 7,000 of orders.', run: async () => { addCash(-Math.min(S.cash, 7000)); return ['bad', 'Clients went elsewhere. Not spending can cost more.']; } }] },
    { id: 'credit', icon: '🧾', title: '“I’ll pay you next month”', text: 'A regular customer wants a dress worth 9,000 on credit. She paid late last time.',
      choices: [{ t: 'Give credit', s: 'Keep the customer happy.', run: async () => { const ok = R() < 0.5; S.pending.push({ month: S.month + 1, amount: ok ? 9000 : 0, why: ok ? 'Customer paid her credit' : 'Customer didn’t pay (yet)' }); addCash(-2500); return ['info', 'Fabric cost 2,500 now. Credit you give is money you don’t have.']; } },
        { t: 'Cash only, with a discount', s: '8,000 now.', run: async () => { addCash(8000 - 2500); return ['good', 'A bird in hand: 5,500 profit today.']; } }] },
    { id: 'rent', icon: '🏠', title: 'The landlord raises the rent', text: '“From this month, +3,000.” You could try to negotiate.',
      choices: [{ t: 'Accept', s: 'Living costs +3,000/month.', run: async () => { S.living += 3000; return ['bad', 'Fixed costs went up. Your budget must absorb it.']; } },
        { t: 'Negotiate: pay 3 months upfront', s: 'Use 9,000 now, he keeps the old price?', run: async () => { if (S.cash + S.jar < 9000) return ['bad', 'You don’t have 9,000. Rent goes up anyway.', () => { S.living += 3000; }]; await payBill(9000, 'Rent in advance'); S.pending.push({ month: S.month + 1, amount: 3000, why: 'Rent saved (paid ahead)' }, { month: S.month + 2, amount: 3000, why: 'Rent saved (paid ahead)' }, { month: S.month + 3, amount: 3000, why: 'Rent saved (paid ahead)' }); return ['good', 'Cash now buys a better price later.']; } }] },
    { id: 'festive', icon: '🎉', title: 'Your cousin’s birthday party', text: 'Everyone is buying new outfits and drinks. Your friends ask: “You’re coming in style, no?”',
      choices: [{ t: 'Go big: 10,000', s: 'You only live once!', run: async () => { await payBill(10000, 'Party spending'); return ['bad', 'Great night. Expensive morning.']; } },
        { t: 'Sew your own outfit: 2,000', s: 'Show off your skills.', run: async () => { addCash(-Math.min(S.cash, 2000)); if (R() < 0.5) { S.pending.push({ month: S.month + 1, amount: 6000, why: 'New clients from the party' }); return ['good', 'Two guests asked for your number!']; } return ['good', 'You looked sharp for 2,000.']; } },
        { t: 'Stay home', s: 'Free.', run: async () => ['info', 'Saved money, missed fun. Balance matters.'] }] },
    { id: 'goodmonth', icon: '✂️', title: 'Back-to-school rush!', text: 'Parents need uniforms. You can work late nights to earn more.',
      choices: [{ t: 'Work late', s: '+9,000 but you’re tired.', run: async () => { addCash(9000); return ['good', 'Extra income! Where will it go: pocket or jar?']; } },
        { t: 'Hire an apprentice for 4,000', s: 'Earn +12,000, teach a skill.', run: async () => { addCash(12000 - 4000); trust(3); return ['good', 'Sharing work grew your income and your reputation.']; } }] },
    { id: 'machinebreak', icon: '🔧', title: 'Your machine jams', text: 'The belt snapped. Repair: 6,000.', needs: (s) => s.machine,
      choices: [{ t: 'Repair', s: 'Protect your income.', run: async () => { await payBill(6000, 'Machine repair'); return ['good', 'Assets need maintenance. Budget for it.']; } }] },
    { id: 'family', icon: '👨‍👩‍👧', title: 'Family from the village calls', text: 'Your uncle needs 8,000 for fertilizer. “I’ll pay back after harvest.”',
      choices: [{ t: 'Send 8,000', s: 'Family is family.', run: async () => { await payBill(8000, 'Help for uncle'); if (R() < 0.5) S.pending.push({ month: S.month + 3, amount: 8000, why: 'Uncle paid back after harvest' }); return ['info', 'Lend only what you can afford to lose.']; } },
        { t: 'Send 3,000 as a gift', s: 'Help, without expecting it back.', run: async () => { addCash(-Math.min(S.cash, 3000)); return ['good', 'A gift you can afford beats a loan you worry about.']; } },
        { t: 'Explain you can’t this month', s: 'Hard, but honest.', run: async () => ['info', 'Saying no protects your goals.'] }] },
  ];

  /* ---------- screens ---------- */
  function titleScreen() {
    $('#hud').classList.add('hidden'); $('#circle').classList.add('hidden'); $('#panel').classList.add('hidden');
    $('#screen').innerHTML = `<div class="shade"></div><div class="title-card" style="position:relative">
      <div class="kicker">A FINANCIAL-LITERACY GAME FROM CAMEROON</div>
      <h1>Njangi <span>Night</span></h1>
      <div class="sub">Save together. Bid smart. Sew your future.</div>
      <div class="lineup">${MEMBERS.map((m) => `<div style="background-image:url(${m.img})" title="${m.name}"></div>`).join('')}</div>
      <button class="btn primary" id="btn-play" data-act="play">▶ Join the njangi</button>
      <div class="how">
        <div><b>💵 Get paid, plan</b>Six months. Fill your Trouble Jar before life happens.</div>
        <div><b>🔨 Bid for the pot</b>Need 60,000 now? Offer a discount. Every franc you bid is the <i>price</i> of money.</div>
        <div><b>🧵 Sew your future</b>Buy a sewing machine, stay out of debt, keep the circle’s trust.</div>
      </div></div>`;
    $('#btn-play').addEventListener('click', startGame);
  }

  async function startGame() {
    S = newState();
    $('#screen').innerHTML = ''; $('#hud').classList.remove('hidden'); $('#circle').classList.remove('hidden');
    drawSeats(); refreshSeats(); hud();
    panel(`<span class="tag">🧵 Your story</span><h2>You’re a young tailor in Bamenda.</h2>
      <p>Your dream: your own <b>sewing machine</b> (${fmt(CFG.machineCost)} FCFA) so you can take bigger orders. Mama Comfort invites you into her njangi: <b>6 members, 10,000 FCFA each, every month</b>. One member takes the 60,000 pot each night.</p>
      <p class="note info">In this njangi the pot is <b>auctioned</b>. Want it early? Bid a discount — the winner gets 60,000 minus the bid, and the bid is shared by everyone else. <b>Bidding is borrowing. Waiting is earning.</b></p>
      <div class="actions"><button class="btn primary" data-act="next">Let’s go →</button></div>`);
    await waitClick('#panel .btn');
    monthLoop();
  }

  async function monthLoop() {
    while (S.month <= CFG.months) {
      hud(); refreshSeats(); clearBubbles(); S.pot = 0; hud();
      await payday();
      await plan();
      await lifeEvent();
      await njangiNight();
      await monthEnd();
      S.month++;
    }
    endScreen();
  }

  async function payday() {
    const inc = CFG.income + (S.machine ? CFG.machineBoost : 0);
    const due = S.pending.filter((p) => p.month === S.month); S.pending = S.pending.filter((p) => p.month !== S.month);
    const extra = due.reduce((a, p) => a + p.amount, 0);
    const owedPay = Math.min(S.owed, Math.max(0, S.cash + inc + extra - S.living));
    const rows = [[`Sewing income${S.machine ? ' (with machine +' + fmt(CFG.machineBoost) + ')' : ''}`, inc], ...due.map((p) => [p.why, p.amount]), ['Rent, food & transport', -S.living]];
    if (owedPay) rows.push(['Repay the njangi (missed contribution)', -owedPay]);
    const net = rows.reduce((a, r) => a + r[1], 0);
    panel(`<span class="tag pay">💰 Payday · Month ${S.month} of ${CFG.months}</span><h2>${S.month === 1 ? 'Your first month in the njangi' : 'A new month begins'}</h2>
      <div class="ledger">${rows.map(([k, v]) => `<span>${k}</span><span class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}</span>`).join('')}
      <span class="tot">Change in your pocket</span><span class="tot ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span></div>
      <div class="actions"><button class="btn primary" data-act="next">Collect pay →</button></div>`);
    await waitClick('#panel .btn');
    addCash(net); S.owed -= owedPay; hud(); sfx.coin();
  }

  async function plan() {
    let toJar = 0, repay = 0;
    const step = 2500;
    const render = () => {
      const left = S.cash - toJar - repay;
      panel(`<span class="tag">🗂️ Plan your money</span><h2>Give your money a job before it disappears</h2>
        <p>${T('Cash left in your pocket tends to leak away on small things. The Trouble Jar keeps it safe for emergencies.', 'Pocket cash leaks. Jar money stays.')}</p>
        <div class="stepper"><div class="lab">🫙 Put in Trouble Jar <small>In jar now: ${fmt(S.jar)} · goal ${fmt(CFG.jarGoal)}</small></div>
          <button data-a="jar-" aria-label="Less to jar">−</button><div class="val">${toJar >= 0 ? '' : '−'}${fmt(Math.abs(toJar))}</div><button data-a="jar+" aria-label="More to jar">+</button></div>
        ${S.debt > 0 ? `<div class="stepper" style="margin-top:8px"><div class="lab">📛 Repay Quick Cash <small>Debt: ${fmt(S.debt)} · grows 20% a month</small></div>
          <button data-a="rep-" aria-label="Repay less">−</button><div class="val">${fmt(repay)}</div><button data-a="rep+" aria-label="Repay more">+</button></div>` : ''}
        <div class="actions"><span class="note ${left < CFG.contrib ? 'bad' : 'good'}" style="margin-right:auto">💵 Cash left: <b>${fmt(left)}</b> — njangi tonight needs <b>10,000</b></span>
        <button class="btn primary" data-act="plan-done">Done →</button></div>`, (p) => {
        p.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
          const a = b.dataset.a;
          if (a === 'jar+' && S.cash - toJar - repay >= step) toJar += step;
          if (a === 'jar+' && S.cash - toJar - repay > 0 && S.cash - toJar - repay < step) toJar += S.cash - toJar - repay;
          if (a === 'jar-' && (toJar > 0 || S.jar + toJar >= step)) toJar = toJar > 0 ? Math.max(0, toJar - step) : toJar - step;
          if (a === 'rep+' && S.cash - toJar - repay > 0 && repay < S.debt) repay += Math.min(step, S.debt - repay, S.cash - toJar - repay);
          if (a === 'rep-' && repay > 0) repay = Math.max(0, repay - step);
          render();
        }));
        p.querySelector('[data-act=plan-done]').addEventListener('click', done);
      });
    };
    let resolve; const done = () => resolve();
    render();
    await new Promise((r) => (resolve = r));
    if (toJar) { S.cash -= toJar; money('cash', -toJar); addJar(toJar); }
    if (repay) { S.cash -= repay; S.debt -= repay; money('cash', -repay); money('debt', -repay); hud(); }
  }

  async function lifeEvent() {
    let id;
    while (S.deck.length) { id = S.deck.shift(); const e = EVENTS.find((x) => x.id === id); if (!e.needs || e.needs(S)) break; S.deck.push(id); if (S.deck.every((d) => EVENTS.find((x) => x.id === d).needs && !EVENTS.find((x) => x.id === d).needs(S))) break; }
    const ev = EVENTS.find((x) => x.id === id) || EVENTS[1];
    panel(`<span class="tag life">⚡ Life happens</span><div class="ev-icon" aria-hidden="true">${ev.icon}</div><h2>${ev.title}</h2><p>${ev.text}</p>
      <div class="choices">${ev.choices.map((c, i) => `<button class="choice" data-v="${i}"><span class="t">${c.t}</span><span class="s">${c.s}</span></button>`).join('')}</div>`);
    const i = Number(await waitClick('#panel .choice'));
    const out = await ev.choices[i].run();
    if (out[2]) out[2]();
    (out[0] === 'bad' ? sfx.bad : out[0] === 'good' ? sfx.good : sfx.click)();
    hud();
    panel(`<span class="tag life">${ev.icon} ${ev.title}</span><h2>${out[0] === 'bad' ? 'Ouch.' : out[0] === 'good' ? 'Nice move.' : 'Noted.'}</h2>
      <p class="note ${out[0]}">${out[1]}</p><div class="actions"><button class="btn primary" data-act="next">To the njangi →</button></div>`);
    await waitClick('#panel .btn');
  }

  async function njangiNight() {
    const monthsLeft = CFG.months - S.month + 1;
    // 1. contributions
    panel(`<span class="tag night">🌙 Njangi night · Month ${S.month}</span><h2>Mama Comfort opens the meeting</h2>
      <p>“Members, bring your contributions!” Everyone puts <b>10,000 FCFA</b> into the pot.</p>
      <div class="actions">${S.cash >= CFG.contrib ? '<button class="btn primary" data-v="pay" data-act="contribute">Pay my 10,000</button>'
        : `<span class="note bad" style="margin-right:auto">You only have ${fmt(S.cash)} cash.</span><button class="btn plum" data-v="cover" data-act="contribute">Find the money…</button><button class="btn ghost" data-v="default">Skip (default)</button>`}</div>`);
    const v = await waitClick('#panel .btn');
    sfx.drum();
    if (v === 'pay') { addCash(-CFG.contrib); trust(3); }
    else if (v === 'cover') {
      const need = CFG.contrib - S.cash; await payBill(need, 'Missing contribution', true);
      addCash(-CFG.contrib); trust(1);
    } else { S.owed += CFG.contrib + CFG.defaultFine; S.stats.defaults++; trust(-20); sfx.bad(); }
    for (const m of MEMBERS) { const p = SEAT_POS[m.id]; flyCoins(p, POT_XY, 4); S.pot += CFG.contrib; hud(); await sleep(220); }
    await sleep(500);

    // 2. needs & bids
    const ai = MEMBERS.filter((m) => m.id !== 'you' && S.eligible.has(m.id));
    const needs = {}; ai.forEach((m) => { needs[m.id] = aiNeed(m, S.month, R); });
    ai.forEach((m) => {
      const n = needs[m.id]; const line = m.style === 'nointerest' ? NEED_LINES.nointerest[0] : n > 0.6 ? pick(NEED_LINES.high) : n > 0.3 ? pick(NEED_LINES.mid) : pick(NEED_LINES.low);
      bubble(m.id, line);
    });
    const youEligible = S.eligible.has('you');
    let myBid = -1;
    if (monthsLeft === 1) {
      panel(`<span class="tag night">🌙 Last night</span><h2>The last member takes the pot, free</h2><p>No one is left to bid against. The pot goes to whoever hasn’t had it — at no discount.</p><div class="actions"><button class="btn primary" data-act="reveal">Hand over the pot →</button></div>`);
      await waitClick('#panel .btn');
    } else if (youEligible) {
      myBid = await bidPanel(monthsLeft);
    } else {
      panel(`<span class="tag night">🌙 The auction</span><h2>You already took the pot in month ${S.wonMonth}</h2><p>Sit back: whatever the winner bids tonight is shared with you and the others. ${T('This is how waiting members earn a return.', 'Others pay, you earn.')}</p><div class="actions"><button class="btn primary" data-act="reveal">Reveal the bids →</button></div>`);
      await waitClick('#panel .btn');
    }

    // 3. reveal
    clearBubbles(); await sleep(250);
    const bids = ai.map((m) => ({ id: m.id, amount: aiBid(m, needs[m.id], S.month, monthsLeft) }));
    if (youEligible) bids.push({ id: 'you', amount: Math.max(0, myBid) });
    if (monthsLeft === 1) bids.forEach((b) => (b.amount = 0));
    $('#panel').classList.add('hidden');
    for (const b of bids) { bubble(b.id, b.amount ? fmt(b.amount) : 'pass', 'bid ' + (b.amount ? '' : 'pass')); sfx.click(); await sleep(420); }
    const res = resolveAuction(bids, R);
    await sleep(350);
    const wb = $(`#seat-${res.winner} .bubble`); if (wb && res.bid) wb.classList.add('top');
    $('#seat-' + res.winner).classList.add('winner'); sfx.win();
    await sleep(500);
    const got = S.pot - res.bid, share = Math.floor(res.bid / (CFG.months - 1));
    flyCoins(POT_XY, SEAT_POS[res.winner], 10);
    S.pot = 0; hud();
    S.eligible.delete(res.winner);
    const winnerM = MEMBERS.find((m) => m.id === res.winner);
    S.history.push({ month: S.month, winner: res.winner, bid: res.bid, lots: res.lots });
    if (res.winner !== 'you' && share) { S.cash += share; S.stats.shares += share; await sleep(500); toast('+' + fmt(share) + ' share', 'pos', SEAT_POS.you[0], SEAT_POS.you[1] - 70); money('cash', share); hud(); }
    await sleep(700);

    if (res.winner === 'you') {
      confetti(); S.won = true; S.wonMonth = S.month; S.wonBid = res.bid; S.wonGot = got;
      addCash(got);
      await usePot(got, res.bid, monthsLeft);
    } else {
      const rate = impliedRate(res.bid, CFG.months * CFG.contrib, monthsLeft - 1);
      panel(`<span class="tag night">🏆 ${winnerM.name} takes the pot</span><h2>${res.bid ? `${winnerM.name} paid ${fmt(res.bid)} to get it now` : res.lots ? 'Nobody bid — lots were drawn' : 'Taken with no discount'}</h2>
        <p>${res.bid ? `${winnerM.name} receives <b>${fmt(got)}</b>. The ${fmt(res.bid)} discount is split between the other five members: <b>you earn ${fmt(share)}</b> just for waiting.` : `${winnerM.name} receives the full ${fmt(got)}.`}</p>
        ${res.bid ? `<p class="note info">${T(`That’s like ${winnerM.name} borrowing at about <b>${(rate * 100).toFixed(1)}% a month</b>. Quick Cash charges 20%.`, `Getting money early has a price: about ${(rate * 100).toFixed(1)}% a month.`)}</p>` : ''}
        <div class="actions"><button class="btn primary" data-act="next">Continue →</button></div>`);
      await waitClick('#panel .btn');
    }
    clearBubbles();
  }
  const pick = (a) => a[Math.floor(R() * a.length)];

  function bidPanel(monthsLeft) {
    return new Promise((resolve) => {
      const pot = CFG.months * CFG.contrib;
      const early = monthsLeft - 1;
      const render = (b) => {
        const rate = impliedRate(b, pot, early);
        return `<div class="meter"><div><small>You receive tonight</small><b>${fmt(pot - b)}</b></div>
          <div><small>Each other member earns</small><b>${fmt(Math.floor(b / (CFG.months - 1)))}</b></div>
          <div><small>Your price of money</small><b style="color:${rate > 0.1 ? '#d23c2c' : rate > 0.04 ? '#c77d00' : '#2f8a12'}">${b ? (rate * 100).toFixed(1) + '% / month' : 'free'}</b></div></div>`;
      };
      panel(`<span class="tag night">🔨 The auction · sealed bids</span><h2>Do you want the pot tonight?</h2>
        <p>Set a discount you’d give up to take the pot <b>${early} month${early > 1 ? 's' : ''} early</b>. Highest bid wins. Or pass, wait, and collect a share of the winner’s bid. ${S.machine ? '' : `<b>Machine costs ${fmt(CFG.machineCost)}.</b>`}</p>
        <div class="bidbox"><input id="bid" type="range" min="0" max="${CFG.maxBid}" step="${CFG.bidStep}" value="0" aria-label="Your bid"><div class="bidval" id="bidval">PASS</div></div>
        <div id="meter">${render(0)}</div>
        <div class="actions"><button class="btn ghost" data-act="pass" id="b-pass">Pass & wait</button><button class="btn primary" id="b-bid" data-act="bid" disabled>Place sealed bid</button></div>`,
      (p) => {
        const r = p.querySelector('#bid');
        r.addEventListener('input', () => { const b = Number(r.value); p.querySelector('#bidval').textContent = b ? fmt(b) : 'PASS'; p.querySelector('#meter').innerHTML = render(b); p.querySelector('#b-bid').disabled = !b; });
        p.querySelector('#b-pass').addEventListener('click', () => resolve(0));
        p.querySelector('#b-bid').addEventListener('click', () => resolve(Number(r.value)));
      });
    });
  }

  async function usePot(got, bid, monthsLeft) {
    const rate = impliedRate(bid, CFG.months * CFG.contrib, monthsLeft - 1);
    const render = () => panel(`<span class="tag night">🏆 The pot is yours!</span><h2>You receive ${fmt(got)} FCFA</h2>
      <p>${bid ? T(`You gave up ${fmt(bid)} to get it ${monthsLeft - 1} month(s) early — about <b>${(rate * 100).toFixed(1)}% per month</b>. Make it earn more than it cost!`, `Getting it early cost you ${fmt(bid)}. Use it well!`) : 'You paid no discount for it. Well waited!'} You still owe your 10,000 every month until the circle ends.</p>
      <div class="choices">
        <button class="choice" data-v="machine" ${S.machine || S.cash + S.jar < CFG.machineCost ? 'disabled' : ''}><span class="t">🧵 Buy the sewing machine</span><span class="s">${S.machine ? 'Already yours!' : S.cash + S.jar < CFG.machineCost ? `Need ${fmt(CFG.machineCost)} (cash + jar).` : `${fmt(CFG.machineCost)} → +${fmt(CFG.machineBoost)} income every month after.${S.cash < CFG.machineCost ? ' Uses some Jar money.' : ''}`}</span></button>
        <button class="choice" data-v="jar" ${S.cash < 5000 ? 'disabled' : ''}><span class="t">🫙 10,000 into Trouble Jar</span><span class="s">Jar: ${fmt(S.jar)}</span></button>
        <button class="choice" data-v="debt" ${S.debt <= 0 || S.cash <= 0 ? 'disabled' : ''}><span class="t">📛 Pay off Quick Cash</span><span class="s">${S.debt ? 'Debt: ' + fmt(S.debt) : 'No debt 🎉'}</span></button>
      </div>
      <div class="actions"><span class="note" style="margin-right:auto">💵 Cash: <b>${fmt(S.cash)}</b></span><button class="btn primary" data-v="done" data-act="done">Done →</button></div>`);
    for (;;) {
      render();
      const v = await waitClick('#panel .choice, #panel .btn');
      if (v === 'done') break;
      if (v === 'machine') { const fromCash = Math.min(S.cash, CFG.machineCost); addCash(-fromCash); if (CFG.machineCost > fromCash) addJar(-(CFG.machineCost - fromCash)); S.machine = true; S.machineMonth = S.month; sfx.good(); confetti(); toast('🧵 Machine bought!', 'info', 640, 330); }
      if (v === 'jar') { const a = Math.min(10000, S.cash); addCash(-a); addJar(a); }
      if (v === 'debt') { const a = Math.min(S.debt, S.cash); addCash(-a); S.debt -= a; money('debt', -a); hud(); }
    }
  }

  async function monthEnd() {
    const rows = [];
    if (S.debt > 0) { const i = Math.round(S.debt * CFG.quickRate); S.debt += i; S.stats.interest += i; rows.push(['📛 Quick Cash interest (20%)', -i, 'debt']); }
    const leak = S.cash > CFG.leakFloor ? round500((S.cash - CFG.leakFloor) * CFG.leakRate) : 0;
    if (leak) { S.cash -= leak; S.stats.leak += leak; rows.push(['💵 Pocket money leaked (snacks, credit, taxis…)', -leak, 'cash']); }
    hud();
    const last = S.month === CFG.months;
    panel(`<span class="tag end">📅 End of month ${S.month}</span><h2>${last ? 'The njangi year is complete!' : 'The month closes'}</h2>
      ${rows.length ? `<div class="ledger">${rows.map(([k, v]) => `<span>${k}</span><span class="neg">−${fmt(Math.abs(v))}</span>`).join('')}</div>` : '<p class="note good">No interest, no leaks. Clean month! 👏</p>'}
      ${leak > 1500 ? `<p class="note">${T('Tip: money in the Trouble Jar doesn’t leak.', 'Jar money doesn’t leak.')}</p>` : ''}
      <div class="actions"><button class="btn primary" data-act="next">${last ? 'See your results →' : 'Next month →'}</button></div>`);
    rows.forEach(([, v, chip]) => money(chip, chip === 'debt' ? -v : v));
    await waitClick('#panel .btn');
  }

  function endScreen() {
    $('#panel').classList.add('hidden');
    const stars = [
      ['🧵', 'Own a sewing machine', S.machine],
      ['🫙', `Trouble Jar ≥ ${fmt(CFG.jarGoal)}`, S.jar >= CFG.jarGoal],
      ['🕊️', 'Debt-free', S.debt + S.owed === 0],
      ['🤝', `Trust ≥ ${CFG.trustGoal}`, S.trust >= CFG.trustGoal],
    ];
    const nStars = stars.filter((s) => s[2]).length;
    const net = S.cash + S.jar - S.debt - S.owed + (S.machine ? 40000 : 0);
    const L = [];
    if (S.won && S.wonBid) { const r = impliedRate(S.wonBid, 60000, CFG.months - S.wonMonth); L.push(['Bidding = borrowing', `You paid ${fmt(S.wonBid)} to get the pot in month ${S.wonMonth}: about ${(r * 100).toFixed(1)}% a month (${(r * 1200).toFixed(0)}% a year). ${S.machine && S.machineMonth === S.wonMonth ? `But the machine earned you ${fmt(CFG.machineBoost * (CFG.months - S.wonMonth))} extra — a loan that paid for itself.` : 'Was it worth it? Only if the money earned more than it cost.'}`]); }
    else if (S.won) L.push(['Waiting is free', `You took the pot in month ${S.wonMonth} without paying a discount.`]);
    if (S.stats.shares) L.push(['Waiting = earning', `Other members’ bids paid you ${fmt(S.stats.shares)} FCFA just for being patient. That’s your savings earning a return.`]);
    if (S.stats.borrowed) L.push(['The price of fast money', `You borrowed ${fmt(S.stats.borrowed)} from Quick Cash and paid ${fmt(S.stats.interest)} in interest. 20% a month is 240% a year.`]);
    else L.push(['No predatory debt', 'You never touched Quick Cash. At 20% a month, that alone saved you a fortune.']);
    if (S.stats.jarSaves) L.push(['Your Trouble Jar worked', `It covered ${S.stats.jarSaves} surprise bill${S.stats.jarSaves > 1 ? 's' : ''} with zero interest.`]);
    if (S.stats.leak > 2000) L.push(['Unplanned money leaks', `${fmt(S.stats.leak)} FCFA disappeared from your pocket on small things. Give every franc a job.`]);
    if (S.stats.scamLost) L.push(['Scams cost you', `You lost ${fmt(S.stats.scamLost)}. Real prizes never ask for a fee; guaranteed doubling is a Ponzi.`]);
    else if (S.stats.scamDodged) L.push(['Scam radar', `You dodged ${S.stats.scamDodged} scam${S.stats.scamDodged > 1 ? 's' : ''}. Urgency + fee first = red flag.`]);
    if (S.stats.bnpl) L.push(['Small payments, big total', 'The 5,000-a-month phone costs 60,000 in total. Always multiply.']);
    if (S.stats.defaults) L.push(['The circle remembers', 'Missing a contribution cost you trust and a fine. In a njangi, your reputation is your collateral.']);
    const title = ['Rough year — try again!', 'A start. Keep going!', 'Good tailor, growing!', 'Smart saver!', 'Njangi legend!'][nStars];
    $('#screen').innerHTML = `<div class="shade"></div><div class="end-card">
      <span class="tag end">🎓 Your njangi year</span>
      <div class="row" style="justify-content:space-between;align-items:flex-end"><h2 style="font-size:40px;margin:6px 0">${title}</h2>
        <div style="text-align:right"><small style="font-weight:800;color:#5b4a6e">NET WORTH</small><div style="font-family:'Baloo 2';font-weight:800;font-size:36px;color:${net >= 0 ? '#2f8a12' : '#d23c2c'}">${fmt(net)} FCFA</div></div></div>
      <div class="stars">${stars.map(([ic, t, on], i) => `<div class="star ${on ? 'on' : ''}" style="animation-delay:${i * 0.15}s"><span class="st">⭐</span><span>${ic} ${t}</span></div>`).join('')}</div>
      <div class="timeline">${S.history.map((h) => { const m = MEMBERS.find((x) => x.id === h.winner); return `<div><small>Month ${h.month}</small><img src="${m.img}" alt="">${m.name}<br><span style="color:${h.bid ? '#d23c2c' : '#2f8a12'}">${h.bid ? 'bid ' + fmt(h.bid) : 'no bid'}</span></div>`; }).join('')}</div>
      <div class="lessons">${L.slice(0, 4).map(([t, d]) => `<div class="lesson"><b>${t}</b>${d}</div>`).join('')}</div>
      <div class="actions"><button class="btn ghost" id="btn-menu">Menu</button><button class="btn primary" id="btn-again" data-act="again">Play again ↻</button></div></div>`;
    if (nStars >= 3) { sfx.win(); confetti(); }
    $('#btn-again').addEventListener('click', () => { R = rng(Date.now() & 0xffffff); startGame(); });
    $('#btn-menu').addEventListener('click', titleScreen);
  }

  /* ---------- settings ---------- */
  $('#btn-settings').addEventListener('click', () => $('#settings').classList.toggle('hidden'));
  $('#settings-close').addEventListener('click', () => $('#settings').classList.add('hidden'));
  $('#opt-big').addEventListener('change', (e) => { opts.big = e.target.checked; document.body.classList.toggle('big', opts.big); });
  $('#opt-motion').addEventListener('change', (e) => { opts.calm = e.target.checked; document.body.classList.toggle('calm', opts.calm); });
  $('#opt-sound').addEventListener('change', (e) => { opts.sound = e.target.checked; });
  $('#opt-simple').addEventListener('change', (e) => { opts.simple = e.target.checked; });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { $('#opt-motion').checked = true; opts.calm = true; document.body.classList.add('calm'); }

  titleScreen();
  window.__njangi = { get state() { return S; } };
})();
