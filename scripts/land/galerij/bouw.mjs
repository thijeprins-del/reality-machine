// Bouwt de wereldgalerij tot één HTML-bestand (generator + sprites als data-URL ingebakken).
// Gebruik: node scripts/land/galerij/bouw.mjs <uit.html>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const hier = dirname(fileURLToPath(import.meta.url));
const wortel = join(hier, '../../..');
const uit = process.argv[2] ?? join(wortel, 'dist-galerij.html');
const bundel = join(hier, '.bundel.js');
execFileSync('npx', ['--yes', 'esbuild', join(hier, 'ingang.ts'), '--bundle', '--format=iife', '--minify', `--outfile=${bundel}`], { cwd: wortel, stdio: 'inherit' });
const TYPES = ['steentijd', 'oudheid', 'middeleeuwen', 'industrieel', 'modern', 'scifi', 'insecten', 'monsters', 'kuddes', 'reuzen', 'aliens', 'tentakelbeest'];
const urls = {};
for (const k of TYPES) {
  const pad = join(wortel, 'assets/land', k, 'otter.png');
  if (existsSync(pad)) urls[k] = 'data:image/png;base64,' + readFileSync(pad).toString('base64');
}
const html = readFileSync(join(hier, 'sjabloon.html'), 'utf8')
  .replace('/*SPRITES*/', `const SPRITES=${JSON.stringify(urls)};`)
  .replace('/*GEN*/', readFileSync(bundel, 'utf8'));
writeFileSync(uit, html);
console.log('geschreven:', uit, Math.round(html.length / 1024), 'KB');
