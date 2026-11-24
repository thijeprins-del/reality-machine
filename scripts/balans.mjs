// Balance runner: plays every world type on a fixed seed set with simple scripted players and prints a table.
// Usage: npm run build && node scripts/balans.mjs [--seeds=1,2,3] [--shifts=1,5,8] [--types=stone,bugs] [--policies=greedy,guard]
// Policies: guard = rats stay home and defend, greedy = all rats mine the nearest deposit (maximum Wrath),
//           split = half mine, half guard, active = half mine, the other half runs to the nearest raider (a competent player). Power is free (we test raids, not the economy). Output is the same on every run.
import { preview } from 'vite';
import { chromium } from 'playwright';

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split('=')[1].split(',');
export const SEEDS = arg('seeds', '1,2,3').map(Number);
const SHIFTS = arg('shifts', '1,5,8').map(Number);
const POLICIES = arg('policies', 'guard,greedy,split,active');
const HELE_RUN = process.argv.includes('--run'); // play whole runs (8 shifts + finale) instead of single worlds
const TYPES = arg('types', 'stone,antiquity,medieval,industrial,modern,scifi,bugs,monsters,hordes,giants,aliens,tentacle');

const server = await preview({ preview: { port: 4318, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch();
const rijen = [];
async function heleRun(page) {
  console.log('whole runs with the active player (half mine, half chase raiders), power free:');
  for (const seed of SEEDS) {
    await page.goto(`http://localhost:4318/?seed=${seed}&power=free&fog=0`);
    await page.waitForFunction(() => window.SPEL !== undefined, null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const s = window.SPEL.staat, log = [];
      for (let i = 0; i < 40; i++) window.SPEL.stap(0.1);
      let dim = 0, min = 100, t = 0;
      for (; t < 30000 && !s.uitkomst; t++) {
        if (s.dimensie !== dim) {
          if (dim) log.push(`${dim}:${s.land.dim.archetype === 'tentakelbeest' && s.dimensie === 9 ? 'FIN' : ''}min${min.toFixed(0)}`);
          dim = s.dimensie; min = 100;
          const k = s.kaart, m = k.machine, mx = m.x + m.breed / 2, my = m.y + m.diep / 2;
          const bron = [...k.afzettingen].sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
          if (bron) window.SPEL.stuur(s.werkers.filter((_, i) => i % 2).map((w) => w.id), bron.x, bron.y);
        }
        if (t % 20 === 0) {
          const k = s.kaart, m = k.machine, mx = m.x + m.breed / 2, my = m.y + m.diep / 2;
          const o = [...s.land.raiders].sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
          const wacht = s.werkers.filter((_, i) => !(i % 2)).map((w) => w.id);
          window.SPEL.stuur(wacht, Math.round(o ? o.x : mx), Math.round(o ? o.y : my));
        }
        window.SPEL.stap(0.1);
        if (s.machine.heelheid < min) min = s.machine.heelheid;
      }
      return `${s.uitkomst?.gewonnen ? 'WON' : 'LOST'} at dimension ${s.dimensie} after ${(t / 600).toFixed(1)} min  [${log.join(' ')}]${s.uitkomst?.gewonnen ? '' : ' ' + s.uitkomst?.reden}`;
    });
    console.log(`seed ${seed}: ${r}`);
  }
}
try {
  const page = await browser.newPage();
  const fouten = [];
  page.on('pageerror', (e) => fouten.push(String(e)));
  if (HELE_RUN) { await heleRun(page); throw 'klaar'; }
  for (const type of TYPES) for (const shift of SHIFTS) {
    await page.goto(`http://localhost:4318/?seed=1&type=${type}&shift=${shift}&power=free&fog=0`);
    await page.waitForFunction(() => window.SPEL !== undefined, null, { timeout: 15000 });
    for (const beleid of POLICIES) {
      const res = [];
      for (const seed of SEEDS) {
        res.push(await page.evaluate(([seed, beleid]) => {
          window.SPEL.zaai(seed);
          const s = window.SPEL.staat;
          for (let i = 0; i < 40 && s.onderweg > 0; i++) window.SPEL.stap(0.1);
          const k = s.kaart, m = k.machine;
          const mx = m.x + m.breed / 2, my = m.y + m.diep / 2;
          const bron = [...k.afzettingen].filter((a) => a.rest > 0).sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
          const mijners = beleid === 'greedy' ? s.werkers : beleid === 'split' || beleid === 'active' ? s.werkers.filter((_, i) => i % 2) : [];
          if (bron && mijners.length) window.SPEL.stuur(mijners.map((w) => w.id), bron.x, bron.y);
          let min = 100, eersteOverval = -1, t = 0;
          const dim0 = s.dimensie, land0 = s.land;
          for (; t < 4000 && !s.uitkomst && s.dimensie === dim0; t++) { // until the stream comes (or the run is lost)
            if (beleid === 'active' && t % 20 === 0) {
              const o = [...s.land.raiders].sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
              const wacht = s.werkers.filter((_, i) => !(i % 2)).map((w) => w.id);
              if (o) window.SPEL.stuur(wacht, Math.round(o.x), Math.round(o.y)); else window.SPEL.stuur(wacht, Math.round(mx), Math.round(my));
            }
            window.SPEL.stap(0.1);
            if (s.machine.heelheid < min) min = s.machine.heelheid;
            if (eersteOverval < 0 && s.land.volgendId > 1) eersteOverval = t / 10;
          }
          return { min, einde: s.machine.heelheid, dood: !!s.uitkomst && !s.uitkomst.gewonnen, overvallers: land0.volgendId - 1, wrath: land0.wrath, eerste: eersteOverval, tijd: t / 10 };
        }, [seed, beleid]));
      }
      const gem = (f) => res.reduce((a, r) => a + f(r), 0) / res.length;
      rijen.push({ type, shift, beleid, dood: res.filter((r) => r.dood).length, min: gem((r) => r.min), einde: gem((r) => r.einde), overvallers: gem((r) => r.overvallers), wrath: gem((r) => r.wrath), eerste: gem((r) => r.eerste) });
    }
  }
  if (fouten.length) console.error('page errors:\n' + fouten.join('\n'));
} catch (e) {
  if (e !== 'klaar') throw e;
} finally {
  await browser.close();
  server.httpServer.close();
}
if (!HELE_RUN) console.log(`seeds ${SEEDS.join(',')} | machine integrity until the stream, power free`);
if (!HELE_RUN) console.log('type'.padEnd(11) + 'shift policy dead  minInt endInt raiders wrath firstRaid');
if (!HELE_RUN) for (const r of rijen) {
  console.log(`${r.type.padEnd(11)}${String(r.shift).padEnd(6)}${r.beleid.padEnd(7)}${`${r.dood}/${SEEDS.length}`.padEnd(6)}${r.min.toFixed(0).padStart(6)}${r.einde.toFixed(0).padStart(7)}${r.overvallers.toFixed(1).padStart(8)}${r.wrath.toFixed(0).padStart(6)}${r.eerste.toFixed(0).padStart(9)}`);
}
