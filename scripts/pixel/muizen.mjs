// Tekenscript voor de muizen-sprites. Draai: node scripts/pixel/muizen.mjs
// Schrijft PNG's naar assets/muizen/ (plus <naam>-gloed.png voor neon) en de ankers naar src/muizen/sprites.ts.
// Stijl: grauwe, duistere industrie. Muizen klein en pluizig (en vuil); hun machines gigantisch, hoekig en semi-3D.
// Bruin, staal en legergroen, roest, olie, veel te veel kabels. Neon is het enige felle, en dat gloeit echt.
import { Doek, ruis } from './pixel.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const uit = join(wortel, 'assets', 'muizen');
mkdirSync(uit, { recursive: true });

// ---- Kleurtrappen (donker -> licht), allemaal grauw ----
const T = {
  staal: ['#0c0d0e', '#141618', '#1c1f21', '#25292b', '#303436', '#3d4143', '#4c5051', '#5e6261', '#787a76'],
  chroom: ['#16181a', '#25292b', '#3a3e3f', '#55595a', '#727675', '#8e918c', '#aeb0a8'],
  olijf: ['#0f100d', '#171913', '#20231a', '#2a2e22', '#353a2b', '#424836', '#525843', '#646a52'],
  bruin: ['#100c0a', '#18120f', '#211915', '#2b211b', '#362a22', '#43352a', '#524134', '#634f40'],
  beton: ['#111111', '#1a1a19', '#232321', '#2d2d2a', '#383834', '#45443f', '#53524b', '#64625a'],
  roest: ['#170d08', '#24130b', '#341b0f', '#462413', '#5a2f18', '#6f3c1f', '#874d29'],
  messing: ['#15100a', '#221a0f', '#312615', '#42341c', '#554424', '#6a552d', '#836b3a'],
  rubber: ['#08080a', '#0e0f11', '#151618', '#1d1f21', '#26282a', '#303234'],
  glas: ['#030506', '#060b0d', '#0a1316', '#0f1c20', '#16292e', '#2a4a50'],
  vacht: ['#1f1b18', '#2f2a25', '#433c35', '#5a5148', '#71675c', '#887d70', '#9e9283'],
};
const K = {
  lijn: '#060505',
  k0: '#0a0a0b', k1: '#1b1c1e', kRood: '#3a1312', kRoodL: '#521e1b', kGeel: '#3f3510', kGeelL: '#5a4c1c',
  kBlauw: '#141f2e', kBlauwL: '#213247',
  gevaar: '#7a6418', verf: '#7c7a6a', olie: '#030303', roet: '#000000', neus: '#7a5052',
};
// Neon: het enige felle in de wereld.
const N = { cyaan: '#4ef2ff', gif: '#9dff2e', natrium: '#ff9a1f', rood: '#ff2a3a', magenta: '#ff2fb0' };

const ankers = {};
function bewaar(naam, d, ankerX, ankerY, tegels) {
  d.png(join(uit, `${naam}.png`));
  const gloed = d.gloedPng(join(uit, `${naam}-gloed.png`));
  ankers[naam] = { w: d.w, h: d.h, ankerX, ankerY, tegels, gloed };
}

// Iso-punt: k stappen langs kol, r langs rij, z pixels omhoog, vanaf de achterhoek (ax, ay).
const isoPunt = (ax, ay) => (k, r, z = 0) => [Math.round(ax + 2 * k - 2 * r), Math.round(ay + k + r - z)];
// Pixels van een iso-lijn (voor neonbuizen).
function isoPixels(p, stappen, richting) {
  const sx = richting === 'kol' ? 1 : -1, uit = [];
  for (let s = 0; s < stappen; s++) uit.push([p[0] + sx * 2 * s, p[1] + s], [p[0] + sx * (2 * s + 1), p[1] + s]);
  return uit;
}
function streep(d, p, stappen, richting, kleur) {
  for (const [x, y] of isoPixels(p, stappen, richting)) d.zet(x, y, kleur);
}
// Waarschuwingsstrepen (vaal geel/zwart) op een vlak langs kol of rij.
function gevaar(d, p, stappen, hoog, richting) {
  const sx = richting === 'kol' ? 1 : -1;
  for (let s = 0; s < stappen; s++)
    for (let j = 0; j < hoog; j++) {
      const k = Math.floor((s + j) / 2) % 2 ? K.k0 : K.gevaar;
      d.zet(p[0] + sx * 2 * s, p[1] + s - j, k);
      d.zet(p[0] + sx * (2 * s + 1), p[1] + s - j, k);
    }
}
// Klinknagels met roestveeg eronder.
function nagels(d, p, stappen, elke, richting, r) {
  const sx = richting === 'kol' ? 1 : -1;
  for (let s = 1; s < stappen; s += elke) {
    const x = p[0] + sx * 2 * s, y = p[1] + s;
    d.zet(x, y, T.staal[7]);
    d.zet(x, y + 1, T.staal[1]);
    if (r() < 0.5) d.veeg(x, y + 2, 2 + Math.floor(r() * 4), T.roest[4]);
  }
}
// Sjabloonletters 3x5.
const FONT = {
  M: ['1.1', '111', '1.1', '1.1', '1.1'], K: ['1.1', '11.', '1..', '11.', '1.1'], A: ['.1.', '1.1', '111', '1.1', '1.1'],
  S: ['.11', '1..', '.1.', '..1', '11.'], 0: ['111', '1.1', '1.1', '1.1', '111'], 7: ['111', '..1', '.1.', '.1.', '.1.'],
  '-': ['...', '...', '111', '...', '...'],
};
function tekst(d, p, woord, richting, kleur, r, schil = 0.25, neon = false) {
  const sx = richting === 'kol' ? 1 : -1;
  let kolom = 0;
  for (const l of woord) {
    const g = FONT[l];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++) {
        if (g[j][i] !== '1') continue;
        const c = kolom + i;
        const x = p[0] + sx * c, y = p[1] + Math.floor(c / 2) + j;
        if (neon) d.licht(x, y, kleur);
        else if (r() > schil) d.zet(x, y, kleur);
      }
    kolom += 4;
  }
}
const kabels = (d, lijst) => { for (const [a, b, c, e, z, k, g] of lijst) d.kabel(a, b, c, e, z, k, g); };

// ---------------------------------------------------------------------------
// MUIS: klein, heel pluizig, grauw en vuil. Neonbril die groen gloeit.
function tekenMuis(naam, variant) {
  const d = new Doek(18, 16);
  const r = ruis(variant === 'monteur' ? 7 : 3);
  const v = T.vacht;
  const blob = (cx, cy, rx, ry, pluis) => {
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const dd = dx * dx + dy * dy;
        if (dd <= 1 || (dd <= 1 + pluis && r() < 0.45)) {
          const l = dx * 0.5 - dy * 0.9 + (r() - 0.5) * 0.7;
          d.zet(x, y, v[Math.max(0, Math.min(6, Math.round(3 + l * 2.2)))]);
        }
      }
  };
  d.kabel(3, 12, 1, 8, 1, K.neus); // staart
  d.rect(3, 7, 3, 4, T.bruin[3]); d.rect(3, 7, 3, 1, T.bruin[5]); // rugzakje
  blob(8.5, 10, 5, 4.2, 0.6);
  blob(10.5, 6.5, 3.6, 3.2, 0.55);
  const oor = (cx, cy) => {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4.5) d.zet(cx + x, cy + y, v[3]);
    d.zet(cx, cy, K.neus); d.zet(cx, cy + 1, K.neus); d.zet(cx - 1, cy - 1, v[5]);
  };
  oor(8, 2);
  oor(13, 3);
  d.zet(9, 4, K.k0); d.zet(11, 4, K.k0); d.zet(13, 5, K.k0);
  d.zet(12, 6, K.lijn); d.zet(14, 7, K.neus); d.zet(15, 6, v[2]); d.zet(15, 8, v[2]);
  d.zet(7, 14, K.neus); d.zet(10, 14, K.neus);
  for (let i = 0; i < 6; i++) d.meng(4 + Math.floor(r() * 10), 6 + Math.floor(r() * 8), K.olie, 0.4);
  if (variant === 'monteur') {
    d.lijn(11, 12, 16, 7, T.staal[6]);
    d.zet(16, 6, T.staal[5]); d.zet(17, 7, T.staal[5]); d.zet(17, 6, T.staal[7]);
  }
  d.omlijn(K.lijn);
  d.kabel(3, 10, 0, 15, 1, K.k0);
  d.licht(10, 4, N.gif);
  d.licht(12, 4, N.gif);
  d.licht(4, 9, N.rood);
  bewaar(naam, d, 9, 15, 0);
}

// ---------------------------------------------------------------------------
// MECH "Grootbek": 2x2 tegels. Een piepkleine muis in een glazen koepel bovenop een lopende fabriek.
// Digitigrade poten met zuigers, olijf pantser, dubbelloops kanon rechts, hydraulische grijper links.
function tekenMech() {
  const d = new Doek(156, 160);
  const r = ruis(11);
  const ax = 76, ay = 118;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });

  // --- rugzak met generator, radiateur en uitlaten (achteraan, dus eerst) ---
  const rug = B(1, 1, 56, 7, 7, 28, T.bruin);
  for (let i = 1; i < 7; i++) { const p = g(8, 1 + i, 60); d.lijn(p[0], p[1], p[0], p[1] - 20, T.bruin[1]); }
  for (const [k, rr, rad, h] of [[2.5, 3, 4, 26], [5.5, 2, 3, 20], [3, 6, 2, 14]]) {
    const p = g(k, rr, 84);
    d.cilinder(p[0], p[1], rad, h, T.roest, { r, open: true });
    for (let j = 0; j < 4; j++) d.meng(p[0] - rad + 1 + Math.floor(r() * rad * 2), p[1] - h - 2 + Math.floor(r() * 4), K.roet, 0.7);
  }
  const ant = g(7, 2, 84);
  d.lijn(ant[0], ant[1], ant[0] + 3, ant[1] - 26, T.staal[5]);
  d.lijn(ant[0] + 1, ant[1], ant[0] + 4, ant[1] - 26, T.staal[2]);

  // --- poten ---
  const poot = (kc, rc) => {
    B(kc - 3, rc - 3, 0, 7, 7, 4, T.staal);
    B(kc + 4, rc - 2, 0, 3, 2, 3, T.staal); // teen voor
    B(kc - 2, rc + 4, 0, 2, 3, 3, T.staal); // teen zij
    B(kc - 4, rc - 4, 0, 2, 2, 3, T.staal); // hiel
    d.bol(...g(kc + 0.5, rc + 0.5, 7), 4, T.staal);
    const sch = B(kc - 1, rc - 1, 8, 3, 3, 20, T.olijf);
    gevaar(d, [sch.P3[0], sch.P3[1] - 3], 3, 2, 'kol');
    const z = g(kc + 2.6, rc + 2.6, 9);
    d.cilinder(z[0], z[1], 2, 18, T.chroom, { r });
    d.veeg(z[0] - 1, z[1] - 10, 8, K.olie);
    d.bol(...g(kc + 0.5, rc + 0.5, 30), 5, T.staal);
    B(kc - 2, rc - 2, 32, 4, 4, 12, T.olijf);
  };
  poot(11, 4);
  poot(4, 11);
  const heup = g(4, 11, 47);
  d.buis(heup[0] - 2, heup[1], 34, 'x', 3, T.staal, { ringen: 6 });

  // --- romp ---
  const romp = B(3, 3, 44, 10, 10, 26, T.staal);
  const platL = B(3, 13, 46, 10, 1, 23, T.olijf); // pantser links-voor
  const platR = B(13, 3, 46, 1, 10, 23, T.olijf); // pantser rechts-voor
  nagels(d, [platL.P3[0], platL.P3[1] - 21], 10, 2, 'kol', r);
  nagels(d, [platL.P3[0], platL.P3[1] - 2], 10, 2, 'kol', r);
  nagels(d, [platR.P1[0] - 1, platR.P1[1] - 21], 10, 2, 'rij', r);
  streep(d, [platR.P1[0] - 1, platR.P1[1] - 11], 10, 'rij', T.olijf[1]);
  tekst(d, [platL.P3[0] + 4, platL.P3[1] - 16], 'M-07', 'kol', K.verf, r, 0.3);
  const top = B(5, 5, 70, 6, 6, 5, T.staal);
  for (let i = 1; i < 6; i += 2) streep(d, [top.P0[0] - 2 * i, top.P0[1] - 5 + i], 6, 'kol', T.staal[1]);
  B(11, 11, 68, 4, 4, 3, T.staal); // koepelring
  // koepel met de piloot
  const kp = g(12.5, 12.5, 74);
  d.bol(kp[0], kp[1], 7, T.glas, { mat: true });
  d.rect(kp[0] - 2, kp[1] - 1, 4, 3, T.vacht[4]);
  d.zet(kp[0] - 2, kp[1] - 3, T.vacht[3]); d.zet(kp[0] - 2, kp[1] - 2, T.vacht[3]);
  d.zet(kp[0] + 1, kp[1] - 3, T.vacht[3]); d.zet(kp[0] + 1, kp[1] - 2, T.vacht[3]);
  d.zet(kp[0] + 1, kp[1], K.lijn);
  d.zet(kp[0] - 1, kp[1] + 2, T.vacht[2]); d.zet(kp[0], kp[1] + 2, T.vacht[2]);
  for (let a = 0; a < 5; a++) d.zet(kp[0] + 2 + Math.round(Math.cos(a / 3) * 2), kp[1] - 5 + a, T.glas[5]);

  // --- rechterarm: schouder, arm, dubbelloops kanon ---
  B(13, 0, 40, 4, 4, 18, T.olijf);
  d.bol(...g(14.5, 1.5, 62), 7, T.olijf);
  const huis = B(14, -1, 34, 9, 6, 11, T.staal);
  gevaar(d, [huis.P1[0] - 1, huis.P1[1] - 2], 6, 2, 'rij');
  const l1 = g(23, 0.8, 42), l2 = g(23, 3.2, 40);
  d.buis(l1[0], l1[1], 11, 'kol', 2, T.staal, { loop: true, ringen: 5 });
  d.buis(l2[0], l2[1], 12, 'kol', 2, T.staal, { loop: true, ringen: 5 });
  B(21, -1, 46, 3, 3, 5, T.messing); // munitiekist

  // --- linkerarm: schouder, arm, hydraulische grijper ---
  B(0, 13, 40, 4, 4, 18, T.olijf);
  d.bol(...g(1.5, 14.5, 62), 7, T.olijf);
  const cyl = g(2.5, 17, 42);
  d.buis(cyl[0], cyl[1], 7, 'rij', 2, T.chroom);
  const kop = B(0, 23, 34, 5, 3, 10, T.staal);
  gevaar(d, [kop.P3[0], kop.P3[1] - 1], 5, 2, 'kol');
  for (const [k, rr] of [[0.5, 26], [2.5, 26], [4.5, 26]]) B(k, rr, 22, 1, 1, 12, T.staal);

  d.omlijn(K.lijn);
  d.vuil(0.05, K.olie, 0.45, r);
  for (let i = 0; i < 10; i++) {
    const p = g(3 + r() * 10, 13, 46 + r() * 20);
    d.veeg(p[0], p[1], 3 + Math.floor(r() * 5), T.roest[3]);
  }

  // --- kabels, heel veel kabels ---
  const ra = g(4, 1, 70);
  kabels(d, [
    [rug.P3[0] + 2, rug.P3[1] - 6, romp.P3[0] + 2, romp.P3[1] - 2, 6, K.k0, K.k1],
    [rug.P1[0] - 2, rug.P1[1] - 8, huis.P0[0] + 2, huis.P0[1] - 10, 10, K.kRood, K.kRoodL],
    [ra[0], ra[1], g(21, 0, 50)[0], g(21, 0, 50)[1], 12, T.messing[3], T.messing[5]], // munitieband
    [romp.P3[0] + 4, romp.P3[1] + 1, g(4, 11, 40)[0], g(4, 11, 40)[1], 6, K.k0, K.k1],
    [romp.P3[0] + 10, romp.P3[1] + 4, g(4, 12, 28)[0], g(4, 12, 28)[1], 8, K.kGeel, K.kGeelL],
    [romp.P2[0] - 6, romp.P2[1] + 1, g(5, 13, 18)[0], g(5, 13, 18)[1], 6, K.kBlauw, K.kBlauwL],
    [romp.P2[0] + 6, romp.P2[1] - 1, g(12, 5, 26)[0], g(12, 5, 26)[1], 7, K.k0, K.k1],
    [romp.P1[0] - 6, romp.P1[1] - 1, g(12, 4, 20)[0], g(12, 4, 20)[1], 10, K.kRood, K.kRoodL],
    [huis.P2[0], huis.P2[1] - 2, g(14, 6, 40)[0], g(14, 6, 40)[1], 6, K.k0, K.k1],
    [kop.P0[0], kop.P0[1] - 8, g(1, 16, 48)[0], g(1, 16, 48)[1], 4, K.kGeel, K.kGeelL],
    [kop.P2[0], kop.P2[1] - 4, g(2, 13, 40)[0], g(2, 13, 40)[1], 9, K.k0, K.k1],
    [g(3, 12, 46)[0], g(3, 12, 46)[1], g(0, 16, 40)[0], g(0, 16, 40)[1], 8, K.kRood, K.kRoodL],
    [ant[0] + 2, ant[1] - 14, top.P1[0], top.P1[1] - 4, 6, K.k0, K.k1],
    [g(6, 2, 84)[0], g(6, 2, 84)[1], g(10, 1, 70)[0], g(10, 1, 70)[1], 4, K.kBlauw, K.kBlauwL],
  ]);
  d.kabel(rug.P3[0], rug.P3[1] - 4, g(-6, 6, 0)[0], g(-6, 6, 0)[1], 14, K.k0, K.k1);
  d.kabel(rug.P3[0] + 4, rug.P3[1] - 2, g(-3, 9, 0)[0], g(-3, 9, 0)[1], 16, K.kRood, K.kRoodL);

  // --- neon: het enige felle ---
  d.neonKabel(romp.P3[0] + 6, romp.P3[1] + 2, romp.P1[0] - 6, romp.P1[1] + 2, 10, N.cyaan);
  d.neonKabel(huis.P3[0] + 4, huis.P3[1] - 2, g(14, 4, 30)[0], g(14, 4, 30)[1], 6, N.gif);
  d.neonLijn(isoPixels(g(11, 15, 67), 4, 'kol'), N.cyaan);
  d.neonLijn(isoPixels(g(15, 11, 67), 4, 'rij').map(([x, y]) => [x - 1, y]), N.cyaan);
  for (let i = 0; i < 4; i++) d.neon(...g(14, 4 + i * 2, 54), [N.gif, N.natrium, N.rood, N.gif][i], 1);
  d.neon(...g(24, 2, 46), N.rood, 2);
  d.neon(...g(3, 26, 36), N.natrium, 2);
  d.neon(ant[0] + 3, ant[1] - 27, N.rood, 2);
  d.neon(...g(13, 13, 40), N.magenta, 1);
  d.neon(...g(4, 11, 20), N.gif, 1);
  d.neon(...g(11, 4, 20), N.gif, 1);
  d.licht(kp[0] - 2, kp[1] - 1, N.gif); d.licht(kp[0], kp[1] - 1, N.gif);
  bewaar('mech', d, ax, ay, 2);
}

// ---------------------------------------------------------------------------
// SJOUWBOT (1 tegel): rupsbanden, gasfles, kraantje met een hangende kist, muis op een open stoeltje.
function tekenSjouwbot() {
  const d = new Doek(64, 70);
  const r = ruis(21);
  const ax = 26, ay = 48;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });
  const m = g(2, 2, 18);
  d.cilinder(m[0], m[1], 2, 20, T.staal, { r });
  for (const rr of [0.5, 5]) {
    const b = B(0, rr, 0, 9, 2.5, 6, T.rubber);
    for (let s = 0; s < 9; s++) {
      const p = [b.P3[0] + 2 * s, b.P3[1] + s];
      d.lijn(p[0], p[1] - 1, p[0], p[1] - 5, T.rubber[0]);
    }
  }
  B(0.5, 1, 6, 8, 6, 5, T.bruin);
  const kast = B(0.5, 1.5, 11, 4, 5, 11, T.olijf);
  gevaar(d, [kast.P3[0], kast.P3[1] - 1], 4, 2, 'kol');
  nagels(d, [kast.P1[0] - 1, kast.P1[1] - 9], 5, 2, 'rij', r);
  const fl = g(6.5, 2.2, 11);
  d.cilinder(fl[0], fl[1], 3, 12, T.roest, { r });
  B(5.5, 4.5, 11, 2, 2, 2, T.bruin);
  const mu = g(6.5, 5.5, 13);
  d.rect(mu[0] - 2, mu[1] - 4, 4, 4, T.vacht[4]); d.zet(mu[0] - 2, mu[1] - 5, T.vacht[3]); d.zet(mu[0] + 1, mu[1] - 5, T.vacht[3]);
  d.zet(mu[0] + 1, mu[1] - 3, K.lijn); d.zet(mu[0] - 1, mu[1] - 3, T.vacht[5]);
  const gk = g(2, 2, 38);
  d.buis(gk[0], gk[1], 11, 'kol', 1, T.staal, { ringen: 4 });
  const eind = g(12.5, 2, 37);
  d.lijn(eind[0], eind[1], eind[0], eind[1] + 13, K.k1);
  const kist = B(11.5, 1, 18, 2, 2, 6, T.bruin);
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.45, r);
  kabels(d, [
    [kast.P0[0] - 2, kast.P0[1] - 10, m[0], m[1] - 12, 3, K.k0, K.k1],
    [kast.P1[0] - 2, kast.P1[1] - 6, fl[0] + 3, fl[1] - 4, 4, K.kRood, K.kRoodL],
    [fl[0] - 2, fl[1] - 10, kast.P2[0] + 2, kast.P2[1] - 9, 5, K.kGeel, K.kGeelL],
    [kast.P3[0] + 2, kast.P3[1] - 4, g(0, 8, 2)[0], g(0, 8, 2)[1], 4, K.k0, K.k1],
    [m[0], m[1] - 20, gk[0] + 10, gk[1] + 5, 3, K.kBlauw, K.kBlauwL],
  ]);
  d.neon(m[0], m[1] - 22, N.natrium, 2);
  d.neon(...g(4.5, 6.5, 18), N.gif, 1);
  d.neon(...g(4.5, 4, 14), N.rood, 1);
  d.licht(mu[0] - 1, mu[1] - 4, N.gif); d.licht(mu[0] + 1, mu[1] - 4, N.gif);
  d.neon(kist.P2[0], kist.P2[1] - 3, N.cyaan, 1);
  bewaar('sjouwbot', d, ax, ay, 1);
}

// ---------------------------------------------------------------------------
// FABRIEK (2x2 tegels): betonnen hal, zaagtanddak, roetzwarte schoorstenen, kapot neonbord ("KAAS", de K is dood).
function tekenFabriek() {
  const d = new Doek(84, 112);
  const r = ruis(5);
  const ax = 42, ay = 78;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });
  for (const [k, rr, rad, h] of [[2, 2, 4, 62], [6, 1, 3, 52]]) {
    const p = g(k, rr, 0);
    d.cilinder(p[0], p[1], rad, h, T.beton, { r, open: true });
    for (let j = 6; j < h; j += 12) for (let x = -rad; x < rad; x++) d.meng(p[0] + x, p[1] - j, T.roest[3], 0.7);
    for (let j = 0; j < 8; j++) for (let x = -rad; x < rad; x++) if (r() < 0.6) d.meng(p[0] + x, p[1] - h + j, K.roet, 0.7);
  }
  B(0, 0, 0, 16, 16, 28, T.beton);
  for (let j = 3; j < 27; j += 3)
    for (let s = (j / 3) % 2; s < 16; s += 2) {
      const l = g(s, 16, j); d.zet(l[0], l[1], T.beton[1]);
      const rr = g(16, s, j); d.zet(rr[0] - 1, rr[1], T.beton[2]);
    }
  for (let i = 0; i < 3; i++) {
    for (let t = 0; t < 6; t++) B(0, 1 + i * 5 + t, 28, 16, 1, 7 - t, T.staal);
    d.neonLijn(isoPixels(g(1, 1 + i * 5, 34), 14, 'kol'), N.natrium);
  }
  const deur = g(4, 16, 0);
  for (let s = 0; s < 7; s++) for (let j = 0; j < 15; j++) {
    const k = j % 2 ? T.staal[2] : T.staal[3];
    d.zet(deur[0] + 2 * s, deur[1] + s - j, k); d.zet(deur[0] + 2 * s + 1, deur[1] + s - j, k);
  }
  gevaar(d, [deur[0], deur[1] - 15], 7, 2, 'kol');
  const pp = g(16, 1, 23);
  d.buis(pp[0] + 2, pp[1], 14, 'rij', 2, T.roest, { ringen: 4 });
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.4, r);
  for (let i = 0; i < 14; i++) {
    const p = r() < 0.5 ? g(r() * 16, 16, 10 + r() * 18) : g(16, r() * 16, 10 + r() * 18);
    d.veeg(p[0], p[1], 4 + Math.floor(r() * 8), r() < 0.5 ? T.roest[3] : K.olie);
  }
  // ramen: dof natriumlicht, sommige ruiten kapot
  for (let i = 0; i < 4; i++) {
    const w = g(16, 2 + i * 3.5, 14);
    for (let s = 0; s < 2; s++) for (let j = 0; j < 6; j++) {
      const x = w[0] - 2 * s - 1, y = w[1] + s - j;
      if (r() < 0.25) { d.zet(x, y, T.glas[2]); d.zet(x - 1, y, T.glas[2]); continue; }
      const k = j < 2 ? N.natrium : '#c8781a';
      d.licht(x, y, k); d.licht(x - 1, y, k);
    }
  }
  // neonbord: dode K, gloeiende AAS
  const bord = g(1, 16, 21);
  tekst(d, bord, 'K', 'kol', '#3a2030', r, 0);
  tekst(d, [bord[0] + 4, bord[1] + 2], 'AAS', 'kol', N.magenta, r, 0, true);
  kabels(d, [
    [g(2, 2, 58)[0], g(2, 2, 58)[1], g(3, 3, 35)[0], g(3, 3, 35)[1], 8, K.k0, K.k1],
    [g(6, 1, 48)[0], g(6, 1, 48)[1], g(14, 3, 34)[0], g(14, 3, 34)[1], 10, K.kRood, K.kRoodL],
    [g(2, 2, 50)[0], g(2, 2, 50)[1], g(6, 1, 44)[0], g(6, 1, 44)[1], 6, K.kGeel, K.kGeelL],
    [g(4, 16, 28)[0], g(4, 16, 28)[1], g(13, 16, 28)[0], g(13, 16, 28)[1], 7, K.k0, K.k1],
    [g(16, 16, 28)[0], g(16, 16, 28)[1], g(16, 16, 3)[0] + 3, g(16, 16, 3)[1], 3, K.kBlauw, K.kBlauwL],
    [g(16, 8, 28)[0], g(16, 8, 28)[1], g(16, 14, 28)[0], g(16, 14, 28)[1], 7, K.kRood, K.kRoodL],
    [g(7, 16, 4)[0], g(7, 16, 4)[1], g(2, 19, 0)[0], g(2, 19, 0)[1], 2, K.k0, K.k1],
    [g(9, 16, 6)[0], g(9, 16, 6)[1], g(8, 19, 0)[0], g(8, 19, 0)[1], 2, K.kGeel, K.kGeelL],
  ]);
  d.neonKabel(g(1, 16, 26)[0], g(1, 16, 26)[1], g(9, 16, 26)[0], g(9, 16, 26)[1], 6, N.gif);
  d.neon(...g(2, 2, 63), N.rood, 2);
  d.neon(...g(6, 1, 53), N.rood, 2);
  d.neon(...g(16, 16, 3), N.gif, 1);
  d.neon(...g(12, 16, 4), N.cyaan, 1);
  bewaar('fabriek', d, ax, ay, 2);
}

// ---------------------------------------------------------------------------
// PERS (1 tegel): hydraulische pers die schroot tot platen slaat.
function tekenPers() {
  const d = new Doek(48, 72);
  const r = ruis(31);
  const ax = 24, ay = 54;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });
  const zuil = (k, rr) => { const p = g(k, rr, 6); d.cilinder(p[0], p[1], 2, 34, T.staal, { r }); };
  zuil(0.5, 0.5);
  const voet = B(0, 0, 0, 8, 8, 6, T.staal);
  gevaar(d, [voet.P3[0], voet.P3[1] - 2], 8, 2, 'kol');
  gevaar(d, [voet.P1[0] - 1, voet.P1[1] - 2], 8, 2, 'rij');
  zuil(0.5, 0.5);
  B(2, 2, 6, 4, 4, 2, T.roest); // plaat schroot
  zuil(7.5, 0.5);
  zuil(0.5, 7.5);
  const top = B(0, 0, 40, 8, 8, 8, T.bruin);
  nagels(d, [top.P3[0], top.P3[1] - 2], 8, 2, 'kol', r);
  const c = g(4, 4, 22);
  d.cilinder(c[0], c[1], 4, 18, T.staal, { r });
  B(1, 1, 12, 6, 6, 3, T.staal);
  zuil(7.5, 7.5);
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.4, r);
  d.veeg(c[0], c[1] - 4, 8, K.olie);
  kabels(d, [
    [top.P1[0], top.P1[1] - 6, voet.P1[0] + 2, voet.P1[1] - 4, 6, K.k0, K.k1],
    [top.P3[0], top.P3[1] - 4, voet.P3[0] - 2, voet.P3[1] - 2, 5, K.kRood, K.kRoodL],
    [g(4, 0, 48)[0], g(4, 0, 48)[1], top.P3[0] - 3, top.P3[1] + 6, 8, K.kGeel, K.kGeelL],
    [voet.P2[0] - 2, voet.P2[1] - 2, voet.P2[0] + 8, voet.P2[1] + 3, 2, K.k0, K.k1],
  ]);
  d.neon(...g(0, 0, 50), N.natrium, 2);
  d.neon(top.P2[0], top.P2[1] - 4, N.gif, 1);
  d.neon(...g(4, 8, 44), N.rood, 1);
  d.neon(...g(8, 4, 3), N.cyaan, 1);
  bewaar('pers', d, ax, ay, 1);
}

// ---------------------------------------------------------------------------
// DYNAMO (1 tegel): koperen spoel rond een gloeiende kern.
function tekenDynamo() {
  const d = new Doek(48, 76);
  const r = ruis(41);
  const ax = 24, ay = 58;
  const g = isoPunt(ax, ay);
  const voet = d.blokS(...g(0, 0, 0), 8, 8, 5, T.bruin, { r });
  nagels(d, [voet.P3[0], voet.P3[1] - 2], 8, 2, 'kol', r);
  const c = g(4, 4, 5);
  d.cilinder(c[0], c[1], 8, 30, T.messing, { r });
  for (let i = 0; i < 30; i += 3)
    for (let x = -8; x < 8; x++)
      d.meng(c[0] + x, c[1] - i + Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5) / 8) ** 2)) * 4), K.olie, 0.35);
  d.cilinder(c[0], c[1] - 30, 6, 3, T.staal, { r });
  d.cilinder(c[0], c[1] - 33, 2, 8, T.staal, { r });
  d.omlijn(K.lijn);
  d.vuil(0.05, K.olie, 0.4, r);
  for (let j = 2; j < 29; j++) { d.licht(c[0] - 4, c[1] - j + 3, N.cyaan); d.licht(c[0] + 3, c[1] - j + 3, N.cyaan); }
  d.neon(c[0], c[1] - 43, N.cyaan, 2);
  kabels(d, [
    [c[0] - 6, c[1] - 30, voet.P3[0] - 2, voet.P3[1] + 1, 5, K.k0, K.k1],
    [c[0] + 6, c[1] - 30, voet.P1[0] + 2, voet.P1[1] + 1, 5, K.kRood, K.kRoodL],
    [c[0] + 3, c[1] - 26, voet.P2[0] + 4, voet.P2[1] + 2, 9, K.kGeel, K.kGeelL],
    [c[0] - 3, c[1] - 26, voet.P2[0] - 6, voet.P2[1] + 2, 9, K.kBlauw, K.kBlauwL],
  ]);
  d.neon(voet.P2[0], voet.P2[1] - 3, N.gif, 1);
  d.neon(...g(8, 3, 3), N.natrium, 1);
  bewaar('dynamo', d, ax, ay, 1);
}

// ---------------------------------------------------------------------------
// LOOPBAND (1 tegel, langs kol): spiegelen in het spel geeft de rij-richting.
function tekenBand() {
  const d = new Doek(40, 30);
  const r = ruis(51);
  const ax = 22, ay = 13;
  const g = isoPunt(ax, ay);
  const b = d.blokS(...g(0, 2, 0), 8, 4, 5, T.staal, { r });
  for (let s = 0; s < 8; s++) streep(d, g(s, 2, 5), 4, 'rij', s % 2 ? T.rubber[1] : T.rubber[3]);
  gevaar(d, [b.P3[0], b.P3[1] - 1], 8, 2, 'kol');
  d.blokS(...g(1.5, 3, 5), 2, 2, 4, T.bruin, { r });
  d.blokS(...g(5, 3, 5), 2, 2, 2, T.roest, { r });
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.4, r);
  d.kabel(b.P3[0] + 4, b.P3[1] - 1, b.P3[0] + 12, b.P3[1] + 4, 3, K.k0, K.k1);
  d.neon(b.P1[0] - 2, b.P1[1] - 4, N.gif, 1);
  bewaar('band', d, ax, ay, 1);
}

// ---------------------------------------------------------------------------
// KABELMAST: houten paal met dwarsarm en isolatoren. Kabels tussen masten zijn een losse sprite.
function tekenMast() {
  const d = new Doek(28, 60);
  const r = ruis(61);
  const ax = 14, ay = 44;
  const g = isoPunt(ax, ay);
  d.blokS(...g(3, 3, 0), 2, 2, 3, T.beton, { r });
  const paal = d.blokS(...g(3.5, 3.5, 0), 1, 1, 45, T.bruin, { r, ruis: 0.25 });
  d.blokS(...g(1, 4, 36), 6, 1, 2, T.staal, { r });
  d.blokS(...g(4, 1, 33), 1, 6, 2, T.staal, { r });
  d.omlijn(K.lijn);
  d.kabel(ax - 7, ay - 29, ax - 9, ay - 12, 2, K.k0, K.k1);
  d.kabel(ax + 4, ay - 26, ax - 1, ay + 2, 4, K.kRood, K.kRoodL);
  d.kabel(ax + 2, ay - 22, ax + 5, ay + 6, 3, K.kGeel, K.kGeelL);
  for (const p of [[ax - 7, ay - 30], [ax + 8, ay - 30]]) d.neon(p[0], p[1], N.cyaan, 1);
  d.neon(paal.P0[0], paal.P0[1] - 46, N.rood, 2);
  bewaar('mast', d, ax, ay, 1);
}

// KABELS: bundel kabels over twee tegels langs kol (van mast tot mast). Spiegel voor rij.
function tekenKabels() {
  const d = new Doek(36, 30);
  const ax = 2, ay = 6;
  d.kabel(ax, ay + 4, ax + 32, ay + 20, 9, K.k0, K.k1);
  d.kabel(ax, ay + 2, ax + 32, ay + 18, 6, K.kRood, K.kRoodL);
  d.kabel(ax + 1, ay + 6, ax + 31, ay + 22, 12, K.kGeel, K.kGeelL);
  d.neonKabel(ax + 1, ay + 3, ax + 31, ay + 19, 4, N.cyaan);
  bewaar('kabels', d, ax + 7, ay + 4 + 41 - 8, 2);
}

tekenMuis('muis', 'gewoon');
tekenMuis('muis-monteur', 'monteur');
tekenMech();
tekenSjouwbot();
tekenFabriek();
tekenPers();
tekenDynamo();
tekenBand();
tekenMast();
tekenKabels();

const regels = Object.entries(ankers).map(
  ([n, a]) =>
    `  '${n}': { w: ${a.w}, h: ${a.h}, ankerX: ${a.ankerX}, ankerY: ${a.ankerY}, tegels: ${a.tegels}, gloed: ${a.gloed} },`,
);
writeFileSync(
  join(wortel, 'src', 'muizen', 'sprites.ts'),
  `// Gegenereerd door scripts/pixel/muizen.mjs. Niet met de hand aanpassen.\n` +
    `// anker = pixel in de sprite die op de achterhoek van de tegel valt (voor muizen: de voeten).\n` +
    `// gloed = er is een <naam>-gloed.png met alleen de neonpixels, voor de gloedlaag.\n` +
    `export const MUIZEN_SPRITES = {\n${regels.join('\n')}\n} as const;\n\n` +
    `export type MuizenSprite = keyof typeof MUIZEN_SPRITES;\n`,
);
console.log('getekend:', Object.keys(ankers).join(', '));
