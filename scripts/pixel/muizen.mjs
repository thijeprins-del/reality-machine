// Tekenscript voor de muizen-sprites. Draai: node scripts/pixel/muizen.mjs
// Schrijft PNG's naar assets/muizen/ en de ankerpunten naar src/muizen/sprites.ts.
// Stijl: muizen klein en pluizig; hun machines gigantisch, hoekig, bruin + metaal, veel te veel kabels en neon.
import { Doek, ruis } from './pixel.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const uit = join(wortel, 'assets', 'muizen');
mkdirSync(uit, { recursive: true });

// ---- Palet ----
const P = {
  lijn: '#140f0c',
  // bruin (hout, leer, baksteen)
  b0: '#2a1c14', b1: '#3e2a1c', b2: '#5a3d27', b3: '#7a5434', b4: '#9c6e44', b5: '#bf8e5c',
  // metaal
  m0: '#1e2126', m1: '#2f343b', m2: '#474e57', m3: '#666f7a', m4: '#8e98a3', m5: '#c0c8d0',
  roest: '#8a4a22', koper: '#b8693a', koperL: '#e0915a',
  // kabels
  k0: '#121317', k1: '#2a2e35', kRood: '#7a2222', kRoodL: '#a43a32', kGeel: '#8c7420', kGeelL: '#b89a32',
  kBlauw: '#22406a', kBlauwL: '#33608f',
  // neon
  roze: '#ff3df2', cyaan: '#3df8ff', groen: '#8cff3d', oranje: '#ffae2a', geel: '#fff03d',
  glas: '#0e1c26',
  // vacht
  v0: '#7e6e60', v1: '#a8978a', v2: '#cbbcae', v3: '#e9dfd2', v4: '#fbf6ee', neus: '#e89aa6', oor: '#d8848f',
};

const metaal = { boven: P.m4, links: P.m2, rechts: P.m3, rand: P.m5 };
const donkerMetaal = { boven: P.m3, links: P.m1, rechts: P.m2, rand: P.m4 };
const bruin = { boven: P.b4, links: P.b2, rechts: P.b3, rand: P.b5 };
const roest = { boven: P.koper, links: P.b2, rechts: P.roest, rand: P.koperL };

const ankers = {};
function bewaar(naam, d, ankerX, ankerY, tegels) {
  d.png(join(uit, `${naam}.png`));
  ankers[naam] = { w: d.w, h: d.h, ankerX, ankerY, tegels };
}

// Punt op een blokvlak: start + a stappen langs kol/rij + omhoog.
const kol = (p, n) => [p[0] + 2 * n, p[1] + n];
const rij = (p, n) => [p[0] - 2 * n, p[1] + n];
const op = (p, n) => [p[0], p[1] - n];

// Waarschuwingsstrepen langs een kol-rand (geel/zwart).
function strepen(d, x, y, stappen, hoog) {
  for (let s = 0; s < stappen; s++)
    for (let j = 0; j < hoog; j++) {
      const kleur = Math.floor((s + j) / 2) % 2 ? P.k0 : P.oranje;
      d.zet(x + 2 * s, y + s - j, kleur);
      d.zet(x + 2 * s + 1, y + s - j, kleur);
    }
}
function strepenRij(d, x, y, stappen, hoog) {
  for (let s = 0; s < stappen; s++)
    for (let j = 0; j < hoog; j++) {
      const kleur = Math.floor((s + j) / 2) % 2 ? P.k0 : P.oranje;
      d.zet(x - 2 * s, y + s - j, kleur);
      d.zet(x - 2 * s - 1, y + s - j, kleur);
    }
}

// Klinknagels langs een kol-rand.
function nagels(d, x, y, stappen, elke, kleur = P.m5) {
  for (let s = 0; s < stappen; s += elke) d.zet(x + 2 * s, y + s, kleur);
}

// ---------------------------------------------------------------------------
// MUIS: klein en heel pluizig. Kijkt naar rechts. Neonbril op het voorhoofd, kabeltje uit het rugzakje.
function tekenMuis(naam, variant) {
  const d = new Doek(18, 16);
  const r = ruis(variant === 'monteur' ? 7 : 3);
  const blob = (cx, cy, rx, ry, pluis) => {
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const dd = dx * dx + dy * dy;
        if (dd <= 1 || (dd <= 1 + pluis && r() < 0.45)) {
          const licht = -dx * 0.6 - dy * 0.9 + (r() - 0.5) * 0.5;
          const kleur = licht > 0.7 ? P.v4 : licht > 0.15 ? P.v3 : licht > -0.4 ? P.v2 : licht > -0.9 ? P.v1 : P.v0;
          d.zet(x, y, kleur);
        }
      }
  };
  // staart: kronkel achter het lijf
  d.zet(3, 12, P.oor); d.zet(2, 11, P.oor); d.zet(1, 10, P.oor); d.zet(1, 9, P.oor); d.zet(2, 8, P.oor);
  // rugzakje met kabel naar de grond
  d.rect(3, 7, 3, 4, P.b2); d.rect(3, 7, 3, 1, P.b4); d.zet(4, 9, P.groen);
  blob(8.5, 10, 5, 4.2, 0.55); // lijf
  blob(10.5, 6.5, 3.6, 3.2, 0.5); // kop
  // oren: groot en rond
  const oor = (cx, cy) => {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4.5) d.zet(cx + x, cy + y, P.v2);
    d.zet(cx, cy, P.oor); d.zet(cx, cy + 1, P.oor); d.zet(cx - 1, cy, P.oor); d.zet(cx - 1, cy - 1, P.v3);
  };
  oor(8, 2);
  oor(13, 3);
  // neonbril op het voorhoofd
  d.zet(9, 4, P.k0); d.zet(10, 4, P.cyaan); d.zet(11, 4, P.k0); d.zet(12, 4, P.cyaan); d.zet(13, 5, P.k0);
  // oog, neus, snorharen
  d.zet(12, 6, P.lijn); d.zet(12, 5, P.v4);
  d.zet(14, 7, P.neus);
  d.zet(15, 6, P.v1); d.zet(15, 8, P.v1);
  // pootjes
  d.zet(7, 14, P.neus); d.zet(10, 14, P.neus);
  if (variant === 'monteur') {
    // draagt een te grote moersleutel
    d.lijn(11, 12, 16, 7, P.m4);
    d.zet(16, 6, P.m3); d.zet(17, 7, P.m3); d.zet(17, 6, P.m5);
    d.zet(11, 11, P.v3);
  }
  d.omlijn(P.lijn);
  // kabel uit het rugzakje (na de omlijning: dun en zwart)
  d.kabel(3, 10, 0, 15, 1, P.k0);
  d.neon(10, 4, P.cyaan, 1);
  d.neon(12, 4, P.cyaan, 1);
  d.zet(4, 9, P.groen);
  bewaar(naam, d, 9, 15, 0);
}

// ---------------------------------------------------------------------------
// MECH "Grootbek": een muis in een veel te grote, hoekige loopmachine met een kanon zo lang als een huis.
function tekenMech() {
  const d = new Doek(96, 100);
  const r = ruis(11);
  const ax = 40, ay = 83; // achterhoek van de tegel op de grond
  // kabelbundel die achter de mech over de grond sleept
  d.kabel(ax - 4, ay - 30, ax - 34, ay + 6, 10, P.k0, P.k1);
  d.kabel(ax, ay - 32, ax - 28, ay + 10, 12, P.kRood, P.kRoodL);
  // uitlaatpijpen achterop (eerst: ze staan achter de romp)
  const z = 24, rh = 22;
  const dakY = ay - z - rh;
  for (const [ox, oy, h] of [[-5, 2, 22], [3, 2, 16]]) {
    const u = d.blok(ax + ox, dakY + oy, 1, 1, h, roest);
    d.isoLijn(op(u.P3, h - 3)[0], op(u.P3, h - 3)[1], 1, 'kol', P.m2);
  }
  // antenne
  d.lijn(ax + 6, dakY + 2, ax + 10, dakY - 22, P.m4);
  d.lijn(ax + 7, dakY + 2, ax + 11, dakY - 22, P.m2);
  // benen: hoge hoekige poten met zuigers en grote voeten
  const been = (bx, by) => {
    d.blok(bx, by + 2, 4, 4, 3, donkerMetaal); // voet
    const b = d.blok(bx, by - 1, 2, 2, z, metaal);
    strepen(d, b.P3[0], b.P3[1] - 9, 2, 2);
    d.lijn(b.P2[0] + 2, b.P2[1] - 5, b.P2[0] + 2, b.P2[1] - z + 2, P.m5); // zuigerstang
    d.lijn(b.P2[0] + 3, b.P2[1] - 6, b.P2[0] + 3, b.P2[1] - z + 1, P.m3);
  };
  been(ax - 6, ay + 5);
  been(ax + 10, ay + 5);
  // romp: groot hoekig blok hoog op de poten. Linkervlak metaal (pantser), rechts bruin.
  const romp = d.blok(ax, ay - z, 10, 10, rh, { boven: P.b4, links: P.m2, rechts: P.b3, rand: P.b5 });
  for (let i = 0; i < 2; i++) {
    nagels(d, romp.P3[0] + 1, romp.P3[1] - 2 - i * 17, 10, 2, P.m4);
    d.isoLijn(romp.P2[0] - 1, romp.P2[1] - 7 - i * 8, 10, 'rij', P.b2);
  }
  nagels(d, op(romp.P2, 2)[0] + 1, op(romp.P2, 2)[1], 1, 1, P.b5);
  // cockpitraam op het linkervlak, met de piepkleine piloot
  const raam = op(kol(romp.P3, 2), 8);
  for (let s = 0; s < 6; s++) for (let j = 0; j < 8; j++) {
    d.zet(raam[0] + 2 * s, raam[1] + s - j, P.glas);
    d.zet(raam[0] + 2 * s + 1, raam[1] + s - j, P.glas);
  }
  // piloot: pluizig kopje met grote oren en neonbril
  const px = raam[0] + 4, py = raam[1] - 1;
  d.rect(px, py - 2, 4, 3, P.v3); d.rect(px + 1, py - 2, 2, 1, P.v4);
  d.zet(px, py - 4, P.v2); d.zet(px, py - 3, P.v2); d.zet(px + 3, py - 3, P.v2); d.zet(px + 4, py - 4, P.v2);
  d.zet(px + 1, py - 2, P.cyaan); d.zet(px + 3, py - 2, P.cyaan);
  d.zet(px + 4, py - 1, P.neus);
  d.isoLijn(raam[0], raam[1] - 8, 6, 'kol', P.cyaan);
  d.isoLijn(raam[0], raam[1] + 1, 6, 'kol', P.m4);
  // dakluik
  d.blok(op(romp.P0, rh)[0], op(romp.P0, rh)[1] + 5, 3, 3, 2, metaal);
  // klauwarm links
  const arm = d.blok(romp.P3[0] + 5, romp.P3[1] - 12, 2, 5, 5, metaal);
  d.blok(arm.P3[0] + 1, arm.P3[1] + 4, 1, 1, 7, donkerMetaal);
  d.blok(arm.P3[0] + 5, arm.P3[1] + 6, 1, 1, 6, donkerMetaal);
  // het kanon: gigantisch, langs kol naar voren-rechts, op een schouderblok
  d.blok(op(rij(romp.P1, 3), 14)[0] - 2, op(rij(romp.P1, 3), 14)[1] - 1, 3, 4, 6, bruin);
  const kx = romp.P1[0] - 10, ky = romp.P1[1] - 12;
  const kanon = d.blok(kx, ky, 18, 4, 7, donkerMetaal);
  d.blok(kx + 10, ky - 7, 4, 3, 5, { boven: P.koperL, links: P.roest, rechts: P.koper, rand: P.v4 }); // trommelmagazijn
  const rem = d.blok(kanon.P1[0] - 2, kanon.P1[1] + 1 - 1, 2, 5, 9, metaal); // mondingsrem
  const mond = op(rij(rem.P1, 2), 5);
  d.rect(mond[0] - 3, mond[1] - 1, 2, 3, P.k0);
  d.zet(mond[0] - 3, mond[1], P.oranje);
  for (let s = 3; s < 17; s += 2) d.lijn(kanon.P3[0] + 2 * s, kanon.P3[1] + s - 1, kanon.P3[0] + 2 * s, kanon.P3[1] + s - 5, P.m0);
  strepen(d, kanon.P3[0], kanon.P3[1] - 6, 18, 1);
  d.omlijn(P.lijn);
  // ---- kabels, heel veel kabels ----
  const kabels = [
    [romp.P3[0] + 3, romp.P3[1] - 1, ax - 7, ay - 6, 6, P.k0, P.k1],
    [romp.P3[0] + 9, romp.P3[1] + 2, ax - 4, ay - 4, 9, P.kRood, P.kRoodL],
    [romp.P2[0] - 4, romp.P2[1], ax + 8, ay - 5, 6, P.kGeel, P.kGeelL],
    [romp.P2[0] + 4, romp.P2[1] - 2, ax + 13, ay - 4, 8, P.k0, P.k1],
    [romp.P2[0] + 10, romp.P2[1] - 5, kanon.P2[0] - 6, kanon.P2[1] - 1, 7, P.kBlauw, P.kBlauwL],
    [kanon.P2[0] - 14, kanon.P2[1] - 6, kanon.P2[0] + 2, kanon.P2[1] - 1, 7, P.k0, P.k1],
    [kanon.P2[0] - 10, kanon.P2[1] - 4, kanon.P2[0] + 6, kanon.P2[1] - 2, 10, P.kRood, P.kRoodL],
    [op(romp.P0, rh)[0] - 8, op(romp.P0, rh)[1] + 4, op(romp.P1, rh)[0] - 4, op(romp.P1, rh)[1] + 1, 5, P.kRood, P.kRoodL],
    [op(romp.P3, rh - 2)[0] + 1, op(romp.P3, rh - 2)[1], romp.P3[0] - 1, romp.P3[1] - 4, 4, P.k0, P.k1],
    [arm.P3[0] + 1, arm.P3[1] - 3, raam[0] + 2, raam[1] + 3, 4, P.kGeel, P.kGeelL],
    [ax + 8, dakY - 16, kanon.P0[0] + 12, kanon.P0[1] - 8, 6, P.k0, P.k1],
    [ax - 5, dakY - 18, op(romp.P3, rh)[0] + 4, op(romp.P3, rh)[1] + 1, 6, P.kGeel, P.kGeelL],
  ];
  for (const [a, b, c, e, zak, k, g] of kabels) d.kabel(a, b, c, e, zak, k, g);
  // neonkabel (gloeit) onder de romp
  d.kabel(romp.P3[0] + 6, romp.P3[1] + 1, romp.P1[0] - 4, romp.P1[1] + 2, 8, P.cyaan);
  // neon langs de bovenranden van de romp
  d.isoLijn(op(romp.P3, rh)[0], op(romp.P3, rh)[1], 10, 'kol', P.roze);
  d.isoLijn(op(romp.P1, rh)[0] - 1, op(romp.P1, rh)[1], 10, 'rij', P.roze);
  // te veel neonlampjes
  const lampjes = [
    [op(rij(romp.P1, 7), 4), P.groen], [op(rij(romp.P1, 8), 4), P.oranje], [op(rij(romp.P1, 9), 4), P.cyaan],
    [op(kol(romp.P3, 9), 15), P.groen], [op(kol(romp.P3, 9), 12), P.oranje], [op(kol(romp.P3, 1), 3), P.roze],
    [op(rem.P2, 8), P.roze], [op(kol(kanon.P3, 5), 3), P.cyaan], [op(kol(kanon.P3, 9), 3), P.cyaan],
    [op(kol(kanon.P3, 13), 3), P.cyaan], [[ax + 10, dakY - 22], P.roze], [[ax - 5 , dakY - 18], P.oranje],
  ];
  for (const [[x, y], k] of lampjes) d.neon(x, y, k, 2);
  for (let i = 0; i < 3; i++) d.zet(raam[0] + 9 + Math.floor(r() * 3), raam[1] - 2 - Math.floor(r() * 4), P.groen);
  bewaar('mech', d, ax, ay, 1);
}

// ---------------------------------------------------------------------------
// FABRIEK (2x2 tegels): bakstenen hal met zaagtanddak, schoorstenen, roldeur, neonbord en kabels overal.
function tekenFabriek() {
  const d = new Doek(80, 104);
  const r = ruis(5);
  const ax = 40, ay = 71;
  // schoorstenen achteraan
  for (const [ox, oy, h] of [[-4, 4, 54], [6, 7, 46]]) {
    const s = d.blok(ax + ox, ay + oy - 20, 3, 3, h, roest);
    for (let b = 8; b < h; b += 10) d.isoLijn(op(s.P3, b)[0], op(s.P3, b)[1], 3, 'kol', P.m2);
    d.isoLijn(op(s.P3, h - 2)[0], op(s.P3, h - 2)[1], 3, 'kol', P.roze);
  }
  // hal
  const hal = d.blok(ax, ay + 1, 15, 15, 28, { boven: P.m3, links: P.b2, rechts: P.b3, rand: P.m4 });
  // bakstenen op de muren
  for (let j = 3; j < 27; j += 3)
    for (let s = (j / 3) % 2; s < 15; s += 2) {
      const l = op(kol(hal.P3, s), j);
      d.zet(l[0], l[1], P.b1);
      const rr = op(rij(hal.P1, s), j);
      d.zet(rr[0] - 1, rr[1], P.b2);
    }
  // zaagtanddak: drie schuine sheds langs kol
  for (let i = 0; i < 3; i++) {
    const basis = op(rij(hal.P0, 1 + i * 5), 28);
    for (let t = 0; t < 6; t++) {
      d.blok(basis[0] - 2 * t, basis[1] + t, 14, 1, 7 - t, { boven: t < 2 ? P.m5 : P.m4, links: P.m2, rechts: P.m3 });
    }
    // glas op de steile kant
    d.isoLijn(basis[0] + 2, basis[1] - 5, 12, 'kol', P.oranje);
    d.isoLijn(basis[0] + 2, basis[1] - 4, 12, 'kol', P.geel);
  }
  // roldeur op het linkervlak met waarschuwingsstrepen
  const deur = kol(hal.P3, 4);
  for (let s = 0; s < 7; s++) for (let j = 0; j < 15; j++) {
    const k = j % 2 ? P.m2 : P.m3;
    d.zet(deur[0] + 2 * s, deur[1] + s - j, k);
    d.zet(deur[0] + 2 * s + 1, deur[1] + s - j, k);
  }
  strepen(d, deur[0], deur[1] - 15, 7, 2);
  // ramen met oranje licht op het rechtervlak
  for (let i = 0; i < 4; i++) {
    const w = op(rij(hal.P1, 2 + i * 3), 14);
    for (let s = 0; s < 2; s++) for (let j = 0; j < 6; j++) {
      d.zet(w[0] - 2 * s - 1, w[1] + s - j, j < 2 ? P.oranje : P.geel);
      d.zet(w[0] - 2 * s - 2, w[1] + s - j, j < 2 ? P.oranje : P.geel);
    }
  }
  // dikke pijp langs de rechtermuur
  const pijp = op(rij(hal.P1, 1), 24);
  d.blok(pijp[0] + 2, pijp[1] - 1, 2, 14, 3, roest);
  d.omlijn(P.lijn);
  // neonbord "KAAS" op het linkervlak (letters 3x5, schuin langs kol)
  const letters = {
    K: ['1.1', '11.', '1..', '11.', '1.1'],
    A: ['.1.', '1.1', '111', '1.1', '1.1'],
    S: ['.11', '1..', '.1.', '..1', '11.'],
  };
  const bord = op(kol(hal.P3, 1), 26);
  'KAAS'.split('').forEach((l, li) => {
    letters[l].forEach((regel, j) =>
      regel.split('').forEach((c, i) => {
        const sx = li * 4 + i;
        if (c === '1') d.zet(bord[0] + sx, bord[1] + Math.floor(sx / 2) + j, P.roze);
      }),
    );
  });
  for (let i = 0; i < 16; i += 3) d.neon(bord[0] + i, bord[1] + Math.floor(i / 2) + 2, P.roze, 2);
  // kabels: van schoorstenen naar het dak, over de muren, uit de deur over de grond
  const dak = (p) => op(p, 28);
  const kabels = [
    [ax - 4, ay - 70, dak(kol(hal.P3, 2))[0], dak(kol(hal.P3, 2))[1], 10, P.k0, P.k1],
    [ax + 6, ay - 58, dak(rij(hal.P1, 2))[0], dak(rij(hal.P1, 2))[1], 9, P.kRood, P.kRoodL],
    [ax - 3, ay - 60, ax + 7, ay - 50, 6, P.kGeel, P.kGeelL],
    [dak(kol(hal.P3, 6))[0], dak(kol(hal.P3, 6))[1] + 1, dak(kol(hal.P3, 13))[0], dak(kol(hal.P3, 13))[1] + 1, 8, P.k0, P.k1],
    [dak(hal.P2)[0], dak(hal.P2)[1] + 1, hal.P2[0] + 3, hal.P2[1] - 2, 3, P.kBlauw, P.kBlauwL],
    [dak(rij(hal.P1, 9))[0] - 1, dak(rij(hal.P1, 9))[1] + 1, dak(rij(hal.P1, 14))[0], dak(rij(hal.P1, 14))[1] + 1, 7, P.kRood, P.kRoodL],
    [deur[0] + 6, deur[1] + 2, hal.P3[0] - 2, hal.P3[1] + 6, 2, P.k0, P.k1],
    [deur[0] + 10, deur[1] + 4, hal.P3[0] + 6, hal.P3[1] + 9, 2, P.kGeel, P.kGeelL],
  ];
  for (const [a, b, c, e, zak, k, g] of kabels) d.kabel(a, b, c, e, zak, k, g);
  d.kabel(dak(kol(hal.P3, 1))[0], dak(kol(hal.P3, 1))[1] + 3, dak(kol(hal.P3, 9))[0], dak(kol(hal.P3, 9))[1] + 3, 6, P.groen);
  // lampjes
  for (const [p, k] of [
    [op(hal.P2, 27), P.roze], [op(hal.P2, 3), P.groen], [op(kol(hal.P3, 12), 4), P.cyaan],
    [op(rij(hal.P1, 13), 4), P.oranje], [[ax - 4, ay - 72], P.roze], [[ax + 6, ay - 60], P.cyaan],
  ]) d.neon(p[0], p[1], k, 2);
  for (let i = 0; i < 5; i++) d.zet(deur[0] + 2 + Math.floor(r() * 10), deur[1] - 1 - Math.floor(r() * 10), P.m4);
  bewaar('fabriek', d, ax, ay + 1, 2);
}

// ---------------------------------------------------------------------------
// PERS (1 tegel): hydraulische pers die schroot tot platen slaat.
function tekenPers() {
  const d = new Doek(44, 66);
  const ax = 22, ay = 49;
  const voet = d.blok(ax, ay, 8, 8, 6, donkerMetaal);
  strepen(d, voet.P3[0], voet.P3[1] - 2, 8, 2);
  strepenRij(d, voet.P1[0] - 1, voet.P1[1] - 2, 8, 2);
  // plaat schroot op het aambeeld
  d.blok(ax, ay + 3 - 6, 4, 4, 2, roest);
  // pilaren
  for (const [ox, oy] of [[0, 0], [10, 5], [-10, 5]]) d.blok(ax + ox - 1, ay + oy - 6, 1, 1, 34, metaal);
  // bovenbalk en cilinder
  const top = d.blok(ax, ay - 40, 8, 8, 8, bruin);
  nagels(d, top.P3[0] + 1, top.P3[1] - 2, 8, 2, P.b5);
  d.blok(ax, ay - 30, 3, 3, 4, metaal);
  d.lijn(ax - 1, ay - 23, ax - 1, ay - 16, P.m5); // zuigerstang
  d.blok(ax, ay - 18, 6, 6, 3, metaal); // stempel
  d.omlijn(P.lijn);
  d.kabel(top.P1[0], top.P1[1] - 6, voet.P1[0] + 2, voet.P1[1] - 4, 6, P.k0, P.k1);
  d.kabel(top.P3[0], top.P3[1] - 4, voet.P3[0] - 2, voet.P3[1] - 2, 5, P.kRood, P.kRoodL);
  d.kabel(op(top.P0, 8)[0], op(top.P0, 8)[1], top.P3[0] - 3, top.P3[1] + 6, 8, P.kGeel, P.kGeelL);
  d.kabel(voet.P2[0] - 2, voet.P2[1] - 2, voet.P2[0] + 8, voet.P2[1] + 3, 2, P.k0, P.k1);
  d.neon(op(top.P0, 10)[0], op(top.P0, 10)[1], P.oranje, 2);
  d.neon(op(top.P2, 4)[0], op(top.P2, 4)[1], P.groen, 2);
  d.neon(op(kol(top.P3, 4), 4)[0], op(kol(top.P3, 4), 4)[1], P.roze, 2);
  d.neon(op(rij(voet.P1, 4), 4)[0], op(rij(voet.P1, 4), 4)[1], P.cyaan, 1);
  bewaar('pers', d, ax, ay, 1);
}

// ---------------------------------------------------------------------------
// DYNAMO (1 tegel): koperen spoel met een neon kern; levert stroom via (hoe kan het ook anders) kabels.
function tekenDynamo() {
  const d = new Doek(44, 70);
  const ax = 22, ay = 53;
  const voet = d.blok(ax, ay, 8, 8, 5, bruin);
  nagels(d, voet.P3[0] + 1, voet.P3[1] - 2, 8, 2, P.b5);
  // spoel: wikkelingen koper en donker
  for (let i = 0; i < 9; i++) {
    const k = i % 2 ? { boven: P.koperL, links: P.roest, rechts: P.koper } : { boven: P.m3, links: P.m1, rechts: P.m2 };
    d.blok(ax, ay - 7 - i * 3 - 2, 5, 5, 3, k);
  }
  // kap en bol
  d.blok(ax, ay - 38, 6, 6, 3, donkerMetaal);
  d.blok(ax, ay - 46, 2, 2, 6, metaal);
  d.omlijn(P.lijn);
  // neon kern: verticale strepen op de spoel
  for (let j = 0; j < 26; j++) {
    d.zet(ax - 4, ay - 10 - j + 4, P.cyaan);
    d.zet(ax + 4, ay - 10 - j + 4, P.cyaan);
  }
  for (let j = 0; j < 26; j += 4) { d.neon(ax - 4, ay - 6 - j, P.cyaan, 1); d.neon(ax + 4, ay - 6 - j, P.cyaan, 1); }
  d.neon(ax - 1, ay - 50, P.cyaan, 2);
  d.neon(ax, ay - 50, P.cyaan, 2);
  // kabels die van de kap over de voet naar de grond lopen
  d.kabel(ax - 10, ay - 38, voet.P3[0] - 2, voet.P3[1] + 1, 5, P.k0, P.k1);
  d.kabel(ax + 10, ay - 37, voet.P1[0] + 2, voet.P1[1] + 1, 5, P.kRood, P.kRoodL);
  d.kabel(ax + 6, ay - 34, voet.P2[0] + 4, voet.P2[1] + 2, 9, P.kGeel, P.kGeelL);
  d.kabel(ax - 6, ay - 34, voet.P2[0] - 6, voet.P2[1] + 2, 9, P.kBlauw, P.kBlauwL);
  d.neon(op(voet.P2, 3)[0], op(voet.P2, 3)[1], P.groen, 2);
  d.neon(op(rij(voet.P1, 2), 3)[0], op(rij(voet.P1, 2), 3)[1], P.oranje, 1);
  bewaar('dynamo', d, ax, ay, 1);
}

// ---------------------------------------------------------------------------
// LOOPBAND (1 tegel, langs kol): spiegelen in het spel geeft de rij-richting.
function tekenBand() {
  const d = new Doek(40, 30);
  const ax = 22, ay = 9;
  const b = d.blok(ax - 4, ay + 2 + 4, 8, 4, 5, donkerMetaal);
  // rollen
  for (let s = 0; s < 8; s++) d.isoLijn(op(kol(b.P0, s), 5)[0], op(kol(b.P0, s), 5)[1], 4, 'rij', s % 2 ? P.m1 : P.m3);
  strepen(d, b.P3[0], b.P3[1] - 1, 8, 2);
  // kistje en een brok schroot
  d.blok(op(kol(b.P0, 2), 5)[0] - 2, op(kol(b.P0, 2), 5)[1] + 1, 2, 2, 4, bruin);
  d.blok(op(kol(b.P0, 5), 5)[0] - 2, op(kol(b.P0, 5), 5)[1] + 1, 2, 2, 2, roest);
  d.omlijn(P.lijn);
  d.kabel(b.P3[0] + 4, b.P3[1] - 1, b.P3[0] + 12, b.P3[1] + 4, 3, P.k0, P.k1);
  d.neon(op(b.P1, 4)[0] - 1, op(b.P1, 4)[1], P.groen, 1);
  d.neon(op(kol(b.P3, 4), 3)[0], op(kol(b.P3, 4), 3)[1], P.oranje, 1);
  bewaar('band', d, ax, ay + 4, 1);
}

// ---------------------------------------------------------------------------
// KABELMAST: paal met dwarsarm, isolatoren en neon. Kabels tussen masten zijn losse sprites (kabels.png).
function tekenMast() {
  const d = new Doek(28, 60);
  const ax = 14, ay = 49;
  d.blok(ax, ay + 2, 3, 3, 3, donkerMetaal);
  const paal = d.blok(ax, ay + 3, 1, 1, 42, bruin);
  // dwarsarm langs kol en langs rij
  d.blok(ax - 6, ay - 36, 6, 1, 2, metaal);
  d.blok(ax + 1, ay - 37, 1, 5, 2, metaal);
  d.omlijn(P.lijn);
  for (const p of [[ax - 7, ay - 37], [ax + 4, ay - 34], [ax + 8, ay - 37], [ax - 3, ay - 34]]) d.neon(p[0], p[1] - 1, P.cyaan, 1);
  d.neon(op(paal.P0, 42)[0], op(paal.P0, 42)[1] - 1, P.roze, 2);
  // losse kabeleinden die naar beneden bungelen
  d.kabel(ax - 7, ay - 37, ax - 9, ay - 20, 2, P.k0, P.k1);
  d.kabel(ax + 4, ay - 34, ax - 1, ay - 8, 4, P.kRood, P.kRoodL);
  d.kabel(ax + 2, ay - 30, ax + 5, ay, 3, P.kGeel, P.kGeelL);
  // anker op de achterhoek van de tegel, zodat de paal midden op de tegel staat
  bewaar('mast', d, ax, ay + 3 - 8, 1);
}

// KABELS: bundel van drie kabels over één tegel langs kol (van mast tot mast). Spiegel voor rij.
function tekenKabels() {
  const d = new Doek(36, 30);
  const ax = 2, ay = 6;
  // van isolator tot isolator: twee tegels langs kol = (+32, +16)
  d.kabel(ax, ay + 4, ax + 32, ay + 20, 9, P.k0, P.k1);
  d.kabel(ax, ay + 2, ax + 32, ay + 18, 6, P.kRood, P.kRoodL);
  d.kabel(ax + 1, ay + 6, ax + 31, ay + 22, 12, P.kGeel, P.kGeelL);
  d.kabel(ax + 1, ay + 3, ax + 31, ay + 19, 4, P.cyaan);
  // anker: zo valt het begin op de isolator van een mast op dezelfde tegel
  bewaar('kabels', d, ax + 7, ay + 4 + 41 - 8, 2);
}

tekenMuis('muis', 'gewoon');
tekenMuis('muis-monteur', 'monteur');
tekenMech();
tekenFabriek();
tekenPers();
tekenDynamo();
tekenBand();
tekenMast();
tekenKabels();

const regels = Object.entries(ankers).map(
  ([n, a]) => `  '${n}': { w: ${a.w}, h: ${a.h}, ankerX: ${a.ankerX}, ankerY: ${a.ankerY}, tegels: ${a.tegels} },`,
);
writeFileSync(
  join(wortel, 'src', 'muizen', 'sprites.ts'),
  `// Gegenereerd door scripts/pixel/muizen.mjs. Niet met de hand aanpassen.\n` +
    `// anker = pixel in de sprite die op de achterhoek van de tegel valt (voor muizen: de voeten).\n` +
    `export const MUIZEN_SPRITES = {\n${regels.join('\n')}\n} as const;\n\n` +
    `export type MuizenSprite = keyof typeof MUIZEN_SPRITES;\n`,
);
console.log('getekend:', Object.keys(ankers).join(', '));
