// Prestatiecheck: start het gebouwde spel in Chromium voor een paar kaartmaten en meet laadtijd, wereld maken,
// beelden per seconde en geheugen. Draai `npm run build` eerst, dan `npm run prestatie` (of `-- --streng`).
// Zonder --streng falen alleen de laad- en maaktijden; de FPS in een headless browser zonder GPU zijn niet eerlijk,
// dus die worden alleen getoond. Met --streng telt alles (draai dan op je eigen laptop met `--kop`).
// Kaartmaten: `npm run prestatie -- 64x64 320x320 480x480`.
import { preview } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const streng = args.includes('--streng');
const kop = args.includes('--kop');
const maten = args.filter((a) => /^\d+x\d+$/.test(a));
if (!maten.length) maten.push('64x64', '160x160', '320x320');

const server = await preview({ preview: { port: 4318, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ headless: !kop });
let faalt = false;
const rijen = [];
try {
  for (const maat of maten) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const fouten = [];
    page.on('pageerror', (e) => fouten.push(String(e)));
    await page.goto(`http://localhost:4318/?seed=123&factie=muizen&kaart=${maat}`);
    await page.waitForFunction(() => window.SPEL && window.SPEL.staat.onderweg === 0, null, { timeout: 60000 });
    // Rustig kijken (de FPS- en logicacijfers komen van voor de stream), dan een stream: hoe lang duurt een nieuwe wereld.
    await page.waitForTimeout(3000);
    const voor = await page.evaluate(() => window.PERF.rapport());
    const sprong = await page.evaluate(() => {
      const t = performance.now();
      window.SPEL.stream();
      window.SPEL.stap(0.1);
      return performance.now() - t;
    });
    await page.waitForTimeout(4500);
    const na = await page.evaluate(() => window.PERF.rapport());
    await page.close();
    const r = { maat, laad: voor.laden['first frame'], kaartMs: voor.metingen['generate map']?.maxMs, grondMs: na.metingen['build ground']?.maxMs, sprongMs: Math.round(sprong),
      fps: voor.frames.fps, p95: voor.frames.p95Ms, logica: voor.logicaMs, logicaMax: voor.logicaMaxMs, heap: na.heapMB, over: na.overschrijdingen };
    rijen.push(r);
    const eigen = [...voor.overschrijdingen, ...na.overschrijdingen.filter((o) => /generate map|build ground/.test(o))];
    r.over = [...new Set(eigen)];
    const tel = streng ? r.over : r.over.filter((o) => !/frame p95|logic/.test(o));
    if (tel.length || fouten.length) faalt = true;
    if (fouten.length) r.over.push(...fouten);
  }
} finally {
  await browser.close();
  server.httpServer.close();
}
console.log('size       first-frame  gen-map  ground  jump  fps   p95   logic  max   heap');
for (const r of rijen)
  console.log(`${r.maat.padEnd(10)} ${String(r.laad).padStart(8)} ms ${String(Math.round(r.kaartMs)).padStart(6)}  ${String(Math.round(r.grondMs)).padStart(6)}  ${String(r.sprongMs).padStart(4)}  ${String(r.fps).padStart(4)}  ${String(r.p95).padStart(5)}  ${String(r.logica).padStart(5)}  ${String(r.logicaMax).padStart(5)}  ${r.heap} MB`);
for (const r of rijen) if (r.over.length) console.log(`${r.maat}: ${r.over.join('; ')}`);
if (!streng) console.log('(FPS and logic are informational here; use --streng --kop on a real GPU to enforce them)');
if (faalt) {
  console.error('PRESTATIE: over budget');
  process.exit(1);
}
console.log('prestatie ok');
