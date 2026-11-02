// Rooktest: Chromium start het gebouwde spel, laat 60 s spel versneld draaien,
// faalt bij JS-fouten of NaN. Draai eerst `npm run build` (npm test doet dat).
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
    for (let i = 0; i < 600; i++) window.SPEL.stap(0.1);
    return { ...window.SPEL.staat };
  });
  for (const [k, v] of Object.entries(staat)) {
    if (typeof v === 'number' && !Number.isFinite(v)) fouten.push(`staat.${k} = ${v}`);
  }
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
