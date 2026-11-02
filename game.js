/* Njangi Night: game UI. Vanilla JS, no build step. (c) Mbanya Dev */
(() => {
  const NC = window.NjangiCore;
  const { CFG, MEMBERS, rng, aiNeed, needLevel, aiBid, resolveAuction, impliedRate, round500 } = NC;
  const $ = (s, el = document) => el.querySelector(s);
  const params = new URLSearchParams(location.search);
  const FAST = params.has('fast');
  if (params.get('cfg') === 'v1') Object.assign(CFG, NC.CFG_V1);
  let R = rng(Number(params.get('seed')) || (Date.now() & 0xffffff));
  const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const saved = (k, d) => { try { const v = store && store.getItem('nn-' + k); return v === null || v === undefined ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { store && store.setItem('nn-' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const opts = { sound: saved('sound', true), music: saved('music', true), calm: saved('calm', false), big: saved('big', false), simple: saved('simple', false) };
  if (FAST) { opts.sound = false; opts.music = false; opts.calm = true; }
  const sleep = (ms) => (FAST ? Promise.resolve() : new Promise((r) => setTimeout(r, opts.calm ? Math.min(ms, 150) : ms)));

  /* ---------- language ---------- */
  const I = window.I18N;
  let lang = params.get('lang') || saved('lang', null) || (navigator.language || 'en').slice(0, 2);
  if (!I[lang]) lang = 'en';
  function t(key, v) {
    let s = (opts.simple && I[lang][key + '_s']) || I[lang][key];
    if (s === undefined) s = I.en[key];
    if (s === undefined) return key;
    if (Array.isArray(s)) return s;
    return v ? String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : '')) : s;
  }
  const fmt = (n) => Math.round(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
  const cur = (n) => `${fmt(n)} ${t('cur')}`;
  const pct = (r) => (r * 100).toFixed(1).replace('.', lang === 'fr' ? ',' : '.') + '%';
  const mname = (id) => t('m.' + id);
  function applyLang() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
    $('#pot-amt').dataset.cur = t('cur');
    document.title = t('doc.title');
    document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  }
  function setLang(l) { lang = l; save('lang', l); applyLang(); if (S && !S.over) { hud(); refreshSeats(); } if (!S || S.over) { if (!$('#screen .end-card')) titleScreen(); else endScreen(); } else if (rerender) rerender(); }
  let rerender = null; // re-draws the current panel after a language switch mid-game

  /* ---------- layout scaling ---------- */
  function fit() { const s = Math.min(innerWidth / 1280, innerHeight / 720), st = $('#stage'); st.style.transform = `scale(${s})`; st.style.setProperty('--st', `scale(${s})`); }
  addEventListener('resize', fit); fit();

  /* ---------- sound + music (WebAudio, no files) ---------- */
  let AC, master, musicBus;
  function ac() {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 1; master.connect(AC.destination); musicBus = AC.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master); }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.12, when = 0, bus) {
    if (!bus && !opts.sound) return;
    try {
      const A = ac(), t0 = A.currentTime + when, o = A.createOscillator(), g = A.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(bus || master); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio blocked */ }
  }
  function noise(dur = 0.05, vol = 0.05, when = 0, bus, hp = 6000) {
    if (!bus && !opts.sound) return;
    try {
      const A = ac(), t0 = A.currentTime + when, len = Math.max(1, Math.floor(A.sampleRate * dur));
      const buf = A.createBuffer(1, len, A.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(); src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
      src.connect(f).connect(g).connect(bus || master); src.start(t0);
    } catch (e) { /* audio blocked */ }
  }
  const sfx = {
    click: () => tone(660, 0.06, 'triangle', 0.07),
    coin: () => { tone(1320, 0.08, 'square', 0.035); tone(1760, 0.12, 'square', 0.03, 0.06); },
    good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, i * 0.09)),
    bad: () => { tone(220, 0.25, 'sawtooth', 0.05); tone(165, 0.3, 'sawtooth', 0.045, 0.12); },
    win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, i * 0.1)),
    drum: () => { tone(110, 0.15, 'sine', 0.22); tone(90, 0.2, 'sine', 0.2, 0.18); },
    roll: () => { for (let i = 0; i < 14; i++) { tone(140 + i * 4, 0.06, 'sine', 0.06 + i * 0.008, i * 0.07); noise(0.04, 0.02, i * 0.07, null, 3000); } },
    gavel: () => { tone(90, 0.25, 'square', 0.12); noise(0.08, 0.12, 0, null, 800); },
    flip: () => noise(0.05, 0.05, 0, null, 2500),
    star: (i) => tone([784, 988, 1175, 1568][i] || 1568, 0.3, 'triangle', 0.12),
  };
  /* Music: a gentle makossa/highlife-style loop (bass, guitar arpeggio, shaker, bell). 112 bpm, 4 bars. */
  const CH = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]]; // C F G C
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let musicTimer = null, nextBar = 0, barIdx = 0, nightMode = false;
  function scheduleBar() {
    const A = ac(), beat = 60 / 112, s = beat / 2, t0 = nextBar - A.currentTime;
    const ch = CH[barIdx % 4];
    [0, 3, 4, 6].forEach((st, i) => tone(midi(ch[0] - 12 + (i === 2 ? 7 : 0)), 0.32, 'triangle', 0.16, t0 + st * s, musicBus));
    const arp = [ch[2] + 12, ch[1] + 12, ch[0] + 24, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[1] + 12, ch[2] + 12];
    arp.forEach((n, i) => { if (i !== 3 || barIdx % 2) tone(midi(n), 0.16, nightMode ? 'sine' : 'triangle', 0.045, t0 + i * s, musicBus); });
    for (let i = 0; i < 8; i++) noise(0.035, i % 2 ? 0.018 : 0.03, t0 + i * s, musicBus, 7000);
    if (barIdx % 2 === 0) { tone(midi(84), 0.09, 'sine', 0.04, t0, musicBus); tone(midi(79), 0.09, 'sine', 0.04, t0 + 3 * s, musicBus); tone(midi(84), 0.09, 'sine', 0.035, t0 + 5 * s, musicBus); }
    nextBar += beat * 4; barIdx++;
  }
  function musicOn() {
    if (!opts.music || musicTimer || FAST) return;
    try { const A = ac(); nextBar = A.currentTime + 0.1; musicTimer = setInterval(() => { while (nextBar < AC.currentTime + 0.6) scheduleBar(); }, 150); } catch (e) { /* blocked */ }
  }
  function musicOff() { clearInterval(musicTimer); musicTimer = null; }
  document.addEventListener('click', (e) => { if (e.target.closest('button')) { sfx.click(); musicOn(); } });

  /* ---------- state ---------- */
  let S;
  function newState() {
    return {
      month: 1, cash: CFG.startCash, jar: 0, debt: 0, owed: 0, trust: CFG.startTrust, machine: false, machineMonth: 0,
      living: CFG.living, eligible: new Set(MEMBERS.map((m) => m.id)), pot: 0, pending: [], history: [], used: new Set(), over: false,
      won: false, wonMonth: 0, wonBid: 0, wonGot: 0,
      stats: { borrowed: 0, interest: 0, shares: 0, leak: 0, jarSaves: 0, scamLost: 0, scamDodged: 0, defaults: 0, bnpl: false, machineEarned: 0 },
    };
  }

  /* ---------- HUD ---------- */
  const shown = {};
  function countTo(el, from, to, ms = 600) {
    if (FAST || opts.calm || from === undefined || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (n) => { const k = Math.min(1, (n - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1 && el.dataset.target === String(to)) requestAnimationFrame(step); };
    el.dataset.target = String(to); requestAnimationFrame(step);
  }
  function hud() {
    const set = (id, v) => {
      const el = $('#s-' + id); countTo(el, shown[id], v);
      if (shown[id] !== undefined && shown[id] !== v) { const c = el.parentElement; c.classList.remove('bump', 'up', 'down'); void c.offsetWidth; c.classList.add('bump', v > shown[id] ? 'up' : 'down'); clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('bump', 'up', 'down'), 900); }
      shown[id] = v;
    };
    set('cash', S.cash); set('jar', S.jar); set('debt', S.debt + S.owed); set('trust', S.trust);
    $('.chip.debt').classList.toggle('zero', S.debt + S.owed === 0);
    $('#months').innerHTML = `<span>${t('hud.month')}</span>` + Array.from({ length: CFG.months }, (_, i) =>
      `<div class="pip ${i + 1 < S.month ? 'done' : i + 1 === S.month ? 'now' : ''}" aria-label="${t('hud.month')} ${i + 1}">${i + 1}</div>`).join('');
    const potEl = $('#pot-amt'); const before = shown.pot; countTo(potEl, before, S.pot, 300); shown.pot = S.pot;
    $('#pot').classList.toggle('full', S.pot > 0);
    if (lang === 'ar') $('#pot-aed').textContent = S.pot ? `≈ ${fmt(S.pot / CFG.aedRate)} ${t('aed')}` : ''; else $('#pot-aed').textContent = '';
    const goals = goalState();
    $('#goals').innerHTML = `<span>${t('hud.goals')}</span>` + goals.map((g) => `<i class="${g.on ? 'on' : g.lost ? 'lost' : ''}" title="${g.label}" aria-label="${g.label}: ${g.on ? '✓' : '✗'}">${g.ic}</i>`).join('');
  }
  function goalState() {
    return [
      { ic: '🧵', label: t('goal.machine', { m: CFG.machineBy }), on: S.machine && S.machineMonth <= CFG.machineBy, lost: !S.machine && S.month > CFG.machineBy },
      { ic: '🫙', label: t('goal.jar', { n: fmt(CFG.jarGoal) }), on: S.jar >= CFG.jarGoal },
      { ic: '🕊️', label: t('goal.debt'), on: S.debt + S.owed === 0 },
      { ic: '🤝', label: t('goal.trust', { n: CFG.trustGoal }), on: S.trust >= CFG.trustGoal },
    ];
  }
  function toast(text, kind, x, y) {
    if (FAST) return;
    const el = document.createElement('div'); el.className = 'toast ' + (kind || 'info'); el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px'; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 1900);
  }
  const chipPos = (id) => { const r = $('.chip.' + id).getBoundingClientRect(), st = $('#stage').getBoundingClientRect(), s = st.width / 1280; return [(r.left - st.left + r.width / 2) / s, (r.bottom - st.top) / s + 26]; };
  function money(id, delta) { if (!delta) return; toast((delta > 0 ? '+' : '−') + fmt(Math.abs(delta)), delta > 0 ? 'pos' : 'neg', ...chipPos(id)); }
  function shake() { if (opts.calm || FAST) return; const s = $('#stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
  function react(id, emoji) { if (FAST) return; const seat = $('#seat-' + id); if (!seat) return; const e = document.createElement('div'); e.className = 'react'; e.textContent = emoji; seat.appendChild(e); setTimeout(() => e.remove(), 1600); }
  async function banner(big, small) {
    if (FAST) return; const b = $('#banner'); b.innerHTML = `<div><small>${small}</small><b>${big}</b></div>`; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); await sleep(1250);
  }
  function setNight(on) { nightMode = on; $('#stage').classList.toggle('night', on); }

  /* ---------- seats ---------- */
  const SEAT_POS = { comfort: [110, 282], fru: [290, 246], kingsley: [450, 222], aicha: [830, 222], ndolo: [990, 246], you: [1170, 282] };
  function drawSeats() {
    $('#seats').innerHTML = MEMBERS.map((m) => `
      <div class="seat ${m.id === 'you' ? 'you' : ''}" id="seat-${m.id}" style="left:${SEAT_POS[m.id][0]}px;top:${SEAT_POS[m.id][1]}px">
        <div class="bubble"></div>
        <div class="av" style="background-image:url(${m.img})" role="img" aria-label="${mname(m.id)}"></div>
        <div class="nm" data-i18n="m.${m.id}">${mname(m.id)}</div><div class="role" data-i18n="r.${m.id}">${t('r.' + m.id)}</div>
      </div>`).join('');
  }
  function bubble(id, html, cls = '') { const b = $(`#seat-${id} .bubble`); b.className = 'bubble ' + cls; b.innerHTML = html; requestAnimationFrame(() => b.classList.add('show')); }
  function clearBubbles() { document.querySelectorAll('.bubble').forEach((b) => b.classList.remove('show')); }
  function refreshSeats() { MEMBERS.forEach((m) => { const s = $('#seat-' + m.id); s.classList.toggle('won', !S.eligible.has(m.id)); s.classList.remove('winner'); s.querySelector('.av').dataset.took = t('seat.took'); }); }
  async function flyCoins(fromXY, toXY, n = 6) {
    if (FAST) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div'); c.className = 'coin';
      c.style.left = fromXY[0] - 13 + (R() * 20 - 10) + 'px'; c.style.top = fromXY[1] - 13 + 'px'; $('#stage').appendChild(c);
      requestAnimationFrame(() => requestAnimationFrame(() => { c.style.left = toXY[0] - 13 + (R() * 30 - 15) + 'px'; c.style.top = toXY[1] - 13 + 'px'; }));
      setTimeout(() => { c.style.opacity = 0; if (toXY === POT_XY) { const p = $('#pot'); p.classList.remove('gulp'); void p.offsetWidth; p.classList.add('gulp'); } }, 720); setTimeout(() => c.remove(), 950);
      if (i % 2 === 0) setTimeout(sfx.coin, 650);
      await sleep(70);
    }
  }
  const POT_XY = [640, 200];
  function confetti(n = 80) {
    if (opts.calm || FAST) return;
    const cols = ['#ffc42e', '#ff6b5b', '#13a89e', '#5cb531', '#3fa9f5', '#7b3fa0'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div'); c.className = 'confetti'; c.style.left = R() * 1280 + 'px'; c.style.top = -20 - R() * 120 + 'px';
      c.style.background = cols[i % cols.length]; c.style.animationDuration = 1.8 + R() * 1.4 + 's'; c.style.animationDelay = R() * 0.4 + 's';
      if (i % 3 === 0) c.style.borderRadius = '50%';
      $('#stage').appendChild(c); setTimeout(() => c.remove(), 3600);
    }
  }

  /* ---------- panel helper ---------- */
  function panel(html, onMount, phase) {
    const p = $('#panel'); p.classList.remove('hidden'); p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
    p.dataset.phase = phase || ''; p.innerHTML = html; if (onMount) onMount(p);
    p.querySelectorAll('.choice').forEach((c, i) => { if (!c.querySelector('.key')) c.insertAdjacentHTML('afterbegin', `<span class="key" aria-hidden="true">${i + 1}</span>`); });
    const first = p.querySelector('.btn.primary:not([disabled]), .choice:not([disabled])'); if (first && !FAST) first.focus({ preventScroll: true });
  }
  /* Show a panel and wait for a click; on language switch the same panel is rebuilt in the new language. */
  function ask(build, sel, phase) {
    return new Promise((res) => {
      const draw = () => { panel(build(), null, phase); document.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => { rerender = null; res(b.dataset.v); }, { once: true })); };
      rerender = draw; draw();
    });
  }
  addEventListener('keydown', (e) => {
    if (/^[1-4]$/.test(e.key) && !e.target.matches('input')) { const c = document.querySelectorAll('#panel:not(.hidden) .choice:not([disabled])')[Number(e.key) - 1]; if (c) c.click(); }
  });

  /* ---------- money ops ---------- */
  function addCash(v) { S.cash += v; money('cash', v); hud(); }
  function addJar(v) { S.jar += v; money('jar', v); hud(); }
  function borrow(v) { S.debt += v; S.stats.borrowed += v; money('debt', v); hud(); }
  function trust(v) { S.trust = Math.max(0, Math.min(100, S.trust + v)); toast((v > 0 ? '+' : '') + v + ' ' + t('hud.trust'), v > 0 ? 'pos' : 'neg', ...chipPos('trust')); hud(); }

  /** Pay a bill from the Jar, cash or Quick Cash. fundOnly = top up a missing contribution. */
  async function payBill(amount, whyKey, fundOnly = false) {
    const canJar = fundOnly ? S.jar >= amount : S.jar > 0 && S.jar + S.cash >= amount, canCash = !fundOnly && S.cash >= amount;
    const jarPart = Math.min(S.jar, amount);
    const v = await ask(() => `<span class="tag life">💸 ${t('bill.tag')}</span><h2>${t(whyKey)}: ${cur(amount)}</h2>
      <p>${t('bill.how')}</p>
      <div class="choices">
        <button class="choice" data-v="jar" ${canJar ? '' : 'disabled'}><span class="t">🫙 ${t('hud.jar')}</span><span class="s">${canJar ? (jarPart < amount ? t('bill.jarmix', { a: fmt(jarPart), b: fmt(amount - jarPart) }) : t('bill.jarok')) : t('bill.jarno')}</span></button>
        <button class="choice" data-v="cash" ${canCash ? '' : 'disabled'}><span class="t">💵 ${t('bill.cash')}</span><span class="s">${fundOnly ? t('bill.empty') : canCash ? t('bill.careful', { n: fmt(CFG.contrib) }) : t('bill.nocash')}</span></button>
        <button class="choice danger" data-v="loan"><span class="t">📛 ${t('bill.loan')}</span><span class="s">${t('bill.loans', { a: fmt(amount), b: fmt(amount * 1.2) })}</span></button>
      </div>`, '#panel .choice', 'bill');
    if (fundOnly) {
      if (v === 'jar') { S.jar -= amount; money('jar', -amount); S.stats.jarSaves++; } else { borrow(amount); shake(); }
      addCash(amount); return v;
    }
    if (v === 'jar') { S.jar -= jarPart; money('jar', -jarPart); if (amount > jarPart) addCash(-(amount - jarPart)); S.stats.jarSaves++; hud(); }
    else if (v === 'cash') addCash(-amount);
    else { borrow(amount); shake(); }
    return v;
  }

  /* ---------- EVENTS ----------
     tier 1 = gentle (month 1), 2 = medium, 3 = hard (months 4-6). Text lives in i18n.js under ev.<id>.* */
  const EVENTS = [
    { id: 'goodmonth', icon: '✂️', tier: 1, choices: [
      async () => { addCash(9000); return ['good', 'o0']; },
      async () => { addCash(12000 - 4000); trust(3); return ['good', 'o1']; }] },
    { id: 'scam', icon: '📱', tier: 1, choices: [
      async () => { const a = Math.min(S.cash, 5000); addCash(-a); S.stats.scamLost += a; shake(); return ['bad', 'o0']; },
      async () => { S.stats.scamDodged++; return ['good', 'o1']; },
      async () => { S.stats.scamDodged++; trust(4); return ['good', 'o2']; }] },
    { id: 'credit', icon: '🧾', tier: 1, choices: [
      async () => { const ok = R() < 0.5; S.pending.push({ month: S.month + 1, amount: ok ? 9000 : 0, why: ok ? 'pend.credit' : 'pend.nocredit' }); addCash(-2500); return ['info', 'o0']; },
      async () => { addCash(8000 - 2500); return ['good', 'o1']; }] },
    { id: 'festive', icon: '🎉', tier: 1, choices: [
      async () => { await payBill(10000, 'bill.party'); return ['bad', 'o0']; },
      async () => { addCash(-Math.min(S.cash, 2000)); if (R() < 0.5) { S.pending.push({ month: S.month + 1, amount: 6000, why: 'pend.party' }); return ['good', 'o1']; } return ['good', 'o1b']; },
      async () => ['info', 'o2']] },
    { id: 'wedding', icon: '👗', tier: 2, choices: [
      async () => { if (S.cash < 10000) await payBill(10000, 'bill.fabric'); else addCash(-10000); const ok = R() < 0.8; S.pending.push({ month: S.month + 1, amount: ok ? 22000 : 4000, why: ok ? 'pend.wedding' : 'pend.cancel' }); return ['info', 'o0']; },
      async () => { if (R() < 0.55) { addCash(11000 - 10000); S.pending.push({ month: S.month + 1, amount: 11000, why: 'pend.balance' }); return ['good', 'o1']; } return ['info', 'o1b']; },
      async () => ['info', 'o2']] },
    { id: 'phone', icon: '📵', tier: 2, choices: [
      async () => { await payBill(8000, 'bill.phone'); return ['good', 'o0']; },
      async () => { S.living += 5000; S.stats.bnpl = true; shake(); return ['bad', 'o1']; },
      async () => { if (R() < 0.4) { addCash(-Math.min(S.cash, 3000)); return ['bad', 'o2']; } return ['info', 'o2b']; }] },
    { id: 'funeral', icon: '🕊️', tier: 2, choices: [
      async () => { await payBill(5000, 'bill.funeral'); trust(6); return ['good', 'o0']; },
      async () => { addCash(-Math.min(S.cash, 1000)); trust(1); return ['info', 'o1']; },
      async () => { trust(-8); return ['bad', 'o2']; }] },
    { id: 'doubler', icon: '🎲', tier: 2, choices: [
      async () => { await payBill(10000, 'bill.invest'); S.stats.scamLost += 10000; shake(); return ['bad', 'o0']; },
      async () => { S.stats.scamDodged++; return ['good', 'o1']; }] },
    { id: 'family', icon: '👨‍👩‍👧', tier: 2, choices: [
      async () => { await payBill(8000, 'bill.uncle'); if (R() < 0.5) S.pending.push({ month: S.month + 3, amount: 8000, why: 'pend.uncle' }); return ['info', 'o0']; },
      async () => { addCash(-Math.min(S.cash, 3000)); return ['good', 'o1']; },
      async () => ['info', 'o2']] },
    { id: 'malaria', icon: '🤒', tier: 3, choices: [
      async () => { await payBill(12000, 'bill.clinic'); return ['good', 'o0']; },
      async () => { addCash(-Math.min(S.cash, 2000)); if (R() < 0.6) { addCash(-Math.min(S.cash, 8000)); shake(); return ['bad', 'o1']; } return ['good', 'o1b']; }] },
    { id: 'eneo', icon: '💡', tier: 3, choices: [
      async () => { await payBill(4000, 'bill.gen'); return ['good', 'o0']; },
      async () => { addCash(-Math.min(S.cash, S.machine ? 9000 : 6000)); shake(); return ['bad', 'o1']; }] },
    { id: 'rent', icon: '🏠', tier: 3, choices: [
      async () => { S.living += 3000; return ['bad', 'o0']; },
      async () => { if (S.cash + S.jar < 9000) { S.living += 3000; return ['bad', 'o1b']; } await payBill(9000, 'bill.rent'); for (let k = 1; k <= 3; k++) S.pending.push({ month: S.month + k, amount: 3000, why: 'pend.rent' }); return ['good', 'o1']; }] },
    { id: 'machinebreak', icon: '🔧', tier: 3, needs: (s) => s.machine, choices: [
      async () => { await payBill(6000, 'bill.repair'); return ['good', 'o0']; },
      async () => { const lost = Math.min(S.cash, CFG.machineBoost); addCash(-lost); shake(); return ['bad', 'o1']; }] },
  ];
  function drawEvent() {
    const forced = params.get('ev' + S.month); // used by the trailer recorder
    if (forced && EVENTS.find((e) => e.id === forced)) { S.used.add(forced); return EVENTS.find((e) => e.id === forced); }
    const tiers = S.month === 1 ? [1] : S.month <= 3 ? [1, 2, 2] : [2, 3, 3, 3];
    for (let tries = 0; tries < 40; tries++) {
      const tier = tiers[Math.floor(R() * tiers.length)];
      const pool = EVENTS.filter((e) => e.tier === tier && !S.used.has(e.id) && (!e.needs || e.needs(S)));
      if (pool.length) { const e = pool[Math.floor(R() * pool.length)]; S.used.add(e.id); return e; }
    }
    return EVENTS.find((e) => !S.used.has(e.id) && !e.needs) || EVENTS[1];
  }

  /* ---------- screens ---------- */
  function langButtons() { return `<div class="langs" role="group" aria-label="Language">${[['en', 'English'], ['fr', 'Français'], ['ar', 'العربية']].map(([k, l]) => `<button data-lang="${k}" aria-pressed="${k === lang}">${l}</button>`).join('')}</div>`; }
  function bindLangs(root) { root.querySelectorAll('.langs button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang))); }
  function titleScreen() {
    setNight(false); rerender = null;
    $('#hud').classList.add('hidden'); $('#circle').classList.add('hidden'); $('#panel').classList.add('hidden');
    const best = saved('best', null);
    $('#screen').innerHTML = `<div class="shade"></div>${langButtons()}<div class="title-card">
      <div class="kicker">${t('title.kicker')}</div>
      <h1>${t('title.h1a')} <span>${t('title.h1b')}</span></h1>
      <div class="sub">${t('title.sub')}</div>
      <div class="lineup">${MEMBERS.map((m) => `<div style="background-image:url(${m.img})" title="${mname(m.id)}"></div>`).join('')}</div>
      <button class="btn primary big-cta" id="btn-play">▶ ${t('title.play')}</button>
      ${best ? `<div class="best">🏆 ${t('title.best', { n: cur(best.net), s: '⭐'.repeat(best.stars) || '—' })}</div>` : ''}
      <div class="how">
        <div><b>💵 ${t('how1.t')}</b>${t('how1.d')}</div>
        <div><b>🔨 ${t('how2.t')}</b>${t('how2.d', { n: fmt(CFG.contrib * CFG.months) })}</div>
        <div><b>🧵 ${t('how3.t')}</b>${t('how3.d')}</div>
      </div></div>`;
    bindLangs($('#screen'));
    $('#btn-play').addEventListener('click', startGame);
  }

  async function startGame() {
    S = newState(); for (const k in shown) delete shown[k];
    $('#screen').innerHTML = ''; $('#hud').classList.remove('hidden'); $('#circle').classList.remove('hidden');
    drawSeats(); refreshSeats(); hud();
    await ask(() => `<span class="tag">🧵 ${t('intro.tag')}</span><h2>${t('intro.h')}</h2>
      <p>${t('intro.p', { m: cur(CFG.machineCost), c: fmt(CFG.contrib), pot: fmt(CFG.contrib * CFG.months), by: CFG.machineBy })}</p>
      <p class="note info">${t('intro.note', { pot: fmt(CFG.contrib * CFG.months) })}</p>
      <div class="actions"><button class="btn primary" data-act="next">${t('btn.go')}</button></div>`, '#panel .btn', 'intro');
    monthLoop();
  }

  async function monthLoop() {
    while (S.month <= CFG.months) {
      hud(); refreshSeats(); clearBubbles(); S.pot = 0; hud();
      await banner(t('banner.month', { m: S.month }), S.month === CFG.months ? t('banner.last') : t('banner.of', { m: S.month, n: CFG.months }));
      await payday();
      await plan();
      await lifeEvent();
      await njangiNight();
      await monthEnd();
      S.month++;
    }
    S.month = CFG.months; S.over = true;
    endScreen();
  }

  async function payday() {
    const inc = CFG.income + (S.machine ? CFG.machineBoost : 0);
    if (S.machine) S.stats.machineEarned += CFG.machineBoost;
    const due = S.pending.filter((p) => p.month === S.month); S.pending = S.pending.filter((p) => p.month !== S.month);
    const extra = due.reduce((a, p) => a + p.amount, 0);
    const owedPay = Math.min(S.owed, Math.max(0, S.cash + inc + extra - S.living));
    const rows = () => { const r = [[S.machine ? t('pay.incm', { n: fmt(CFG.machineBoost) }) : t('pay.inc'), inc], ...due.map((p) => [t(p.why), p.amount]), [t('pay.living'), -S.living]]; if (owedPay) r.push([t('pay.owed'), -owedPay]); return r; };
    const net = rows().reduce((a, r) => a + r[1], 0);
    await ask(() => `<span class="tag pay">💰 ${t('pay.tag', { m: S.month, n: CFG.months })}</span><h2>${S.month === 1 ? t('pay.h1') : t('pay.h')}</h2>
      <div class="ledger">${rows().map(([k, v]) => `<span>${k}</span><span class="num ${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}</span>`).join('')}
      <span class="tot">${t('pay.change')}</span><span class="tot num ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span></div>
      ${S.living > CFG.living ? `<p class="note bad">${t('pay.livingup', { n: fmt(S.living - CFG.living) })}</p>` : ''}
      <div class="actions"><button class="btn primary" data-act="next">${t('pay.collect')}</button></div>`, '#panel .btn', 'payday');
    addCash(net); S.owed -= owedPay; hud(); sfx.coin();
  }

  async function plan() {
    let toJar = 0, repay = 0;
    const step = 2500;
    const left = () => S.cash - toJar - repay;
    const render = () => {
      panel(`<span class="tag">🗂️ ${t('plan.tag')}</span><h2>${t('plan.h')}</h2>
        <p>${t('plan.p', { r: Math.round(CFG.leakRate * 100) })}</p>
        <div class="stepper"><div class="lab">🫙 ${t('plan.jar')} <small>${t('plan.jarnow', { a: fmt(S.jar + toJar), g: fmt(CFG.jarGoal) })}</small>
          <div class="bar"><i style="width:${Math.min(100, (S.jar + toJar) / CFG.jarGoal * 100)}%"></i></div></div>
          <button data-a="jar-" aria-label="${t('plan.less')}">−</button><div class="val num">${toJar < 0 ? '−' : ''}${fmt(Math.abs(toJar))}</div><button data-a="jar+" aria-label="${t('plan.more')}">+</button></div>
        ${S.debt > 0 ? `<div class="stepper" style="margin-top:8px"><div class="lab">📛 ${t('plan.repay')} <small>${t('plan.debt', { n: fmt(S.debt) })}</small></div>
          <button data-a="rep-" aria-label="${t('plan.less')}">−</button><div class="val num">${fmt(repay)}</div><button data-a="rep+" aria-label="${t('plan.more')}">+</button></div>` : ''}
        <div class="actions"><span class="note ${left() < CFG.contrib ? 'bad' : 'good'}" style="margin-inline-end:auto">💵 ${t('plan.left', { n: fmt(left()), c: fmt(CFG.contrib) })}</span>
        <button class="btn ghost" data-a="auto">✨ ${t('plan.auto', { c: fmt(CFG.contrib) })}</button>
        <button class="btn primary" data-act="plan-done">${t('btn.done')}</button></div>`, (p) => {
        p.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
          const a = b.dataset.a;
          if (a === 'jar+' && left() > 0) toJar += Math.min(step, left());
          if (a === 'jar-' && (toJar > 0 || S.jar + toJar >= step)) toJar = toJar > 0 ? Math.max(0, toJar - step) : toJar - step;
          if (a === 'rep+' && left() > 0 && repay < S.debt) repay += Math.min(step, S.debt - repay, left());
          if (a === 'rep-' && repay > 0) repay = Math.max(0, repay - step);
          if (a === 'auto') { // keep the contribution in pocket, repay debt first, jar the rest
            toJar = 0; repay = 0; let free = Math.max(0, S.cash - CFG.contrib);
            if (S.debt > 0) { repay = Math.min(S.debt, free); free -= repay; }
            toJar = Math.floor(free / 500) * 500;
            if (S.cash < CFG.contrib && S.jar > 0) toJar = -Math.min(S.jar, Math.ceil((CFG.contrib - S.cash) / 500) * 500);
          }
          render();
        }));
        p.querySelector('[data-act=plan-done]').addEventListener('click', () => { rerender = null; resolve(); });
      }, 'plan');
    };
    let resolve; rerender = render;
    render();
    await new Promise((r) => (resolve = r));
    if (toJar) { S.cash -= toJar; money('cash', -toJar); addJar(toJar); if (toJar > 0) flyCoins([1170, 300], chipPos('jar'), 3); }
    if (repay) { S.cash -= repay; S.debt -= repay; money('cash', -repay); money('debt', -repay); hud(); }
  }

  async function lifeEvent() {
    const ev = drawEvent(), k = 'ev.' + ev.id + '.';
    const i = Number(await ask(() => `<span class="tag life">⚡ ${t('ev.tag')}</span><div class="ev-icon" aria-hidden="true">${ev.icon}</div><h2>${t(k + 'title')}</h2><p>${t(k + 'text')}</p>
      <div class="choices">${ev.choices.map((_, j) => `<button class="choice" data-v="${j}"><span class="t">${t(k + 'c' + j)}</span><span class="s">${t(k + 'c' + j + 's')}</span></button>`).join('')}</div>`, '#panel .choice', 'event'));
    const out = await ev.choices[i]();
    (out[0] === 'bad' ? sfx.bad : out[0] === 'good' ? sfx.good : sfx.click)();
    react('you', out[0] === 'bad' ? '😣' : out[0] === 'good' ? '😄' : '🤔');
    hud();
    await ask(() => `<span class="tag life">${ev.icon} ${t(k + 'title')}</span><h2>${t('out.' + out[0])}</h2>
      <p class="note ${out[0]}">${t(k + out[1])}</p><div class="actions"><button class="btn primary" data-act="next">${t('btn.tonjangi')}</button></div>`, '#panel .btn', 'eventResult');
  }

  async function njangiNight() {
    const monthsLeft = CFG.months - S.month + 1;
    setNight(true);
    const v = await ask(() => `<span class="tag night">🌙 ${t('night.tag', { m: S.month })}</span><h2>${t('night.h')}</h2>
      <p>${t('night.p', { c: cur(CFG.contrib) })}</p>
      <div class="actions">${S.cash >= CFG.contrib ? `<button class="btn primary" data-v="pay" data-act="contribute">${t('night.pay', { c: fmt(CFG.contrib) })}</button>`
        : `<span class="note bad" style="margin-inline-end:auto">${t('night.short', { n: fmt(S.cash) })}</span><button class="btn plum" data-v="cover" data-act="contribute">${t('night.find')}</button><button class="btn ghost" data-v="default">${t('night.skip')}</button>`}</div>`, '#panel .btn', 'contribute');
    sfx.drum();
    if (v === 'pay') { addCash(-CFG.contrib); trust(CFG.contribTrust); }
    else if (v === 'cover') { const need = CFG.contrib - S.cash; await payBill(need, 'bill.contrib', true); addCash(-CFG.contrib); trust(1); }
    else { S.owed += CFG.contrib + CFG.defaultFine; S.stats.defaults++; trust(-20); sfx.bad(); shake(); MEMBERS.filter((m) => m.id !== 'you').forEach((m) => react(m.id, '😠')); }
    $('#panel').classList.add('hidden');
    for (const m of MEMBERS) { flyCoins(SEAT_POS[m.id], POT_XY, 4); S.pot += CFG.contrib; hud(); await sleep(220); }
    await sleep(500);

    // needs & bids
    const ai = MEMBERS.filter((m) => m.id !== 'you' && S.eligible.has(m.id));
    const needs = {}; ai.forEach((m) => { needs[m.id] = aiNeed(m, S.month, R); });
    const lines = {}; ai.forEach((m) => { const lv = needLevel(needs[m.id], m.style); const arr = t('need.' + lv); lines[m.id] = [lv, Math.floor(R() * arr.length)]; });
    const showNeeds = () => ai.forEach((m) => { const [lv, j] = lines[m.id]; bubble(m.id, `<span class="need ${lv}">${{ high: '🔥', mid: '🙂', low: '😌', zero: '🤲' }[lv]}</span> ${t('need.' + lv)[j]}`); });
    showNeeds();
    const youEligible = S.eligible.has('you');
    let myBid = 0;
    if (monthsLeft === 1) {
      await ask(() => `<span class="tag night">🌙 ${t('last.tag')}</span><h2>${t('last.h')}</h2><p>${t('last.p')}</p><div class="actions"><button class="btn primary" data-act="reveal">${t('last.btn')}</button></div>`, '#panel .btn', 'lastnight');
    } else if (youEligible) {
      myBid = await bidPanel(monthsLeft, showNeeds);
    } else {
      await ask(() => `<span class="tag night">🌙 ${t('auc.tag')}</span><h2>${t('sit.h', { m: S.wonMonth })}</h2><p>${t('sit.p')}</p><div class="actions"><button class="btn primary" data-act="reveal">${t('sit.btn')}</button></div>`, '#panel .btn', 'sitback');
    }

    // reveal
    clearBubbles(); $('#panel').classList.add('hidden'); await sleep(250);
    const bids = ai.map((m) => ({ id: m.id, amount: aiBid(m, needs[m.id], S.month, monthsLeft, R) }));
    if (youEligible) bids.push({ id: 'you', amount: Math.max(0, myBid) });
    if (monthsLeft === 1) bids.forEach((b) => (b.amount = 0));
    if (monthsLeft > 1) { sfx.roll(); await sleep(900); }
    const order = bids.slice().sort((a, b) => a.amount - b.amount);
    for (const b of order) { bubble(b.id, b.amount ? fmt(b.amount) : t('bid.pass'), 'bid flip ' + (b.amount ? '' : 'pass')); sfx.flip(); await sleep(380); }
    const res = resolveAuction(bids, R);
    await sleep(400);
    const wb = $(`#seat-${res.winner} .bubble`); if (wb && res.bid) wb.classList.add('top');
    $('#seat-' + res.winner).classList.add('winner'); sfx.gavel(); stamp(res.winner, res.bid ? t('stamp.sold') : res.lots ? t('stamp.lots') : t('stamp.free'));
    await sleep(350); sfx.win(); react(res.winner, res.winner === 'you' ? '🤩' : '🎉');
    await sleep(500);
    const got = S.pot - res.bid, share = Math.floor(res.bid / (CFG.months - 1));
    flyCoins(POT_XY, SEAT_POS[res.winner], 10);
    S.pot = 0; hud();
    S.eligible.delete(res.winner);
    S.history.push({ month: S.month, winner: res.winner, bid: res.bid, lots: res.lots, early: monthsLeft - 1 });
    if (res.winner !== 'you' && share) { S.cash += share; S.stats.shares += share; await sleep(500); toast('+' + fmt(share) + ' ' + t('toast.share'), 'pos', SEAT_POS.you[0], SEAT_POS.you[1] - 80); money('cash', share); hud(); }
    await sleep(700);

    if (res.winner === 'you') {
      confetti(); S.won = true; S.wonMonth = S.month; S.wonBid = res.bid; S.wonGot = got;
      addCash(got);
      await usePot(got, res.bid, monthsLeft);
    } else {
      const rate = impliedRate(res.bid, CFG.months * CFG.contrib, monthsLeft - 1), w = mname(res.winner);
      await ask(() => `<span class="tag night">🏆 ${t('win.tag', { w })}</span><h2>${res.bid ? t('win.hbid', { w, b: fmt(res.bid) }) : res.lots ? t('win.hlots') : t('win.hfree')}</h2>
        <p>${res.bid ? t('win.pbid', { w, g: fmt(got), b: fmt(res.bid), s: fmt(share) }) : t('win.pfree', { w, g: fmt(got) })}</p>
        ${res.bid ? `<p class="note info">${t('win.rate', { w, r: pct(rate), q: Math.round(CFG.quickRate * 100) })}</p>` : ''}
        <div class="actions"><button class="btn primary" data-act="next">${t('btn.continue')}</button></div>`, '#panel .btn', 'winner');
    }
    clearBubbles(); document.querySelectorAll('.stamp').forEach((s) => s.remove());
    setNight(false);
  }
  function stamp(id, text) { if (FAST) return; const s = document.createElement('div'); s.className = 'stamp'; s.textContent = text; s.style.left = SEAT_POS[id][0] + 'px'; s.style.top = SEAT_POS[id][1] + 60 + 'px'; $('#circle').appendChild(s); }

  function bidPanel(monthsLeft, showNeeds) {
    return new Promise((resolve) => {
      const pot = CFG.months * CFG.contrib, early = monthsLeft - 1;
      let b = 0;
      const meter = () => {
        const rate = impliedRate(b, pot, early);
        const col = rate > 0.1 ? 'bad' : rate > 0.04 ? 'mid' : 'ok';
        return `<div class="meter"><div><small>${t('bid.get')}</small><b>${fmt(pot - b)}</b></div>
          <div><small>${t('bid.each')}</small><b>${fmt(Math.floor(b / (CFG.months - 1)))}</b></div>
          <div class="rate ${b ? col : 'ok'}"><small>${t('bid.price')}</small><b>${b ? t('bid.permonth', { r: pct(rate) }) : t('bid.free')}</b></div></div>`;
      };
      const draw = () => {
        panel(`<span class="tag night">🔨 ${t('auc.tag2')}</span><h2>${t('bid.h')}</h2>
          <p>${t(early > 1 ? 'bid.p' : 'bid.p1', { e: early })} ${S.machine ? '' : `<b>${t('bid.machine', { n: fmt(CFG.machineCost), by: CFG.machineBy })}</b>`}</p>
          <p class="legend">${t('bid.legend')}</p>
          <div class="bidbox"><input id="bid" type="range" min="0" max="${CFG.maxBid}" step="${CFG.bidStep}" value="${b}" aria-label="${t('bid.aria')}"><div class="bidval" id="bidval">${b ? fmt(b) : t('bid.pass').toUpperCase()}</div></div>
          <div id="meter">${meter()}</div>
          <div class="actions"><button class="btn ghost" data-act="pass" id="b-pass">${t('bid.passbtn')}</button><button class="btn primary" id="b-bid" data-act="bid" ${b ? '' : 'disabled'}>${t('bid.place')}</button></div>`,
        (p) => {
          const r = p.querySelector('#bid');
          r.addEventListener('input', () => { b = Number(r.value); p.querySelector('#bidval').textContent = b ? fmt(b) : t('bid.pass').toUpperCase(); p.querySelector('#meter').innerHTML = meter(); p.querySelector('#b-bid').disabled = !b; if (b % 3000 === 0) tone(300 + b / 40, 0.04, 'triangle', 0.04); });
          p.querySelector('#b-pass').addEventListener('click', () => { rerender = null; resolve(0); });
          p.querySelector('#b-bid').addEventListener('click', () => { rerender = null; resolve(b); });
        }, 'auction');
      };
      rerender = () => { draw(); showNeeds(); }; draw();
    });
  }

  async function usePot(got, bid, monthsLeft) {
    const rate = impliedRate(bid, CFG.months * CFG.contrib, monthsLeft - 1);
    for (;;) {
      const v = await ask(() => {
        const short = S.cash + S.jar < CFG.machineCost;
        return `<span class="tag night">🏆 ${t('pot.tag')}</span><h2>${t('pot.h', { g: cur(got) })}</h2>
        <p>${bid ? t('pot.pbid', { b: fmt(bid), e: monthsLeft - 1, r: pct(rate) }) : t('pot.pfree')} ${t('pot.still', { c: fmt(CFG.contrib) })}</p>
        <div class="choices">
          <button class="choice" data-v="machine" ${S.machine || short ? 'disabled' : ''}><span class="t">🧵 ${t('pot.buy')}</span><span class="s">${S.machine ? t('pot.have') : short ? t('pot.need', { n: fmt(CFG.machineCost) }) : t('pot.buys', { n: fmt(CFG.machineCost), b: fmt(CFG.machineBoost) }) + (S.cash < CFG.machineCost ? ' ' + t('pot.usesjar') : '')}</span></button>
          <button class="choice" data-v="jar" ${S.cash < 2500 ? 'disabled' : ''}><span class="t">🫙 ${t('pot.jar', { n: fmt(Math.min(10000, Math.max(0, S.cash))) })}</span><span class="s">${t('pot.jars', { n: fmt(S.jar) })}</span></button>
          <button class="choice" data-v="debt" ${S.debt <= 0 || S.cash <= 0 ? 'disabled' : ''}><span class="t">📛 ${t('pot.debt')}</span><span class="s">${S.debt ? t('plan.debt', { n: fmt(S.debt) }) : t('pot.nodebt')}</span></button>
        </div>
        <div class="actions"><span class="note" style="margin-inline-end:auto">💵 ${t('hud.cash')}: <b>${fmt(S.cash)}</b></span><button class="btn primary" data-v="done" data-act="done">${t('btn.done')}</button></div>`;
      }, '#panel .choice, #panel .btn', 'potyours');
      if (v === 'done') break;
      if (v === 'machine') { const fromCash = Math.min(S.cash, CFG.machineCost); addCash(-fromCash); if (CFG.machineCost > fromCash) addJar(-(CFG.machineCost - fromCash)); S.machine = true; S.machineMonth = S.month; sfx.good(); confetti(); toast('🧵 ' + t('toast.machine'), 'info', 640, 330); react('you', '🧵'); $('#seat-you').classList.add('has-machine'); }
      if (v === 'jar') { const a = Math.min(10000, S.cash); addCash(-a); addJar(a); }
      if (v === 'debt') { const a = Math.min(S.debt, S.cash); addCash(-a); S.debt -= a; money('debt', -a); hud(); }
    }
  }

  async function monthEnd() {
    const rows = [];
    if (S.debt > 0) { const i = Math.round(S.debt * CFG.quickRate); S.debt += i; S.stats.interest += i; rows.push(['📛 ' + t('end.int', { q: Math.round(CFG.quickRate * 100) }), -i, 'debt']); }
    const leak = S.cash > CFG.leakFloor ? round500((S.cash - CFG.leakFloor) * CFG.leakRate) : 0;
    if (leak) { S.cash -= leak; S.stats.leak += leak; rows.push(['💵 ' + t('end.leak'), -leak, 'cash']); }
    hud();
    rows.forEach(([, v, chip]) => money(chip, chip === 'debt' ? -v : v));
    const last = S.month === CFG.months;
    await ask(() => `<span class="tag end">📅 ${t('end.tag', { m: S.month })}</span><h2>${last ? t('end.hlast') : t('end.h')}</h2>
      ${rows.length ? `<div class="ledger">${rows.map(([k, v]) => `<span>${k}</span><span class="num neg">−${fmt(Math.abs(v))}</span>`).join('')}</div>` : `<p class="note good">${t('end.clean')}</p>`}
      ${leak > 1500 ? `<p class="note">${t('end.tip')}</p>` : ''}
      ${S.month === CFG.machineBy && !S.machine ? `<p class="note bad">${t('end.missed', { m: CFG.machineBy })}</p>` : ''}
      <div class="actions"><button class="btn primary" data-act="next">${last ? t('end.results') : t('end.next')}</button></div>`, '#panel .btn', 'monthend');
  }

  function results() {
    const stars = goalState();
    const nStars = stars.filter((s) => s.on).length;
    const net = S.cash + S.jar - S.debt - S.owed + (S.machine ? 40000 : 0);
    return { stars, nStars, net };
  }
  function endScreen() {
    rerender = null; $('#panel').classList.add('hidden'); setNight(false);
    const { stars, nStars, net } = results();
    if (!S.recorded) {
      S.recorded = true; const best = saved('best', null);
      S.newBest = !best || net > best.net; if (S.newBest) save('best', { net, stars: nStars });
    }
    const L = [];
    if (S.won && S.wonBid) { const r = impliedRate(S.wonBid, 60000, CFG.months - S.wonMonth); L.push([t('l.bid.t'), t('l.bid.d', { b: fmt(S.wonBid), m: S.wonMonth, r: pct(r), y: Math.round(r * 1200) }) + ' ' + (S.machine && S.machineMonth === S.wonMonth ? t('l.bid.paid', { n: fmt(S.stats.machineEarned) }) : t('l.bid.worth'))]); }
    else if (S.won) L.push([t('l.free.t'), t('l.free.d', { m: S.wonMonth })]);
    if (S.stats.shares) L.push([t('l.wait.t'), t('l.wait.d', { n: fmt(S.stats.shares) })]);
    if (S.stats.borrowed) L.push([t('l.qc.t'), t('l.qc.d', { b: fmt(S.stats.borrowed), i: fmt(S.stats.interest) })]);
    else L.push([t('l.noqc.t'), t('l.noqc.d')]);
    if (S.stats.jarSaves) L.push([t('l.jar.t'), t('l.jar.d', { n: S.stats.jarSaves })]);
    if (S.stats.scamLost) L.push([t('l.scam.t'), t('l.scam.d', { n: fmt(S.stats.scamLost) })]);
    else if (S.stats.scamDodged) L.push([t('l.radar.t'), t('l.radar.d', { n: S.stats.scamDodged })]);
    if (S.stats.leak > 2000) L.push([t('l.leak.t'), t('l.leak.d', { n: fmt(S.stats.leak) })]);
    if (S.stats.bnpl) L.push([t('l.bnpl.t'), t('l.bnpl.d')]);
    if (S.stats.defaults) L.push([t('l.def.t'), t('l.def.d')]);
    L.push([t('l.aicha.t'), t('l.aicha.d')]);
    const title = t('end.titles')[nStars];
    const rates = S.history.filter((h) => h.bid).map((h) => ({ who: h.winner, m: h.month, r: impliedRate(h.bid, 60000, h.early) }));
    const maxR = CFG.quickRate;
    $('#screen').innerHTML = `<div class="shade"></div><div class="end-card">
      <div class="end-head"><div><span class="tag end">🎓 ${t('end.year')}</span><h2 class="end-title">${title}</h2></div>
        <div class="end-acts"><button class="btn ghost" id="btn-menu">${t('end.menu')}</button><button class="btn primary" id="btn-again" data-act="again">${t('end.again')}</button></div>
        <div class="networth"><small>${t('end.net')}</small><div class="num ${net >= 0 ? 'pos' : 'neg'}" id="net">${fmt(net)} ${t('cur')}</div>${S.newBest ? `<span class="newbest">🏆 ${t('end.newbest')}</span>` : ''}</div></div>
      <div class="stars">${stars.map((s, i) => `<div class="star ${s.on ? 'on' : ''}" style="animation-delay:${i * 0.25}s"><span class="st">⭐</span><span>${s.ic} ${s.label}</span></div>`).join('')}</div>
      <div class="end-grid">
        <div class="ratebox"><b>${t('end.rates')}</b>
          ${rates.map((x) => `<div class="rrow"><span>${mname(x.who)} · ${t('hud.month')} ${x.m}</span><div class="rbar"><i class="${x.who === 'you' ? 'you' : ''}" style="width:${Math.min(100, x.r / maxR * 100)}%"></i></div><em>${pct(x.r)}</em></div>`).join('')}
          <div class="rrow"><span>📛 Quick Cash</span><div class="rbar"><i class="qc" style="width:100%"></i></div><em>${pct(CFG.quickRate)}</em></div>
          <small>${t('end.ratenote')}</small></div>
        <div class="timeline">${S.history.map((h) => `<div class="${h.winner === 'you' ? 'me' : ''}"><small>${t('hud.month')} ${h.month}</small><img src="${MEMBERS.find((x) => x.id === h.winner).img}" alt="">${mname(h.winner)}<br><span class="${h.bid ? 'neg' : 'pos'}">${h.bid ? t('end.bid', { b: fmt(h.bid) }) : t('end.nobid')}</span></div>`).join('')}</div>
      </div>
      <div class="lessons">${(L.length > 4 ? [...L.slice(0, 3), L[L.length - 1]] : L).map(([a, d]) => `<div class="lesson"><b>${a}</b>${d}</div>`).join('')}</div>
      </div>`;
    if (!FAST) stars.forEach((s, i) => { if (s.on) setTimeout(() => sfx.star(i), 300 + i * 250); });
    if (nStars >= 3) { setTimeout(sfx.win, 1300); confetti(120); }
    $('#btn-again').addEventListener('click', () => { R = rng(Date.now() & 0xffffff); startGame(); });
    $('#btn-menu').addEventListener('click', () => { S = null; titleScreen(); });
  }

  /* ---------- settings ---------- */
  const tog = (id, key, fn) => { const el = $('#' + id); el.checked = !!opts[key]; el.addEventListener('change', (e) => { opts[key] = e.target.checked; save(key === 'calm' ? 'calm' : key, opts[key]); fn && fn(opts[key]); }); };
  $('#btn-settings').addEventListener('click', () => $('#settings').classList.toggle('hidden'));
  $('#settings-close').addEventListener('click', () => $('#settings').classList.add('hidden'));
  tog('opt-big', 'big', (v) => document.body.classList.toggle('big', v));
  tog('opt-motion', 'calm', (v) => document.body.classList.toggle('calm', v));
  tog('opt-sound', 'sound');
  tog('opt-music', 'music', (v) => (v ? musicOn() : musicOff()));
  tog('opt-simple', 'simple', () => rerender && rerender());
  document.body.classList.toggle('big', opts.big); document.body.classList.toggle('calm', opts.calm);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && saved('calm', null) === null) { $('#opt-motion').checked = true; opts.calm = true; document.body.classList.add('calm'); }
  bindLangs($('#settings'));

  applyLang();
  titleScreen();
  window.__njangi = { get state() { return S; }, results: () => S && results(), setLang, t, EVENTS };
})();
