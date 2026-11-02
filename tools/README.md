# Test tools
Headless-browser tools used to balance and QA the game (Node + `puppeteer-core` + Chrome).

```
python3 -m http.server 8000          # from the repo root
npm i puppeteer-core
node tools/sim.js 60                 # balance bot: 60 games per strategy (passive/smart/reckless/random)
node tools/shots.js ar /tmp/shots 7  # full game with animations, a screenshot per phase, overflow warnings
node tools/smoke.js "?lang=fr"       # load check: console errors, failed requests
```
Set `NJ_URL` to test another host, e.g. the live GitHub Pages site.
