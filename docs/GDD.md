# Njangi Night: Game Design Document
*Zoud GameLab entry by Mbanya Dev. Version 0.2 (balance, EN/FR/AR, polish pass), November 2026*

## 1. Pitch
**Save together. Bid smart. Sew your future.**
You're a young tailor in Bamenda, Cameroon. You join a **njangi**, a rotating savings circle of six neighbours. Every month everyone pays 10,000 FCFA into the pot. Then comes the twist: members **bid** for the pot. The highest bidder takes the pot early but gives up a discount, and that discount is shared among everyone who waits.

> **Bidding is borrowing. Waiting is earning.**

In six months you're trying to buy a sewing machine, build an emergency "Trouble Jar", stay out of predatory debt and keep your neighbours' trust.

## 2. Why a njangi?
Hundreds of millions of people use rotating savings and credit associations (ROSCAs): *njangi* (Cameroon), *tontine* (francophone Africa), *susu* (Ghana), *ajo/esusu* (Nigeria), *jam'iya* (Arab world, including the UAE), *chama* (Kenya), *tanda* (Latin America), *hui* (China). They're how many people actually save, borrow and invest. Most of them never see a bank-style lesson that tells them **a bidding njangi is a loan market with an interest rate**. The game makes that rate visible.

## 3. Target audience
- **Primary:** ages 15–30, first income earners, mobile-first, emerging markets, plus UAE youth and expats who know jam'iya.
- **Secondary:** teachers and NGOs running financial-literacy sessions (a session takes about 10–12 minutes).

## 4. Core loop (one month = one round, 6 rounds)
1. **Payday:** income 25,000 (+8,000 once you own the machine). Rent and food (13,000) leave automatically.
2. **Plan:** move money into the Trouble Jar and repay debt. Cash left in your pocket "leaks" (small spending).
3. **Life happens:** one event card with real trade-offs, drawn on a **difficulty curve**: gentle cards in month 1, medium in months 2–3, hard shocks in months 4–6 (13 events: malaria clinic bill, scam SMS, phone on instalments, funeral contribution, "money doubler" scheme, power cut, customer wants credit, rent rise, wedding order…). Pay from the Jar, cash, or **Quick Cash** (20% a month).
4. **Njangi night:** contribute 10,000. If you can't, cover it from the Jar or a loan, or default (fine plus trust loss). Neighbours voice their needs in speech bubbles. Then you place a **sealed bid** with a slider that shows, live, *what you receive*, *what each neighbour earns*, and **your price of money** as a monthly interest rate.
5. **Reveal:** bids flip, the winner takes pot − bid, and the bid is split among the others (including you).
6. **If you win:** buy the machine (productive), fill the Jar (resilience), or repay debt.
7. **Month end:** debt interest accrues and the pocket leaks.

**End screen:** 4 stars (Machine **by month 4** · Jar ≥ 25,000 · Debt-free · Trust ≥ 72), net worth, a **price-of-money chart** (every winning bid as a monthly rate next to Quick Cash's 20%), a month-by-month timeline of who took the pot at what bid, and personalised lessons generated from *your* choices (Aïcha's interest-free lesson always shows). Best score is saved on the device.

A live **goals strip** under the HUD shows the four stars filling in (or being lost) during play, so the target is never hidden until the end.

## 5. Characters (AI bidders with distinct money personalities)
| Member | Personality | Teaches |
|---|---|---|
| Mama Comfort (president, market queen) | Fair, bids only when her need is real | Group governance |
| Pa Fru (retired teacher) | Patient, almost never bids | Waiting = earning |
| Kingsley (bendskin driver) | Impulsive, bids when hit by an event | Emergencies → expensive money |
| Aïcha (hairdresser) | Won't pay or take interest, waits her turn | Interest-free finance, faith-aligned choices |
| Ndolo (Douala trader) | Aggressive early bidder | Business borrowing has a price |

## 6. Financial-literacy outcomes
1. **Time value of money:** money now costs more than money later.
2. **Implicit interest:** a bid of 9,000 on a 60,000 pot taken 4 months early ≈ 4.4%/month. Not "free".
3. **Productive vs consumptive use:** the machine raises income for every month after.
4. **Emergency fund vs predatory credit:** the Jar beats Quick Cash at 20%/month.
5. **Social collateral:** default costs trust, fines and future access.
6. **Scam red flags:** the "doubler" and fake-SMS events.
7. **Total cost of instalment credit:** the phone/BNPL event.

Each lesson is *felt* (cash, stars, neighbours' reactions) before it's *named* on the end screen.

## 7. Accessibility & inclusion
- Settings: **bigger text**, **reduce motion** (also follows the OS setting), **sound** and **music** on/off, **simple words** mode, and **language** (English, Français, العربية).
- Keyboard: Tab/Enter everywhere; number keys **1–4** pick choices (badges shown on each card).
- Status is never colour-only: icons + labels everywhere.
- Mouse, touch, and keyboard; works on low-end Android browsers (no build step, ~0.7 MB).
- Diverse, respectful African cast; an interest-free character presented positively.
- **Languages (v0.2):** full English, French and Arabic. Arabic uses a right-to-left layout, an Arabic display font (Baloo Bhaijaan 2), feminine second-person address for the player character, and shows the pot's approximate AED value. Aïcha's interest-free "way" is framed as the jam'iya tradition familiar in the Gulf.
- Planned: a full **Dubai jam'iya mode** (UAE setting and scenarios, AED economy, fixed-rotation interest-free variant, Zakat on savings).

## 8. Art, audio, tech
- Bright illustrated West African compound at dusk, bunting, plastic chairs, a golden pot. Rounded "Baloo 2" / "Nunito" type.
- WebAudio-synthesised SFX (coins, drum roll, gavel, card flips, star chimes) and a looping highlife/makossa-style music track, all generated in code: no audio files to load.
- Juice: month banners, a dusk-to-night lighting change for njangi night, coins that fly into a pot that "gulps", sealed bids flipping open lowest-to-highest, a SOLD! stamp, emoji reactions, screen shake on bad news, count-up numbers and confetti.
- Vanilla HTML/CSS/JS on a 1280×720 stage scaled to any screen. The rules engine (`core.js`) is DOM-free and seeded, so it's testable and reusable (e.g. a multiplayer version).

## 8b. Balance (v0.2)
Tuned with an automated bot that plays hundreds of fast games (`tools/sim.js`, 60 games per strategy):

| Strategy | v0.1 avg stars | v0.2 avg stars |
|---|---|---|
| Passive (never bids, sensible choices) | 3.7 | 2.4 |
| Smart (reads the room, bids in months 1–3) | 4.0 | 3.8 |
| Reckless (max bid, borrows for every bill) | 2.0 | 2.0 (machine + trust, but zero Jar and in debt) |
| Random | 3.2 | 2.4 |

v0.1 was too easy: just waiting earned almost every star. v0.2 changes: the machine star needs the machine **by month 4**, so waiting no longer gets it; neighbours bid harder when their need is 🔥; Jar goal 25,000; trust only +2 per on-time payment, so community choices matter; machine income +8,000.

## 9. Roadmap
| Phase | Scope |
|---|---|
| Jam (Nov 2026) | Single-player, 6 months, 13 events on a difficulty curve, **EN/FR/AR with RTL**, accessibility settings, music |
| Milestone 1 | Dubai jam'iya mode (UAE scenarios, AED economy, Zakat), 30+ events, tutorial pass, classroom mode with teacher summary |
| Milestone 2 | **Real multiplayer njangi** with friends (async, mobile), seasons, cosmetic tailoring shop |
| Milestone 3 | Partnerships with MFIs/fintechs for "real-world challenge" modules; analytics on learning outcomes |

## 10. Commercial model
Free to play with no pay-to-win. Revenue from (a) B2B/NGO licences for classroom and onboarding versions, (b) sponsored, clearly labelled financial-education modules from regulated partners, (c) optional cosmetics in the multiplayer version. See `BUDGET.md`.

## 11. AI-use disclosure
Background and character portraits were made with an AI image generator and then edited and resized. Code, design and writing were produced with AI-assisted tooling under the developer's direction. No third-party copyrighted assets are used. Fonts: Google Fonts (OFL).
