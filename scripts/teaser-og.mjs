// Maakt public/teaser/og.png (1200 x 630, het plaatje bij een gedeelde link) uit de teaser zelf.
// Alles in het beeld is met code getekend: de sprites uit assets/ en het diorama uit teaser/teaser.ts.
// Draaien na een wijziging aan de teaser: `npm run build && node scripts/teaser-og.mjs`.
import { preview } from 'vite';
import { chromium } from 'playwright';

const server = await preview({ preview: { port: 4318, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('http://localhost:4318/teaser/?og');
  await page.waitForFunction(() => document.body.dataset.klaar === '1', null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'public/teaser/og.png' });
  console.log('public/teaser/og.png gemaakt');
} finally {
  await browser.close();
  server.httpServer.close();
}
