// Rooktest: Chromium start het gebouwde spel (muizen), stuurt alle muizen naar schroot, laat 60 s spel versneld
// draaien, faalt bij JS-fouten, NaN, of als er geen schroot in de opslag bij komt. Draai eerst `npm run build` (npm test doet dat).
import { preview } from 'vite';
import { chromium } from 'playwright';

const server = await preview({ preview: { port: 4317, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch();
const fouten = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => fouten.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && fouten.push(m.text()));
  await page.goto('http://localhost:4317/?seed=123');
  await page.waitForFunction(() => window.SPEL !== undefined, null, { timeout: 15000 });
  const staat = await page.evaluate(() => {
    const s = window.SPEL.staat;
    const a = s.kaart.afzettingen[0]; // de eerste grondstof van de economie van deze wereld
    const voor = s.voorraad[a.goed] ?? 0;
    window.SPEL.stuur('alle', a.x, a.y);
    for (let i = 0; i < 600; i++) window.SPEL.stap(0.1);
    const posities = s.werkers.flatMap((w) => [w.x, w.y]);
    const k = s.kaart, schijfHoogte = k.hoogte[((k.machine.y - 2) * k.breed + k.machine.x) * 4];
    return { tijd: s.tijd, dimensie: s.dimensie, voor, gedolven: s.voorraad[a.goed], werkers: s.werkers.length, schijfHoogte,
      posities_ok: posities.every(Number.isFinite) ? 1 : NaN };
  });
  for (const [k, v] of Object.entries(staat)) {
    if (typeof v === 'number' && !Number.isFinite(v)) fouten.push(`staat.${k} = ${v}`);
  }
  if (!(staat.gedolven > staat.voor)) fouten.push('de ratten hebben geen grondstof naar de opslag gebracht');
  if (staat.schijfHoogte !== 1) fouten.push(`schijf ligt op hoogte ${staat.schijfHoogte}, niet 1`);
  // Een hele run met gratis stroom: 8 shiften plus finale moeten uitkomen op een gewonnen run (de machine blijft heel).
  const run = await browser.newPage();
  run.on('pageerror', (e) => fouten.push(String(e)));
  await run.goto('http://localhost:4317/?seed=7&power=free');
  await run.waitForFunction(() => window.SPEL !== undefined, null, { timeout: 15000 });
  const eind = await run.evaluate(() => {
    const s = window.SPEL.staat, types = [], forks = [];
    for (let i = 0; i < 9 * 3200 && !s.uitkomst; i++) { s.machine.heelheid = 100; if (s.keuze) { forks.push(s.keuze.opties.map((o) => o.profiel + ':' + o.archetype).join(' ')); window.SPEL.kies(i % 3); } if (!types.length || types.at(-1) !== s.land.dim.archetype + s.dimensie) types.push(s.land.dim.archetype + s.dimensie); window.SPEL.stap(0.1); }
    return { uitkomst: s.uitkomst, dimensie: s.dimensie, types, forks };
  });
  console.log('run:', JSON.stringify(eind));
  if (!eind.uitkomst?.gewonnen || eind.dimensie !== 9) fouten.push('een hele run (8 shiften + finale) werd niet gewonnen');
  // De splitsing in het niets: vijf keer, en de drie werelden zijn telkens van drie verschillende archetypes.
  if (eind.forks.length !== 5 || eind.forks.some((f) => f.includes('tentakelbeest') || new Set(f.split(' ').map((x) => x.split(':')[1])).size !== 3)) fouten.push('splitsing: ' + JSON.stringify(eind.forks));
  if (!(await page.$('canvas'))) fouten.push('geen canvas');
  console.log('staat na 60 s:', JSON.stringify(staat));
} finally {
  await browser.close();
  server.httpServer.close();
}
if (fouten.length) {
  console.error('ROOKTEST FAALT:\n' + fouten.join('\n'));
  process.exit(1);
}
console.log('rooktest ok');
