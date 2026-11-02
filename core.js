/* njangi-core: pure rules for a bidding njangi (no DOM). Shared with the Decentraland SDK7 scene. (c) Mbanya Dev */
(function (root) {
  const CFG = {
    months: 6, contrib: 10000, income: 25000, machineBoost: 8000, living: 13000,
    machineCost: 50000, machineBy: 4, quickRate: 0.20, jarGoal: 25000, trustGoal: 72,
    leakRate: 0.10, leakFloor: 5000, defaultFine: 2000, startCash: 12000, startTrust: 60,
    maxBid: 18000, bidStep: 1000, aedRate: 160, contribTrust: 2, aiScale: 19000,
  };
  /* v1 = the 1 Nov first playable, kept so balance runs can compare old vs new. */
  const CFG_V1 = { machineBoost: 9000, machineBy: 6, leakRate: 0.08, leakFloor: 6000, startCash: 14000, maxBid: 15000, jarGoal: 20000, trustGoal: 70, contribTrust: 3, aiScale: 15000 };

  const MEMBERS = [
    { id: 'comfort', img: 'assets/p-comfort.jpg', style: 'fair' },
    { id: 'fru', img: 'assets/p-fru.jpg', style: 'patient' },
    { id: 'kingsley', img: 'assets/p-kingsley.jpg', style: 'impulsive' },
    { id: 'aicha', img: 'assets/p-aicha.jpg', style: 'nointerest' },
    { id: 'ndolo', img: 'assets/p-ndolo.jpg', style: 'aggressive' },
    { id: 'you', img: 'assets/p-you.jpg', style: 'player' },
  ];

  function rng(seed) { // mulberry32, seeded so runs are reproducible
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const round500 = (x) => Math.max(0, Math.round(x / 500) * 500);

  /** Need = how badly an AI member wants the pot this month (0..1). Shown to the player as 🔥/🙂/😌. */
  function aiNeed(member, month, r) {
    const base = { fair: 0.3, patient: 0.12, impulsive: 0.4, nointerest: 0, aggressive: 0.55 }[member.style] || 0.3;
    const spike = r() < (member.style === 'impulsive' ? 0.4 : 0.18) ? 0.4 : 0;
    return Math.max(0, Math.min(1, base + spike + (r() - 0.5) * 0.2));
  }
  const needLevel = (n, style) => (style === 'nointerest' ? 'zero' : n > 0.6 ? 'high' : n > 0.3 ? 'mid' : 'low');

  /** AI sealed bid. Early pots are worth more; needy members bid more. Small noise keeps it from being exact. */
  function aiBid(member, need, month, monthsLeft, r) {
    if (member.style === 'nointerest' || monthsLeft <= 1 || need < 0.2) return 0;
    const timeFactor = (monthsLeft - 1) / (CFG.months - 1);
    const noise = r ? 0.9 + r() * 0.2 : 1;
    return Math.min(CFG.maxBid - CFG.bidStep, round500(need * CFG.aiScale * (0.3 + 0.7 * timeFactor) * noise));
  }

  /** Resolve sealed bids: highest wins; tie means lots. All zero means lots among the eligible. */
  function resolveAuction(bids, r) {
    const max = Math.max(...bids.map((b) => b.amount));
    const top = bids.filter((b) => b.amount === max);
    const w = top[Math.floor(r() * top.length)];
    return { winner: w.id, bid: w.amount, lots: top.length > 1 };
  }

  /** Implicit monthly cost of taking the pot early: discount / money received / months early. */
  function impliedRate(bid, pot, monthsEarly) {
    if (bid <= 0 || monthsEarly <= 0) return 0;
    return bid / (pot - bid) / monthsEarly;
  }

  root.NjangiCore = { CFG, CFG_V1, MEMBERS, rng, aiNeed, needLevel, aiBid, resolveAuction, impliedRate, round500 };
})(typeof window !== 'undefined' ? window : globalThis);
