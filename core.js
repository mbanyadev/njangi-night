/* njangi-core: pure rules for a bidding njangi (no DOM). Shared with the Decentraland SDK7 scene. */
(function (root) {
  const CFG = {
    months: 6, contrib: 10000, income: 25000, machineBoost: 9000, living: 13000,
    machineCost: 50000, quickRate: 0.20, jarGoal: 20000, trustGoal: 70,
    leakRate: 0.08, leakFloor: 6000, defaultFine: 2000, startCash: 14000, startTrust: 60,
    maxBid: 15000, bidStep: 1000,
  };

  const MEMBERS = [
    { id: 'comfort', name: 'Mama Comfort', role: 'President · market queen', img: 'assets/p-comfort.jpg', style: 'fair' },
    { id: 'fru', name: 'Pa Fru', role: 'Retired teacher', img: 'assets/p-fru.jpg', style: 'patient' },
    { id: 'kingsley', name: 'Kingsley', role: 'Bendskin driver', img: 'assets/p-kingsley.jpg', style: 'impulsive' },
    { id: 'aicha', name: 'Aïcha', role: 'Hairdresser', img: 'assets/p-aicha.jpg', style: 'nointerest' },
    { id: 'ndolo', name: 'Ndolo', role: 'Douala trader', img: 'assets/p-ndolo.jpg', style: 'aggressive' },
    { id: 'you', name: 'You', role: 'Young tailor', img: 'assets/p-you.jpg', style: 'player' },
  ];

  function rng(seed) { // mulberry32 — seeded so runs are reproducible
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  const round500 = (x) => Math.max(0, Math.round(x / 500) * 500);

  /** Need = how badly an AI member wants the pot this month (0..1). */
  function aiNeed(member, month, r) {
    const base = { fair: 0.35, patient: 0.15, impulsive: 0.45, nointerest: 0, aggressive: 0.6 }[member.style] || 0.3;
    const spike = r() < (member.style === 'impulsive' ? 0.45 : 0.2) ? 0.45 : 0;
    return Math.min(1, base + spike + (r() - 0.5) * 0.2);
  }

  const NEED_LINES = {
    high: ['My shop roof is leaking — I need it now!', 'School fees are due Monday…', 'A big container of goods is waiting at the port!', 'My moto broke down. No moto, no money.'],
    mid: ['It would help, but I can wait a little.', 'I have a small plan for this money.', 'Maybe… depending on the price.'],
    low: ['No rush for me. Waiting pays.', 'I am happy to collect my share.', 'Let the hungry ones bid.'],
    nointerest: ['I don’t pay or take interest. I’ll wait my turn.'],
  };

  /** AI sealed bid for this month. remaining = members still eligible (incl. this month). */
  function aiBid(member, need, month, monthsLeft) {
    if (member.style === 'nointerest') return 0;
    if (monthsLeft <= 1) return 0;
    const timeFactor = (monthsLeft - 1) / (CFG.months - 1); // early pot is worth more
    const raw = need * CFG.maxBid * (0.35 + 0.75 * timeFactor);
    return need < 0.2 ? 0 : Math.min(CFG.maxBid, round500(raw));
  }

  /** Resolve sealed bids: highest wins; tie → lots. If all zero → lots among eligible. */
  function resolveAuction(bids, r) {
    const max = Math.max(...bids.map((b) => b.amount));
    const top = bids.filter((b) => b.amount === max);
    const w = top[Math.floor(r() * top.length)];
    return { winner: w.id, bid: w.amount, lots: top.length > 1 };
  }

  /** Implicit monthly cost of taking the pot early by bidding. */
  function impliedRate(bid, pot, monthsEarly) {
    if (bid <= 0 || monthsEarly <= 0) return 0;
    return bid / (pot - bid) / monthsEarly;
  }

  root.NjangiCore = { CFG, MEMBERS, rng, aiNeed, aiBid, resolveAuction, impliedRate, NEED_LINES, round500 };
})(typeof window !== 'undefined' ? window : globalThis);
