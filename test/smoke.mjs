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
  await page.goto('http://localhost:4317/?seed=123&factie=muizen');
  await page.waitForFunction(() => window.SPEL !== undefined, null, { timeout: 15000 });
  const staat = await page.evaluate(() => {
    const s = window.SPEL.staat;
    const voor = s.voorraad.schroot ?? 0;
    const a = s.kaart.afzettingen.find((a) => a.goed === 'schroot');
    window.SPEL.stuur('alle', a.x, a.y);
    for (let i = 0; i < 600; i++) window.SPEL.stap(0.1);
    const posities = s.werkers.flatMap((w) => [w.x, w.y]);
    return { tijd: s.tijd, dimensie: s.dimensie, voor, schroot: s.voorraad.schroot, werkers: s.werkers.length,
      posities_ok: posities.every(Number.isFinite) ? 1 : NaN };
  });
  for (const [k, v] of Object.entries(staat)) {
    if (typeof v === 'number' && !Number.isFinite(v)) fouten.push(`staat.${k} = ${v}`);
  }
  if (!(staat.schroot > staat.voor)) fouten.push('muizen hebben geen schroot naar de opslag gebracht');
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
