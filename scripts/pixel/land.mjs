// Sprite-generator voor het land: eigen sprites per familie en archetype, met een seed per dimensie.
// Alles is met de hand in code getekend (geen AI-beeld). Gebruik: node scripts/pixel/land.mjs [seed]
// Uitvoer: assets/land/<archetype>/<sprite>.png en assets/land/voorbeeld.png (contactblad).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Doek, hex, ruis } from './pixel.mjs';

const uit = new URL('../../assets/land/', import.meta.url).pathname;
const mix = (a, b, f) => { const x = hex(a), y = hex(b); return [...[0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * f)), 255]; };
const licht = (c, f) => mix(typeof c === 'string' ? c : '#' + c.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join(''), '#ffffff', f);
const donker = (c, f) => mix(typeof c === 'string' ? c : '#' + c.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join(''), '#000000', f);

// Gevulde ellips met licht van linksboven: kleur(x,y) -> schaduw per pixel.
function ell(d, cx, cy, rx, ry, basis) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const l = -0.5 * nx - 0.7 * ny; // -1..1, positief = naar het licht
      d.zet(x, y, l > 0.45 ? licht(basis, 0.22) : l < -0.25 ? donker(basis, 0.35) : basis);
    }
}
// Zwarte rand rond alles wat al getekend is (zelfde look als de rest van het spel).
const rand = (d) => d.omlijn('#0d0b0a');

const kies = (r, l) => l[Math.floor(r() * l.length)];

// ---- Steentijd -----------------------------------------------------------------------------------------------
const HUID = ['#8a5a36', '#9a6b42', '#7a4d2e', '#a57a52'];
function stamlid(r, soort) {
  const d = new Doek(16, 24);
  const huid = kies(r, ['#c98f66', '#b8825a', '#d4a077']), kleed = kies(r, HUID), haar = kies(r, ['#2a1c12', '#4a2e1a', '#1a1410']);
  d.rect(5, 20, 2, 3, huid); d.rect(9, 20, 2, 3, huid); // benen
  ell(d, 8, 15, 4.5, 5, kleed); // romp met vel
  d.rect(4, 12, 1, 5, huid); d.rect(12, 12, 1, 5, huid); // armen
  ell(d, 8, 8, 3.2, 3.4, huid); d.rect(5, 5, 7, 2, haar); // hoofd en haar
  d.zet(7, 8, '#1a1410'); d.zet(10, 8, '#1a1410');
  if (soort === 'speer') { d.lijn(13, 3, 13, 22, '#6b4a2a'); d.veelhoek([[12, 4], [14, 4], [13, 0]], '#9aa0a0'); }
  if (soort === 'knots') { d.lijn(13, 14, 13, 6, '#6b4a2a'); ell(d, 13, 5, 2, 2.5, '#7a7066'); }
  if (soort === 'sjamaan') { d.rect(5, 2, 7, 3, '#e8e0cc'); d.zet(6, 1, '#e8e0cc'); d.zet(10, 1, '#e8e0cc'); d.neon(8, 13, '#ff8a2a', 1); }
  rand(d); return d;
}
function hut(r) {
  const d = new Doek(36, 30);
  const vel = kies(r, HUID);
  d.veelhoek([[3, 28], [18, 4], [33, 28]], (x, y) => ((x + y) % 7 === 0 ? donker(vel, 0.3) : x < 17 ? vel : donker(vel, 0.2)));
  for (let i = 0; i < 4; i++) d.lijn(18, 4, 18 + (i - 1.5) * 3, 0, '#5c3e22'); // stokken boven
  d.veelhoek([[14, 28], [18, 16], [22, 28]], '#14100c'); // deur
  rand(d); return d;
}
function totem(r) {
  const d = new Doek(12, 40);
  const hout = kies(r, ['#6b4a2a', '#5c4028', '#7a5a38']);
  d.rect(2, 2, 8, 37, hout);
  for (let k = 0; k < 4; k++) { // vier gezichten boven elkaar
    const y = 4 + k * 9, kl = kies(r, ['#b03a2a', '#e8d49a', '#2a6a4a', '#d0902a']);
    d.rect(3, y, 6, 6, kl); d.zet(4, y + 2, '#14100c'); d.zet(7, y + 2, '#14100c'); d.rect(4, y + 4, 4, 1, '#14100c');
  }
  d.zet(5, 1, '#e8e0cc'); d.zet(6, 0, '#e8e0cc'); d.zet(7, 1, '#e8e0cc');
  rand(d); return d;
}
function kampvuur(r) {
  const d = new Doek(20, 18);
  d.lijn(3, 15, 16, 12, '#4a3220'); d.lijn(4, 12, 17, 15, '#5c4028'); d.lijn(3, 15, 17, 15, '#3a2818');
  for (let k = 0; k < 6; k++) d.zet(2 + Math.floor(r() * 16), 16, '#5a5650');
  d.veelhoek([[6, 12], [10, 1], [14, 12]], '#ff8a2a'); d.veelhoek([[8, 12], [10, 5], [12, 12]], '#ffd040');
  for (const [x, y] of [[9, 6], [10, 6], [10, 8], [9, 9]]) d.licht(x, y, '#ffd040');
  rand(d); return d;
}

// ---- Insecten ------------------------------------------------------------------------------------------------
const SCHILD = [['#2a3a22', '#4a6a3a'], ['#4a2a1a', '#8a5a2a'], ['#1a2a3a', '#3a5a8a'], ['#3a1a3a', '#7a3a7a']];
function kever(r, soort) {
  const [dk, lk] = kies(r, SCHILD);
  const d = new Doek(30, 20);
  const pootje = (x, y, dx) => { d.lijn(x, y, x + dx, y + 3, '#14100c'); d.lijn(x + dx, y + 3, x + dx * 1.5, y + 7, '#14100c'); };
  for (const x of [10, 14, 18]) { pootje(x, 12, -3); pootje(x + 2, 12, 3); }
  ell(d, 16, 10, soort === 'mijter' ? 10 : 9, 6.5, lk);
  d.lijn(16, 4, 16, 16, dk); // dekschildnaad
  ell(d, 6, 11, 3.5, 3, dk); // kop
  d.zet(5, 10, '#ffd040'); d.licht(5, 10, '#ffd040');
  d.lijn(3, 13, 1, 15, '#14100c'); d.lijn(4, 14, 2, 17, '#14100c'); // kaken
  d.lijn(5, 8, 2, 3, '#14100c'); d.lijn(7, 8, 6, 2, '#14100c'); // sprieten
  if (soort === 'hoorn') { d.lijn(5, 8, 3, 4, dk); d.lijn(4, 8, 2, 5, dk); }
  rand(d); return d;
}
function mier(r) {
  const [dk, lk] = kies(r, SCHILD);
  const d = new Doek(26, 16);
  for (const x of [9, 12, 15]) { d.lijn(x, 8, x - 3, 14, '#14100c'); d.lijn(x, 8, x + 3, 14, '#14100c'); }
  ell(d, 20, 8, 4.5, 3.5, lk); ell(d, 13, 8, 3, 2.5, dk); ell(d, 6, 8, 3, 2.5, lk);
  d.licht(4, 7, '#ffd040'); d.lijn(3, 6, 0, 2, '#14100c'); d.lijn(4, 6, 3, 1, '#14100c');
  rand(d); return d;
}
function korf(r) {
  const [dk, lk] = kies(r, [['#6a4a1a', '#c8902a'], ['#4a3a2a', '#8a7050'], ['#3a4a2a', '#6a8a3a']]);
  const d = new Doek(40, 34);
  ell(d, 20, 24, 18, 11, lk);
  d.veelhoek([[2, 24], [6, 10], [20, 1], [34, 10], [38, 24]], (x, y) => (Math.floor((x + y) / 4) % 2 ? lk : dk));
  for (const [x, y] of [[14, 26], [22, 20], [27, 27], [10, 18], [31, 17]]) ell(d, x, y, 2.5, 3, '#0d0b0a');
  d.licht(22, 20, '#ffb030');
  rand(d); return d;
}
function eieren(r) {
  const d = new Doek(26, 16);
  const kl = kies(r, ['#e8e0b0', '#c8d8a0', '#e0c8d0']);
  for (const [x, y, rx] of [[7, 10, 4], [14, 8, 4.5], [20, 11, 3.5], [11, 13, 3.5]]) { ell(d, x, y, rx, rx + 1, kl); d.zet(x - 1, y - 2, '#ffffff'); }
  rand(d); return d;
}

const SPRITES = {
  steentijd: { 'speerwerper': (r) => stamlid(r, 'speer'), 'knotsdrager': (r) => stamlid(r, 'knots'), 'sjamaan': (r) => stamlid(r, 'sjamaan'), hut, totem, kampvuur },
  insecten: { 'kever': (r) => kever(r, 'kever'), 'hoornkever': (r) => kever(r, 'hoorn'), 'mier': mier, korf, eieren },
};

export function maakContactblad(seed) {
  const rijen = Object.entries(SPRITES);
  const blad = new Doek(300, rijen.length * 50 + 10);
  blad.rect(0, 0, blad.w, blad.h, '#232620');
  rijen.forEach(([arch, lijst], i) => {
    mkdirSync(join(uit, arch), { recursive: true });
    let x = 8;
    for (const [naam, f] of Object.entries(lijst)) {
      const d = f(ruis(seed * 131 + naam.length * 7 + i));
      d.png(join(uit, arch, `${naam}.png`));
      d.gloedPng(join(uit, arch, `${naam}-gloed.png`));
      blad.plak(d, x, 8 + i * 50 + (44 - d.h));
      x += d.w + 6;
    }
  });
  blad.schaal(3).png(join(uit, 'voorbeeld.png'));
}

if (process.argv[1] && process.argv[1].endsWith('land.mjs')) maakContactblad(Number(process.argv[2] ?? 1));
