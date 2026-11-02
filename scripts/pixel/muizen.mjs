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
// MECH "Grootbek": 3x3 tegels, menselijke bouw, ruim tien keer zo hoog als een muis.
// De piloot is een gewone muis (zelfde pixelmaat) in een raampje in de borst.
// Rechts een gatling met munitietrommel, links een houwitser met mondingsrem, op de schouders een railgun en een raketbak.
function tekenMech() {
  const d = new Doek(252, 244);
  const r = ruis(11);
  const ax = 118, ay = 186;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });

  // --- rug: generator en uitlaten ---
  const rug = B(5, 5, 118, 10, 10, 42, T.bruin);
  for (const [k, rr, rad, h] of [[7.5, 7.5, 5, 34], [12, 6.5, 4, 26], [6.5, 12, 3, 20]]) {
    const p = g(k, rr, 160);
    d.cilinder(p[0], p[1], rad, h, T.roest, { r, open: true });
    for (let j = 0; j < 6; j++) d.meng(p[0] - rad + Math.floor(r() * rad * 2), p[1] - h - 2 + Math.floor(r() * 5), K.roet, 0.8);
  }

  // --- benen ---
  const been = (kc, rc) => {
    B(kc - 5, rc - 4, 0, 10, 8, 7, T.staal); // voet
    B(kc + 5, rc - 3, 0, 4, 6, 5, T.staal); // neus van de voet
    B(kc - 4, rc + 4, 0, 6, 2, 5, T.staal);
    d.bol(...g(kc, rc, 10), 6, T.staal);
    const sch = B(kc - 3, rc - 3, 12, 6, 6, 40, T.olijf);
    gevaar(d, [sch.P3[0], sch.P3[1] - 4], 6, 2, 'kol');
    nagels(d, [sch.P3[0], sch.P3[1] - 36], 6, 2, 'kol', r);
    const z = g(kc + 3.6, rc + 3.6, 14);
    d.cilinder(z[0], z[1], 3, 34, T.chroom, { r });
    d.veeg(z[0] - 2, z[1] - 20, 16, K.olie);
    B(kc - 2, rc + 3, 36, 5, 2, 18, T.olijf); // kniebeschermer
    d.bol(...g(kc, rc, 56), 8, T.staal);
    const dij = B(kc - 3, rc - 3, 62, 6, 6, 28, T.staal);
    B(kc - 3, rc + 3, 64, 6, 1, 24, T.olijf);
    B(kc + 3, rc - 3, 64, 1, 6, 24, T.olijf);
    return dij;
  };
  been(16, 8);
  const linkerdij = been(8, 16);
  tekst(d, [g(5, 20, 82)[0] + 2, g(5, 20, 82)[1]], 'M-07', 'kol', K.verf, r, 0.3);

  // --- bekken, heupen, taille ---
  B(7, 7, 88, 10, 10, 16, T.staal);
  d.bol(...g(16.5, 8.5, 96), 8, T.staal);
  d.bol(...g(8.5, 16.5, 96), 8, T.staal);
  const t = g(12, 12, 104);
  d.cilinder(t[0], t[1], 12, 10, T.staal, { r });

  // --- borst met cockpit ---
  const borst = B(5, 5, 112, 14, 14, 44, T.olijf);
  const plL = B(5, 19, 116, 14, 1, 36, T.olijf);
  const plR = B(19, 5, 116, 1, 14, 36, T.olijf);
  nagels(d, [plL.P3[0], plL.P3[1] - 34], 14, 2, 'kol', r);
  nagels(d, [plR.P1[0] - 1, plR.P1[1] - 34], 14, 2, 'rij', r);
  for (let i = 0; i < 5; i++) streep(d, [plR.P1[0] - 5, plR.P1[1] - 10 - i * 4], 9, 'rij', T.staal[0]); // roosters
  // cockpitraam met piloot (een gewone muis, dus piepklein)
  const raam = g(8, 20, 126);
  for (let s = 0; s < 8; s++) for (let j = 0; j < 12; j++) {
    d.zet(raam[0] + 2 * s, raam[1] + s - j, T.glas[1 + (j > 9 ? 1 : 0)]);
    d.zet(raam[0] + 2 * s + 1, raam[1] + s - j, T.glas[1 + (j > 9 ? 1 : 0)]);
  }
  const px = raam[0] + 7, py = raam[1] - 1;
  d.rect(px, py - 3, 4, 3, T.vacht[4]); d.rect(px + 1, py - 3, 2, 1, T.vacht[5]);
  d.zet(px, py - 5, T.vacht[3]); d.zet(px, py - 4, T.vacht[3]); d.zet(px + 3, py - 5, T.vacht[3]); d.zet(px + 3, py - 4, T.vacht[3]);
  d.zet(px + 4, py - 2, K.neus);
  B(8, 8, 156, 8, 8, 6, T.staal); // kraag

  // --- hoofd: klein en gemeen, met vizier ---
  const hoofd = B(10, 10, 162, 5, 5, 12, T.staal);
  B(11, 11, 174, 3, 3, 2, T.staal);

  // --- bovenarmen en schouderstukken ---
  B(20, 4, 100, 5, 5, 34, T.staal);
  B(4, 20, 100, 5, 5, 34, T.staal);
  const schR = B(18, 2, 134, 9, 9, 24, T.olijf);
  B(18.5, 2.5, 158, 8, 8, 5, T.olijf);
  const schL = B(2, 18, 134, 9, 9, 24, T.olijf);
  B(2.5, 18.5, 158, 8, 8, 5, T.olijf);
  gevaar(d, [schR.P1[0] - 1, schR.P1[1] - 3], 9, 3, 'rij');
  gevaar(d, [schL.P3[0], schL.P3[1] - 3], 9, 3, 'kol');

  // --- railgun op de rechterschouder ---
  B(18, 3, 163, 8, 6, 9, T.staal);
  const rg = g(26, 6, 168);
  d.buis(rg[0], rg[1], 30, 'kol', 4, T.staal, { loop: true, ringen: 4 });
  // --- raketbak op de linkerschouder ---
  const bak = B(3, 18, 163, 7, 8, 18, T.olijf);
  const gaten = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const p = g(4.5 + i * 2, 26, 166 + j * 5);
    d.rect(p[0], p[1] - 2, 2, 3, K.k0);
    gaten.push([p[0] + 1, p[1] - 1]);
  }

  // --- rechteronderarm: gatling met trommel ---
  d.bol(...g(22.5, 6.5, 100), 7, T.staal);
  const gat = B(19, 1, 76, 12, 10, 24, T.staal);
  gevaar(d, [gat.P1[0] - 1, gat.P1[1] - 3], 9, 2, 'rij');
  for (const [rr, z] of [[3.5, 94], [7, 96], [5, 90], [8.5, 90], [3, 86], [6.5, 84]]) {
    const p = g(31, rr, z);
    d.buis(p[0], p[1], 32, 'kol', 3, T.staal, { loop: true, ringen: 8 });
  }
  const p1 = g(29, 2.5, 82), p2 = g(29, 9, 82);
  B(50, 2, 80, 3, 8, 18, T.staal); // ring om de lopen
  const trom = g(24, 6, 100);
  d.cilinder(trom[0], trom[1], 13, 16, T.messing, { r });

  // --- linkeronderarm: houwitser met mondingsrem ---
  d.bol(...g(6.5, 22.5, 100), 7, T.staal);
  const hou = B(1, 19, 74, 11, 10, 26, T.staal);
  gevaar(d, [hou.P3[0], hou.P3[1] - 3], 9, 2, 'kol');
  const lp = g(6.5, 29, 87);
  d.buis(lp[0], lp[1], 22, 'rij', 10, T.staal, { ringen: 6 });
  const rem = B(0.5, 50, 72, 12, 6, 30, T.staal);
  const mond = g(6.5, 56, 87);
  for (let dy = -9; dy <= 9; dy++) for (let dx = -6; dx <= 6; dx++)
    if ((dx * dx) / 36 + (dy * dy) / 81 <= 1) d.zet(mond[0] + dx, mond[1] + dy, dx * dx / 36 + dy * dy / 81 > 0.5 ? T.staal[2] : K.k0);

  d.omlijn(K.lijn);
  d.vuil(0.05, K.olie, 0.45, r);
  for (let i = 0; i < 18; i++) {
    const p = r() < 0.5 ? g(5 + r() * 14, 20, 118 + r() * 30) : g(20, 5 + r() * 14, 118 + r() * 30);
    d.veeg(p[0], p[1], 3 + Math.floor(r() * 8), r() < 0.6 ? T.roest[3] : K.olie);
  }

  // --- kabels en slangen, heel veel ---
  const P = (k, rr, z) => g(k, rr, z);
  const lijst = [
    [P(15, 5, 150), P(26, 6, 160), 10, T.messing[3], T.messing[5]], // munitie naar railgun
    [P(13, 5, 130), P(23, 5, 110), 14, T.messing[3], T.messing[5]], // munitieband naar trommel
    [P(19, 9, 118), P(21, 9, 96), 8, K.k0, K.k1],
    [P(19, 12, 120), P(16, 10, 70), 14, K.kRood, K.kRoodL],
    [P(19, 15, 118), P(9, 19, 70), 16, K.kGeel, K.kGeelL],
    [P(15, 19, 118), P(8, 19, 60), 12, K.k0, K.k1],
    [P(9, 19, 120), P(6, 24, 98), 10, K.kBlauw, K.kBlauwL],
    [P(5, 15, 130), P(4, 24, 100), 12, K.k0, K.k1],
    [P(12, 19, 116), P(13, 13, 96), 8, K.kRood, K.kRoodL],
    [P(17, 8, 100), P(17, 10, 50), 10, K.k0, K.k1],
    [P(8, 17, 100), P(10, 17, 50), 10, K.kRood, K.kRoodL],
    [P(16, 9, 60), P(19, 11, 14), 8, K.kGeel, K.kGeelL],
    [P(9, 16, 60), P(11, 19, 14), 8, K.k0, K.k1],
    [P(12, 10, 172), P(19, 3, 166), 6, K.k0, K.k1],
    [P(10, 12, 172), P(3, 19, 166), 6, K.kRood, K.kRoodL],
    [P(30, 4, 98), P(44, 4, 102), 6, K.k0, K.k1],
    [P(5, 29, 100), P(6, 44, 104), 6, K.kGeel, K.kGeelL],
    [P(5, 6, 150), P(-4, 8, 0), 30, K.k0, K.k1], // sleepkabels
    [P(6, 5, 140), P(2, -2, 0), 26, K.kRood, K.kRoodL],
  ];
  for (const [a, b, z, k, gl] of lijst) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);

  // --- neon ---
  d.neonLijn(isoPixels(g(10, 15, 168), 5, 'kol'), N.rood); // vizier
  d.neonLijn(isoPixels(g(15, 15, 168), 5, 'rij').map(([x, y]) => [x - 1, y - 0]), N.rood);
  d.neonLijn(isoPixels(raam, 8, 'kol').map(([x, y]) => [x, y - 12]), N.cyaan); // raamlijst
  d.neonLijn(isoPixels(raam, 8, 'kol').map(([x, y]) => [x, y + 1]), N.cyaan);
  d.licht(px + 1, py - 3, N.gif); d.licht(px + 3, py - 3, N.gif);
  d.neonLijn(isoPixels(g(26, 6, 173), 30, 'kol'), N.cyaan); // railgun-rails
  d.neonLijn(isoPixels(g(26, 6, 163), 30, 'kol').map(([x, y]) => [x, y + 1]), N.cyaan);
  for (const [x, y] of gaten) d.neon(x, y, N.rood, 1);
  for (let i = 0; i < 5; i++) d.neon(...g(20, 6 + i * 2, 146), [N.gif, N.natrium, N.rood, N.gif, N.cyaan][i], 1);
  d.neon(...g(13, 20, 148), N.natrium, 1);
  d.neon(...g(7, 20, 148), N.gif, 1);
  d.neonKabel(...P(8, 19, 114), ...P(19, 8, 114), 14, N.gif);
  d.neonKabel(...P(19, 2, 98), ...P(28, 4, 98), 6, N.natrium);
  for (const [x, y] of [[mond[0], mond[1]]]) { d.licht(x, y, N.natrium); d.licht(x + 1, y, N.natrium); d.licht(x, y + 1, N.rood); }
  for (const [rr, z] of [[3.5, 94], [7, 96], [5, 90], [8.5, 90], [3, 86], [6.5, 84]]) {
    const p = g(31 + 32, rr, z);
    d.licht(p[0] + 1, p[1], N.natrium);
  }
  d.neon(...g(12.5, 12.5, 178), N.rood, 2); // baken op het hoofd
  d.neon(...g(4, 19, 70), N.gif, 1);
  d.neon(...g(19, 4, 70), N.gif, 1);
  void p1; void p2; void hoofd; void borst; void rug; void linkerdij; void rem; void bak; void t;
  bewaar('mech', d, ax, ay, 3);
}

// ---------------------------------------------------------------------------
// BOORTOREN (2x2 tegels): boort grondstoffen uit de dimensie. Toren, boorstang, motor, hopen gruis.
function tekenBoor() {
  const d = new Doek(88, 152);
  const r = ruis(71);
  const ax = 44, ay = 112;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });
  const poot = (k, rr) => B(k, rr, 6, 1, 1, 94, T.staal, { ruis: 0.2 });
  const vloer = B(0, 0, 0, 16, 16, 6, T.staal);
  gevaar(d, [vloer.P3[0], vloer.P3[1] - 2], 16, 2, 'kol');
  gevaar(d, [vloer.P1[0] - 1, vloer.P1[1] - 2], 16, 2, 'rij');
  poot(2, 2);
  const motor = B(1, 4, 6, 5, 7, 20, T.bruin);
  const ux = g(3, 6, 26);
  d.cilinder(ux[0], ux[1], 2, 16, T.roest, { r, open: true });
  poot(13, 2);
  poot(2, 13);
  const stang = g(8, 8, 6);
  d.cilinder(stang[0], stang[1], 3, 84, T.chroom, { r });
  B(6, 6, 40, 4, 4, 12, T.messing); // boorkop
  B(6.5, 6.5, 70, 3, 3, 8, T.staal); // klem
  poot(13, 13);
  // schoren tussen de poten
  for (const [a, b] of [[[13, 13], [2, 13]], [[13, 13], [13, 2]]])
    for (let z = 10; z < 90; z += 22) {
      const p = g(a[0] + 0.5, a[1] + 0.5, z), q = g(b[0] + 0.5, b[1] + 0.5, z + 20);
      d.lijn(p[0], p[1], q[0], q[1], T.staal[4]);
      const p2 = g(a[0] + 0.5, a[1] + 0.5, z + 20), q2 = g(b[0] + 0.5, b[1] + 0.5, z);
      d.lijn(p2[0], p2[1], q2[0], q2[1], T.staal[2]);
    }
  const kroon = B(1, 1, 100, 14, 14, 6, T.olijf);
  d.bol(...g(8, 8, 112), 6, T.staal);
  // gruis op de vloer
  for (let i = 0; i < 14; i++) {
    const p = g(9 + r() * 6, 9 + r() * 6, 6);
    d.zet(p[0], p[1], T.roest[2 + Math.floor(r() * 3)]); d.zet(p[0] + 1, p[1], T.roest[2]);
  }
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.4, r);
  const P = (k, rr, z) => g(k, rr, z);
  for (const [a, b, z, k, gl] of [
    [P(4, 11, 24), P(8, 8, 62), 8, K.k0, K.k1],
    [P(6, 8, 20), P(8, 8, 46), 6, K.kRood, K.kRoodL],
    [P(1, 1, 100), P(1, 4, 26), 12, K.kGeel, K.kGeelL],
    [P(15, 15, 100), P(16, 16, 6), 10, K.k0, K.k1],
    [P(15, 1, 100), P(13, 8, 6), 16, K.kRood, K.kRoodL],
    [P(1, 15, 100), P(6, 16, 6), 16, K.kBlauw, K.kBlauwL],
    [P(4, 11, 10), P(-2, 16, 0), 4, K.k0, K.k1],
  ]) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);
  d.neonKabel(...P(1, 15, 104), ...P(15, 15, 104), 8, N.gif);
  for (const p of [P(1, 1, 108), P(15, 1, 108), P(1, 15, 108), P(15, 15, 108)]) d.neon(p[0], p[1], N.rood, 2);
  d.neon(...P(5, 11, 22), N.natrium, 1);
  d.neon(...P(16, 8, 3), N.cyaan, 1);
  for (let j = 0; j < 8; j++) d.licht(stang[0] - 1, stang[1] - 54 - j, N.cyaan); // signaal in de stang
  void motor; void kroon;
  bewaar('boor', d, ax, ay, 2);
}

// ---------------------------------------------------------------------------
// Grote machines: alle maten x F, muizen erop blijven op ware grootte.
const F = 2;
function schaal(g0) { return (k, rr, z = 0) => g0(k * F, rr * F, z * F); }

// PERS (2x2 tegels): hydraulische pers die schroot tot platen slaat.
function tekenPers() {
  const d = new Doek(96, 148);
  const r = ruis(31);
  const ax = 48, ay = 110;
  const g = schaal(isoPunt(ax, ay));
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u * F, v * F, h * F, ramp, { r, ...o });
  const zuil = (k, rr) => { const p = g(k, rr, 6); d.cilinder(p[0], p[1], 4, 34 * F, T.staal, { r }); };
  zuil(0.5, 0.5);
  const voet = B(0, 0, 0, 8, 8, 6, T.staal);
  gevaar(d, [voet.P3[0], voet.P3[1] - 3], 16, 3, 'kol');
  gevaar(d, [voet.P1[0] - 1, voet.P1[1] - 3], 16, 3, 'rij');
  B(2, 2, 6, 4, 4, 2, T.roest);
  zuil(7.5, 0.5);
  zuil(0.5, 7.5);
  const top = B(0, 0, 40, 8, 8, 8, T.bruin);
  nagels(d, [top.P3[0], top.P3[1] - 3], 16, 2, 'kol', r);
  nagels(d, [top.P3[0], top.P3[1] - 13], 16, 2, 'kol', r);
  const c = g(4, 4, 22);
  d.cilinder(c[0], c[1], 9, 36, T.staal, { r });
  B(1, 1, 12, 6, 6, 3, T.staal);
  zuil(7.5, 7.5);
  // bedieningshokje met een muis erin (ware grootte)
  const hok = g(8.5, 5, 6);
  d.blokS(hok[0], hok[1], 4, 6, 12, T.olijf, { r });
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.4, r);
  d.veeg(c[0], c[1] - 8, 16, K.olie);
  const mu = [hok[0] - 4, hok[1] - 2];
  d.rect(mu[0], mu[1] - 3, 3, 3, T.vacht[4]); d.zet(mu[0], mu[1] - 4, T.vacht[3]); d.zet(mu[0] + 2, mu[1] - 4, T.vacht[3]);
  for (const [a, b, z, k, gl] of [
    [g(8, 0, 44), g(8.5, 1, 4), 12, K.k0, K.k1],
    [g(0, 8, 44), g(0, 9, 3), 10, K.kRood, K.kRoodL],
    [g(4, 0, 48), g(0, 6, 46), 16, K.kGeel, K.kGeelL],
    [g(8, 8, 4), g(10, 9, 0), 4, K.k0, K.k1],
    [g(8, 4, 44), g(9.5, 5, 18), 10, K.kBlauw, K.kBlauwL],
  ]) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);
  d.neon(...g(0, 0, 50), N.natrium, 2);
  d.neon(top.P2[0], top.P2[1] - 6, N.gif, 2);
  d.neon(...g(4, 8, 44), N.rood, 2);
  d.licht(mu[0] + 1, mu[1] - 3, N.gif);
  d.neonLijn(isoPixels(g(1, 8, 2), 12, 'kol'), N.natrium);
  bewaar('pers', d, ax, ay, 2);
}

// DYNAMO (2x2 tegels): koperen spoel rond een gloeiende kern.
function tekenDynamo() {
  const d = new Doek(96, 156);
  const r = ruis(41);
  const ax = 48, ay = 118;
  const g = schaal(isoPunt(ax, ay));
  const voet = d.blokS(...g(0, 0, 0), 16, 16, 10, T.bruin, { r });
  nagels(d, [voet.P3[0], voet.P3[1] - 4], 16, 2, 'kol', r);
  const c = g(4, 4, 5);
  d.cilinder(c[0], c[1], 16, 60, T.messing, { r });
  for (let i = 0; i < 60; i += 4)
    for (let x = -16; x < 16; x++)
      d.meng(c[0] + x, c[1] - i + Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5) / 16) ** 2)) * 8), K.olie, 0.4);
  d.cilinder(c[0], c[1] - 60, 12, 6, T.staal, { r });
  d.cilinder(c[0], c[1] - 66, 4, 16, T.staal, { r });
  d.bol(c[0], c[1] - 86, 5, T.staal);
  d.omlijn(K.lijn);
  d.vuil(0.05, K.olie, 0.4, r);
  for (const dx of [-9, -2, 6]) for (let j = 4; j < 58; j++) d.licht(c[0] + dx, c[1] - j + 6, N.cyaan);
  d.neon(c[0], c[1] - 88, N.cyaan, 2);
  for (const [a, b, z, k, gl] of [
    [[c[0] - 12, c[1] - 60], [voet.P3[0] - 2, voet.P3[1] + 1], 10, K.k0, K.k1],
    [[c[0] + 12, c[1] - 60], [voet.P1[0] + 2, voet.P1[1] + 1], 10, K.kRood, K.kRoodL],
    [[c[0] + 6, c[1] - 52], [voet.P2[0] + 8, voet.P2[1] + 3], 18, K.kGeel, K.kGeelL],
    [[c[0] - 6, c[1] - 52], [voet.P2[0] - 12, voet.P2[1] + 3], 18, K.kBlauw, K.kBlauwL],
    [[c[0] - 2, c[1] - 84], [c[0] - 14, c[1] - 62], 6, K.k0, K.k1],
  ]) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);
  d.neon(voet.P2[0], voet.P2[1] - 5, N.gif, 2);
  d.neon(...g(8, 3, 3), N.natrium, 1);
  bewaar('dynamo', d, ax, ay, 2);
}

// SJOUWBOT (2x2 tegels): rupsbanden, gasfles, kraan met een hangende kist, muis (ware grootte) op een open stoeltje.
function tekenSjouwbot() {
  const d = new Doek(128, 144);
  const r = ruis(21);
  const ax = 52, ay = 100;
  const g = schaal(isoPunt(ax, ay));
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u * F, v * F, h * F, ramp, { r, ...o });
  const m = g(2, 2, 18);
  d.cilinder(m[0], m[1], 4, 40, T.staal, { r });
  for (const rr of [0.5, 5]) {
    const b = B(0, rr, 0, 9, 2.5, 6, T.rubber);
    for (let s = 0; s < 18; s++) {
      const p = [b.P3[0] + 2 * s, b.P3[1] + s];
      d.lijn(p[0], p[1] - 1, p[0], p[1] - 10, T.rubber[0]);
    }
  }
  B(0.5, 1, 6, 8, 6, 5, T.bruin);
  const kast = B(0.5, 1.5, 11, 4, 5, 11, T.olijf);
  gevaar(d, [kast.P3[0], kast.P3[1] - 2], 8, 3, 'kol');
  nagels(d, [kast.P1[0] - 1, kast.P1[1] - 18], 10, 2, 'rij', r);
  const fl = g(6.5, 2.2, 11);
  d.cilinder(fl[0], fl[1], 6, 24, T.roest, { r });
  B(5.5, 4.5, 11, 2, 2, 1, T.bruin);
  const gk = g(2, 2, 38);
  d.buis(gk[0], gk[1], 22, 'kol', 2, T.staal, { ringen: 4 });
  const eind = g(12.5, 2, 37);
  d.lijn(eind[0], eind[1], eind[0], eind[1] + 26, K.k1);
  const kist = B(11.5, 1, 18, 2, 2, 6, T.bruin);
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.45, r);
  // muis op het stoeltje: ware grootte
  const mu = g(6.5, 5.5, 13);
  d.rect(mu[0] - 2, mu[1] - 5, 5, 5, T.vacht[4]); d.rect(mu[0] - 1, mu[1] - 5, 3, 1, T.vacht[5]);
  d.zet(mu[0] - 2, mu[1] - 7, T.vacht[3]); d.zet(mu[0] - 2, mu[1] - 6, T.vacht[3]);
  d.zet(mu[0] + 2, mu[1] - 7, T.vacht[3]); d.zet(mu[0] + 2, mu[1] - 6, T.vacht[3]);
  for (const [a, b, z, k, gl] of [
    [[kast.P0[0] - 2, kast.P0[1] - 20], [m[0], m[1] - 24], 6, K.k0, K.k1],
    [[kast.P1[0] - 2, kast.P1[1] - 12], [fl[0] + 6, fl[1] - 8], 8, K.kRood, K.kRoodL],
    [[fl[0] - 4, fl[1] - 20], [kast.P2[0] + 4, kast.P2[1] - 18], 10, K.kGeel, K.kGeelL],
    [[kast.P3[0] + 4, kast.P3[1] - 8], g(0, 8, 2), 8, K.k0, K.k1],
    [[m[0], m[1] - 40], [gk[0] + 20, gk[1] + 10], 6, K.kBlauw, K.kBlauwL],
  ]) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);
  d.neon(m[0], m[1] - 44, N.natrium, 2);
  d.neon(...g(4.5, 6.5, 18), N.gif, 2);
  d.neon(...g(4.5, 4, 14), N.rood, 1);
  d.licht(mu[0] - 1, mu[1] - 4, N.gif); d.licht(mu[0] + 1, mu[1] - 4, N.gif);
  d.neon(kist.P2[0], kist.P2[1] - 6, N.cyaan, 1);
  bewaar('sjouwbot', d, ax, ay, 2);
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
tekenBoor();
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
