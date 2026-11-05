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
  vacht: ['#3a3029', '#5e5047', '#857467', '#a99886', '#c8b9a6', '#e0d3c1', '#f2e9dc'], // licht en warm: schattig
};
const K = {
  lijn: '#060505',
  k0: '#0a0a0b', k1: '#1b1c1e', kRood: '#3a1312', kRoodL: '#521e1b', kGeel: '#3f3510', kGeelL: '#5a4c1c',
  kBlauw: '#141f2e', kBlauwL: '#213247',
  gevaar: '#7a6418', verf: '#7c7a6a', olie: '#030303', roet: '#000000', neus: '#d98b98', oorBinnen: '#c97f8c',
  wang: '#e3a2a8', oog: '#0d0a0a',
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
// MUIS: piepklein en simpel, net als de piloten in de voertuigen. Kopje van 4x3, twee oortjes,
// neonbrilletje (gloeit groen), roze neusje, lijfje, pootjes en een staartje. Kijkt naar rechts.
const MUIS_KAART = [
  'oo.oo.',
  'op.po.',
  '.LgLg.',
  '.LhhLn',
  '.LLLL.',
  '.mLLm.',
  '.mLLmt',
  '..p.p.',
];
function tekenMuis(naam, variant) {
  const d = new Doek(11, 10);
  const v = T.vacht;
  const kleur = { o: v[3], L: v[4], h: v[5], m: v[3], n: K.neus, t: K.neus, p: K.oorBinnen ?? K.neus, g: v[4] };
  const ox = 1, oy = 1;
  MUIS_KAART.forEach((regel, y) => [...regel].forEach((c, x) => { if (c !== '.') d.zet(ox + x, oy + y, kleur[c]); }));
  if (variant === 'monteur') {
    // te grote moersleutel
    d.lijn(ox + 5, oy + 6, ox + 8, oy + 3, T.staal[6]);
    d.zet(ox + 9, oy + 2, T.staal[5]); d.zet(ox + 8, oy + 2, T.staal[5]);
  }
  // met lading: een bundeltje op de rug (links, want de muis kijkt naar rechts)
  const lading = {
    schroot: [T.staal[5], T.staal[3], T.roest[4], T.staal[6]],
    hout: [T.bruin[6], T.bruin[4], T.bruin[3], T.bruin[7]],
    kristal: [T.glas[4], T.glas[3], T.glas[5], T.glas[5]],
  }[variant];
  if (lading) {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) d.zet(ox - 1 + i, oy + 3 + j, lading[(i + j) % 3]);
    d.zet(ox, oy + 2, lading[3]);
    if (variant === 'kristal') d.licht(ox - 1, oy + 3, N.magenta);
  }
  // geen buitenlijn: net als de piloten, simpel en zacht
  d.licht(ox + 2, oy + 2, N.gif);
  d.licht(ox + 4, oy + 2, N.gif);
  bewaar(naam, d, ox + 3, oy + 7, 0);
}


// Muis uit MUIS_KAART in een voertuig zetten, zonder buitenlijn. (x, y) = linksboven van de kaart.
// rijen: hoeveel rijen (5 = alleen het kopje). Geeft de twee brilpixels terug (voor de gloed).
function plakMuis(d, x, y, rijen) {
  const v = T.vacht;
  const kleur = { o: v[3], L: v[4], h: v[5], m: v[3], n: K.neus, t: K.neus, p: K.oorBinnen, g: v[4] };
  MUIS_KAART.slice(0, rijen).forEach((regel, j) =>
    [...regel].forEach((c, i) => { if (c !== '.') d.zet(x + i, y + j, kleur[c]); }),
  );
  return [[x + 2, y + 2], [x + 4, y + 2]];
}
const brilLicht = (d, bril) => { for (const [x, y] of bril) d.licht(x, y, N.gif); };

// ---------------------------------------------------------------------------
// MECH "Grootbek": 3x3 tegels, een loper die kan lopen en mikken.
// Vogelpoten: heup -> knie naar voren -> enkel terug -> voet met drie tenen en een hielspoor, zuigers langs elk deel.
// Romp op een draaikrans (mikken = draaien), tegengewicht achterop, armen met ellebogen. Beide wapens mikken naar voren (+kol).
// De piloot is een gewone muis (ware grootte) achter het raam voorin.
function tekenMech() {
  const d = new Doek(170, 228);
  const r = ruis(11);
  const ax = 56, ay = 176;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });
  const S = (a, b, dik, ramp, o = {}) => d.staaf(a[0], a[1], b[0], b[1], dik, ramp, { r, ...o });

  // --- een poot (rc = rij van de poot): hoekige pantserdelen en blokvormige scharnieren ---
  const Pr = (a, b, ra, rb, ramp, o = {}) => d.prisma(a[0], a[1], b[0], b[1], ra, rb, ramp, { r, ...o });
  const poot = (rc) => {
    const H = g(11, rc, 94), Kn = g(17, rc, 58), A = g(9, rc, 22), V = g(12, rc, 5);
    // voet: platte zool, drie klauwtenen naar voren en een hielspoor
    B(9.5, rc - 2.5, 0, 6, 5, 4, T.staal);
    Pr(g(10, rc, 4), g(4, rc, 1), 3, 1, T.staal);
    Pr(g(14, rc - 1.5, 3), g(19, rc - 4, 0), 3, 1, T.staal);
    Pr(g(14, rc + 1.5, 3), g(19, rc + 4, 0), 3, 1, T.staal);
    Pr(g(15, rc, 3), g(22, rc, 0), 4, 1, T.staal);
    // middenvoet en enkelblok
    Pr(A, V, 5, 4, T.olijf, { naden: 7 });
    B(8, rc - 2, 17, 2, 4, 10, T.staal);
    // scheen (knie -> enkel) met zuiger erlangs
    S(g(16, rc + 2, 50), g(9, rc + 2, 26), 2, T.chroom);
    Pr(Kn, A, 8, 5, T.olijf, { naden: 9 });
    gevaar(d, [g(12, rc + 2.5, 36)[0] - 3, g(12, rc + 2.5, 36)[1]], 2, 2, 'kol');
    // dij (heup -> knie), breed bij de heup, met zuiger
    S(g(9, rc + 2.5, 86), g(15, rc + 2.5, 62), 2, T.chroom);
    Pr(H, Kn, 11, 7, T.olijf, { naden: 10 });
    // knieblok met beschermplaat
    B(15.5, rc - 2.5, 52, 3, 5, 12, T.staal);
    B(18, rc - 2, 50, 2, 4, 16, T.olijf);
    // heupblok
    B(9, rc - 3, 88, 4, 6, 14, T.staal);
    d.veeg(Kn[0] + 2, Kn[1] + 8, 10, K.olie);
  };

  // --- achterste poot eerst ---
  poot(6);

  // --- rechterarm met gatling (achter de romp) ---
  const sR = g(11, 3, 134), eR = g(8, 2, 110), mR = g(16, 2, 114);
  Pr(sR, eR, 7, 5, T.staal, { naden: 8 });
  Pr(eR, mR, 6, 6, T.olijf, { naden: 8 });
  B(7, 0.5, 105, 3, 3, 8, T.staal);
  const gat = B(15, -1, 104, 10, 6, 16, T.staal);
  gevaar(d, [gat.P1[0] - 1, gat.P1[1] - 3], 6, 2, 'rij');
  const lopen = [[0.5, 116], [3, 118], [1.5, 112], [4, 113], [0.5, 108], [3, 108]];
  for (const [rr, z] of lopen) { const p = g(25, rr, z); d.buis(p[0], p[1], 22, 'kol', 2, T.staal, { loop: true, ringen: 7 }); }
  B(38, -1, 104, 2, 6, 16, T.staal); // ring om de lopen
  const trom = g(18, 2, 120);
  d.cilinder(trom[0], trom[1], 9, 12, T.messing, { r });
  d.bol(sR[0], sR[1], 9, T.olijf);

  // --- tegengewicht/generator achterop met uitlaten ---
  B(1, 7, 104, 6, 10, 36, T.bruin);
  for (const [k, rr, rad, h] of [[3, 9, 4, 30], [3, 13, 3, 24], [3.5, 16, 2, 16]]) {
    const p = g(k, rr, 140);
    d.cilinder(p[0], p[1], rad, h, T.roest, { r, open: true });
    for (let j = 0; j < 5; j++) d.meng(p[0] - rad + Math.floor(r() * rad * 2), p[1] - h - 2 + Math.floor(r() * 5), K.roet, 0.8);
  }

  // --- bekken en draaikrans ---
  B(8, 7, 86, 7, 10, 14, T.staal);
  const krans = g(12, 12, 100);
  d.cilinder(krans[0], krans[1], 14, 6, T.staal, { r });
  for (let x = -13; x < 14; x += 3) d.zet(krans[0] + x, krans[1] + Math.round(Math.sqrt(Math.max(0, 1 - (x / 14) ** 2)) * 7) - 2, T.staal[1]);

  // --- romp: compact en gepantserd, schuine neus naar voren ---
  const romp = B(6, 6, 106, 12, 12, 30, T.olijf);
  for (let t = 0; t < 6; t++) B(18 + t, 6.5, 108 + t * 2, 1, 11, 22 - t * 4, T.olijf); // schuine neus
  nagels(d, [romp.P3[0], romp.P3[1] - 28], 12, 2, 'kol', r);
  nagels(d, [romp.P3[0], romp.P3[1] - 3], 12, 2, 'kol', r);
  for (let i = 0; i < 4; i++) streep(d, [g(6, 18, 112 + i * 4)[0] + 2, g(6, 18, 112 + i * 4)[1]], 6, 'kol', T.olijf[1]);
  tekst(d, [g(12, 18, 126)[0], g(12, 18, 126)[1]], 'M-07', 'kol', K.verf, r, 0.3);
  // cockpitraam op de neus (rechtervlak, kijkt naar voren)
  const raam = g(19, 9, 126);
  for (let s = 0; s < 6; s++) for (let j = 0; j < 8; j++) {
    d.zet(raam[0] - 2 * s, raam[1] + s - j, T.glas[1]);
    d.zet(raam[0] - 2 * s - 1, raam[1] + s - j, T.glas[1]);
  }
  const px = raam[0] - 8, py = raam[1] + 2;
  const piloot = plakMuis(d, px - 1, py - 5, 5);
  // sensorkop bovenop, voorin
  const kop = B(13, 9, 136, 5, 6, 8, T.staal);
  // railgun bovenop (mikt mee met de romp)
  B(7, 7, 136, 7, 4, 7, T.staal);
  const rg = g(14, 9, 141);
  d.buis(rg[0], rg[1], 24, 'kol', 3, T.staal, { loop: true, ringen: 4 });
  // raketbak achter-links bovenop
  const bak = B(5, 13, 136, 5, 5, 14, T.olijf);
  const gaten = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const p = g(10, 14 + i * 2, 140 + j * 5);
    d.rect(p[0] - 1, p[1] - 2, 2, 3, K.k0);
    gaten.push([p[0], p[1] - 1]);
  }

  // --- voorste poot ---
  poot(18);

  // --- linkerarm met houwitser (voor de romp) ---
  const sL = g(11, 21, 132), eL = g(8, 22, 108), mL = g(15, 22, 110);
  Pr(sL, eL, 7, 5, T.staal, { naden: 8 });
  Pr(eL, mL, 6, 6, T.olijf, { naden: 8 });
  B(7, 20.5, 103, 3, 3, 8, T.staal);
  const hou = B(13, 19, 100, 9, 7, 18, T.staal);
  gevaar(d, [hou.P3[0], hou.P3[1] - 3], 9, 2, 'kol');
  const lp = g(22, 22.5, 109);
  d.buis(lp[0], lp[1], 14, 'kol', 7, T.staal, { ringen: 5 });
  const rem = B(35, 18.5, 100, 4, 8, 18, T.staal);
  const mond = g(39, 22.5, 109);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -4; dx <= 4; dx++)
    if ((dx * dx) / 16 + (dy * dy) / 36 <= 1) d.zet(mond[0] + dx, mond[1] + dy, (dx * dx) / 16 + (dy * dy) / 36 > 0.5 ? T.staal[2] : K.k0);
  d.bol(sL[0], sL[1], 9, T.olijf);
  B(9, 19, 138, 5, 5, 4, T.olijf); // schouderplaat

  d.omlijn(K.lijn);
  d.vuil(0.05, K.olie, 0.45, r);
  for (let i = 0; i < 12; i++) {
    const p = g(6 + r() * 12, 18, 108 + r() * 26);
    d.veeg(p[0], p[1], 3 + Math.floor(r() * 7), r() < 0.6 ? T.roest[3] : K.olie);
  }

  // --- kabels en slangen ---
  const lijst = [
    [g(6, 8, 130), g(18, 2, 132), 10, T.messing[3], T.messing[5]], // munitie naar trommel
    [g(6, 10, 136), g(9, 8, 143), 4, T.messing[3], T.messing[5]], // munitie naar railgun
    [g(8, 17, 106), g(11, 18, 94), 6, K.k0, K.k1],
    [g(10, 18, 108), g(16, 18, 60), 14, K.kRood, K.kRoodL],
    [g(14, 18, 108), g(9, 19, 24), 18, K.kGeel, K.kGeelL],
    [g(8, 7, 106), g(16, 6, 60), 14, K.k0, K.k1],
    [g(6, 18, 120), g(8, 22, 110), 6, K.kBlauw, K.kBlauwL],
    [g(6, 6, 120), g(8, 2, 112), 6, K.kRood, K.kRoodL],
    [g(15, 19, 116), g(22, 21, 116), 5, K.k0, K.k1],
    [g(14, 2, 118), g(24, 1, 120), 5, K.kGeel, K.kGeelL],
    [g(13, 12, 144), g(18, 18, 120), 8, K.k0, K.k1],
    [g(2, 9, 106), g(4, 12, 92), 6, K.k0, K.k1],
    [g(2, 14, 106), g(9, 17, 96), 8, K.kRood, K.kRoodL],
  ];
  for (const [a, b, z, k, gl] of lijst) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);

  // --- neon ---
  d.neonLijn(isoPixels(g(18, 9, 141), 6, 'rij').map(([x, y]) => [x - 1, y]), N.rood); // vizier op de sensorkop
  d.neonLijn(isoPixels([raam[0], raam[1] - 8], 6, 'rij'), N.cyaan);
  d.neonLijn(isoPixels([raam[0], raam[1] + 1], 6, 'rij'), N.cyaan);
  brilLicht(d, piloot);
  d.neonLijn(isoPixels(g(14, 9, 145), 24, 'kol'), N.cyaan); // railgun-rails
  d.neonLijn(isoPixels(g(14, 9, 137), 24, 'kol').map(([x, y]) => [x, y + 1]), N.cyaan);
  for (const [x, y] of gaten) d.neon(x, y, N.rood, 1);
  for (let i = 0; i < 4; i++) d.neon(...g(10 + i * 2, 18, 132), [N.gif, N.natrium, N.rood, N.gif][i], 1);
  d.neonKabel(...g(6, 18, 106), ...g(18, 18, 106), 8, N.gif);
  d.neonKabel(...g(15, -1, 120), ...g(24, -1, 120), 5, N.natrium);
  d.licht(mond[0], mond[1], N.natrium); d.licht(mond[0] + 1, mond[1], N.natrium); d.licht(mond[0], mond[1] + 1, N.rood);
  for (const [rr, z] of lopen) { const p = g(25 + 22, rr, z); d.licht(p[0] + 1, p[1], N.natrium); }
  for (const rc of [6, 18]) { d.neon(...g(17, rc + 2, 58), N.gif, 1); d.neon(...g(9, rc + 2, 22), N.natrium, 1); }
  d.neon(...g(15, 11, 146), N.rood, 2);
  void kop; void bak; void rem;
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
  const mu = plakMuis(d, hok[0] - 5, hok[1] - 6, 5);
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
  brilLicht(d, mu);
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
  const zit = g(6.5, 5.5, 13);
  const mu = plakMuis(d, zit[0] - 3, zit[1] - 7, 7);
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
  brilLicht(d, mu);
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


// LEGE LOOPBAND (1 tegel, langs kol): lomp en gedeukt, zonder lading. Lading tekent het spel er los op.
function tekenBandLeeg() {
  const d = new Doek(40, 30);
  const r = ruis(52);
  const ax = 22, ay = 13;
  const g = isoPunt(ax, ay);
  const b = d.blokS(...g(0, 2, 0), 8, 4, 4, T.staal, { r });
  for (let s = 0; s < 8; s++) streep(d, g(s, 2, 4), 4, 'rij', s % 2 ? T.rubber[1] : T.rubber[4]);
  gevaar(d, [b.P3[0], b.P3[1] - 1], 8, 2, 'kol');
  // scheve zijrail met een deuk
  d.blokS(...g(0, 1.5, 4), 8, 0.5, 1, T.roest, { r });
  d.blokS(...g(3, 1.5, 3), 2, 0.5, 1, T.roest, { r });
  d.omlijn(K.lijn);
  d.vuil(0.08, K.olie, 0.45, r);
  d.kabel(b.P3[0] + 4, b.P3[1] - 1, b.P3[0] + 12, b.P3[1] + 4, 3, K.k0, K.k1);
  d.neon(b.P1[0] - 2, b.P1[1] - 3, N.gif, 1);
  bewaar('band-leeg', d, ax, ay, 1);
}

// LADING op de band: een brok schroot, een stuk hout of een kristal. Anker = midden onderaan.
function tekenLading(goed) {
  const d = new Doek(18, 16);
  const r = ruis(90 + goed.length);
  const g = isoPunt(9, 9);
  if (goed === 'schroot') {
    d.blokS(...g(-2, -1.5, 0), 4, 3, 3, T.staal, { r });
    d.blokS(...g(-1, -0.5, 3), 2, 2, 2, T.roest, { r });
  } else if (goed === 'hout') {
    d.blokS(...g(-2.5, -1, 0), 5, 1, 2, T.bruin, { r });
    d.blokS(...g(-2, 0.2, 0), 5, 1, 2, T.bruin, { r });
    d.blokS(...g(-2.2, -0.4, 2), 5, 1, 2, T.bruin, { r });
  } else if (goed === 'plaat') {
    // onderdeel: twee geslepen stalen platen
    d.blokS(...g(-2.5, -2, 0), 5, 4, 1, T.staal, { r });
    d.blokS(...g(-2, -1.6, 1.2), 5, 4, 1, T.staal, { r });
  } else if (goed === 'balk') {
    // onderdeel: een vierkante balk met een stalen band
    d.blokS(...g(-3, -0.8, 0), 6, 1.6, 2, T.bruin, { r });
    d.blokS(...g(-0.4, -1, 0), 0.8, 2, 2.4, T.staal, { r });
  } else {
    d.blokS(...g(-1.5, -1.5, 0), 3, 3, 1, T.staal, { r });
    d.blokS(...g(-0.5, -0.5, 1), 1.5, 1.5, 6, T.glas, { r });
  }
  d.omlijn(K.lijn);
  if (goed === 'kristal') for (const [x, y] of [[9, 1], [9, 2], [9, 3], [8, 5]]) d.licht(x, y, N.cyaan);
  bewaar(`last-${goed}`, d, 9, 13, 0);
}

// HOOP in de opslag: een bult schroot, een stapel planken of een kluit kristal. Het spel zet er veel naast elkaar.
function tekenHoop(goed) {
  const d = new Doek(28, 24);
  const r = ruis(120 + goed.length);
  const g = isoPunt(14, 14);
  if (goed === 'schroot') {
    for (let i = 0; i < 16; i++) {
      const z = i < 7 ? 0 : i < 12 ? 2 : i < 15 ? 4 : 6;
      const sp = 3.2 - z * 0.4;
      d.blokS(...g(-sp + r() * sp * 2 - 0.5, -sp + r() * sp * 2 - 0.5, z), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2), 2, r() < 0.45 ? T.roest : T.staal, { r });
    }
  } else if (goed === 'hout') {
    for (let z = 0; z < 4; z++)
      for (let j = 0; j < 4 - z; j++) d.blokS(...g(-3 + z * 0.4, -2 + j * 1.2 + z * 0.6, z * 1.6), 6 - z * 0.5, 1, 1.6, T.bruin, { r });
  } else if (goed === 'plaat') {
    for (let z = 0; z < 6; z++) d.blokS(...g(-3 + (z % 2) * 0.3, -2.5 + (z % 3) * 0.2, z * 1.1), 6, 5, 1, T.staal, { r });
  } else if (goed === 'balk') {
    for (let z = 0; z < 3; z++)
      for (let j = 0; j < 3 - z; j++) {
        d.blokS(...g(-3.2 + z * 0.3, -2.4 + j * 1.9 + z * 0.9, z * 2), 6.4, 1.7, 2, T.bruin, { r });
        d.blokS(...g(-0.5 + z * 0.3, -2.5 + j * 1.9 + z * 0.9, z * 2), 0.9, 1.9, 2.2, T.staal, { r });
      }
  } else {
    d.blokS(...g(-2.5, -2.5, 0), 5, 5, 1, T.staal, { r });
    for (const [k, rr, h] of [[-1.5, -1.5, 7], [0.5, -1, 5], [-1, 0.5, 6], [0.8, 0.8, 4], [-2, 0.8, 3]]) d.blokS(...g(k, rr, 1), 1, 1, h, T.glas, { r });
  }
  d.omlijn(K.lijn);
  d.vuil(0.05, K.olie, 0.4, r);
  if (goed === 'kristal') for (const [x, y] of [[13, 3], [13, 4], [15, 7], [12, 7], [14, 9]]) d.licht(x, y, N.cyaan);
  bewaar(`hoop-${goed}`, d, 14, 19, 0);
}

// STAPELPLAATS (2x2 tegels): betonvloer met hekpaaltjes en gevarenstrepen. De hopen tekent het spel erop.
function tekenStapel() {
  const d = new Doek(80, 60);
  const r = ruis(93);
  const ax = 40, ay = 28;
  const g = schaal(isoPunt(ax, ay));
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u * F, v * F, h * F, ramp, { r, ...o });
  const vloer = B(0, 0, 0, 8, 8, 1, T.beton);
  gevaar(d, [vloer.P3[0], vloer.P3[1] - 1], 32, 2, 'kol');
  gevaar(d, [vloer.P1[0] - 1, vloer.P1[1] - 1], 32, 2, 'rij');
  for (const [k, rr] of [[0, 0], [7.5, 0], [0, 7.5], [7.5, 7.5], [3.75, 0], [0, 3.75]]) B(k, rr, 1, 0.5, 0.5, 5, T.staal);
  d.omlijn(K.lijn);
  d.vuil(0.07, K.olie, 0.45, r);
  d.neon(...g(7.75, 7.75, 6.5), N.natrium, 1);
  d.neon(...g(0.25, 0.25, 6.5), N.rood, 1);
  bewaar('stapel', d, ax, ay, 2);
}


// HOUTBRANDER (2x2 tegels): de eerste stroombron. Lompe ijzeren oven met een vuurdeur, een schoorsteen, een stapel
// stammen ernaast en een dynamo die door de stoom draait. Het vuur is het felste ding: oranje neon.
function tekenHoutbrander() {
  const d = new Doek(88, 130);
  const r = ruis(141);
  const ax = 44, ay = 90;
  const g = isoPunt(ax, ay);
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u, v, h, ramp, { r, ...o });
  const vloer = B(0, 0, 0, 16, 16, 4, T.beton);
  gevaar(d, [vloer.P3[0], vloer.P3[1] - 2], 16, 2, 'kol');
  const oven = B(2, 2, 4, 9, 10, 26, T.roest);
  B(1.5, 1.5, 30, 10, 11, 3, T.staal); // rand bovenop
  const sch = g(5, 5, 33);
  d.cilinder(sch[0], sch[1], 4, 52, T.staal, { r });
  d.cilinder(sch[0], sch[1] - 52, 5, 4, T.roest, { r });
  // stoomketel met dynamo erachter
  const ket = g(12.5, 5, 4);
  d.cilinder(ket[0], ket[1], 6, 22, T.messing, { r });
  B(11, 9, 4, 4, 5, 10, T.olijf);
  // stammen
  for (let i = 0; i < 5; i++) B(10 + (i % 2) * 0.5, 13 + (i % 3) * 0.2, 4 + Math.floor(i / 2) * 2, 5, 1, 2, T.bruin);
  // vuurdeur aan de voorkant (rij-zijde)
  const deur = g(5, 12, 10);
  d.omlijn(K.lijn);
  d.vuil(0.07, K.olie, 0.45, r);
  for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) d.licht(deur[0] - 2 * i + 2, deur[1] + i - j, j < 2 ? N.rood : N.natrium);
  for (const [a, b, z, k, gl] of [
    [g(11, 2, 30), g(12.5, 5, 26), 8, K.k0, K.k1],
    [g(13, 9, 14), g(16, 12, 0), 10, K.kRood, K.kRoodL],
    [g(2, 11, 28), g(-1, 16, 0), 14, K.kGeel, K.kGeelL],
    [g(13, 13, 14), g(16, 16, 0), 6, K.k0, K.k1],
  ]) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);
  d.neon(sch[0], sch[1] - 57, N.rood, 1);
  d.neon(...g(12, 9, 14), N.gif, 1);
  void oven;
  bewaar('houtbrander', d, ax, ay, 2);
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

// ---------------------------------------------------------------------------
// REALITY MACHINE (4x4 tegels): de toren waarmee het eiland door de dimensies springt. Het hoogste ding op de kaart.
// Betonnen voet met trappen, een dikke messing kern met ringen, spoelen, een kroon met neon en veel te veel kabels.
function tekenMachine() {
  const d = new Doek(150, 330);
  const r = ruis(77);
  const ax = 75, ay = 258;
  const g = schaal(isoPunt(ax, ay));
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u * F, v * F, h * F, ramp, { r, ...o });
  // voet: twee lagen beton
  const voet = B(0, 0, 0, 16, 16, 8, T.beton);
  gevaar(d, [voet.P3[0], voet.P3[1] - 3], 32, 3, 'kol');
  gevaar(d, [voet.P1[0] - 1, voet.P1[1] - 3], 32, 3, 'rij');
  B(2, 2, 8, 12, 12, 6, T.staal);
  // vier steunpoten op de hoeken
  for (const [k, rr] of [[2.5, 2.5], [11.5, 2.5], [2.5, 11.5], [11.5, 11.5]]) B(k - 1, rr - 1, 14, 2, 2, 22, T.olijf);
  const m = g(8, 8, 14);
  // kern: dikke cilinder in stukken, steeds smaller
  d.cilinder(m[0], m[1], 24, 30, T.staal, { r });
  d.cilinder(m[0], m[1] - 30, 20, 40, T.messing, { r });
  for (let i = 0; i < 40; i += 6)
    for (let x = -20; x < 20; x++)
      d.meng(m[0] + x, m[1] - 30 - i + Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5) / 20) ** 2)) * 10), K.olie, 0.45);
  d.cilinder(m[0], m[1] - 70, 26, 6, T.staal, { r }); // ring
  d.cilinder(m[0], m[1] - 76, 16, 50, T.staal, { r });
  d.cilinder(m[0], m[1] - 126, 22, 5, T.roest, { r }); // ring
  d.cilinder(m[0], m[1] - 131, 11, 40, T.messing, { r });
  d.cilinder(m[0], m[1] - 171, 16, 4, T.staal, { r });
  d.cilinder(m[0], m[1] - 175, 4, 34, T.chroom, { r });
  d.bol(m[0], m[1] - 214, 8, T.chroom);
  // spoelen links en rechts op de onderste ring
  for (const dx of [-30, 30]) {
    d.cilinder(m[0] + dx, m[1] - 20, 6, 48, T.roest, { r });
    for (let j = 0; j < 44; j += 3) for (let x = -6; x < 6; x++) d.zet(m[0] + dx + x, m[1] - 22 - j, T.messing[2 + (j % 2)]);
    d.bol(m[0] + dx, m[1] - 72, 5, T.staal);
  }
  d.omlijn(K.lijn);
  d.vuil(0.05, K.olie, 0.4, r);
  // neon: buizen langs de kern, ringen, de kroon en de spoelen
  for (const dx of [-14, -5, 6]) for (let j = 2; j < 38; j++) d.licht(m[0] + dx, m[1] - 30 - j + 8, N.cyaan);
  for (let x = -10; x <= 10; x += 2) d.licht(m[0] + x, m[1] - 131 + Math.round(Math.sqrt(Math.max(0, 1 - (x / 11) ** 2)) * 5) - 2, N.magenta);
  for (let j = 0; j < 30; j++) d.licht(m[0] - 1, m[1] - 178 - j, N.cyaan);
  d.neon(m[0], m[1] - 216, N.magenta, 2);
  for (const dx of [-30, 30]) d.neon(m[0] + dx, m[1] - 76, N.cyaan, 2);
  d.neon(...g(16, 6, 6), N.natrium, 1);
  d.neon(...g(6, 16, 6), N.rood, 1);
  // kabels van de kroon en de spoelen naar de voet
  for (const [a, b, z, k, gl] of [
    [[m[0] - 16, m[1] - 120], [voet.P3[0] + 6, voet.P3[1] - 10], 20, K.k0, K.k1],
    [[m[0] + 16, m[1] - 120], [voet.P1[0] - 6, voet.P1[1] - 10], 20, K.kRood, K.kRoodL],
    [[m[0] - 30, m[1] - 70], g(4, 14, 8), 14, K.kGeel, K.kGeelL],
    [[m[0] + 30, m[1] - 70], g(14, 4, 8), 14, K.kBlauw, K.kBlauwL],
    [[m[0] - 8, m[1] - 170], [m[0] - 30, m[1] - 76], 10, K.k0, K.k1],
    [[m[0] + 8, m[1] - 170], [m[0] + 30, m[1] - 76], 12, K.k0, K.k1],
  ]) d.kabel(a[0], a[1], b[0], b[1], z, k, gl);
  d.neonKabel(m[0] - 4, m[1] - 176, m[0] - 30, m[1] - 78, 8, N.gif);
  tekst(d, [voet.P3[0] + 10, voet.P3[1] - 14], 'MK-07', 'kol', K.verf, r, 0.3);
  bewaar('machine', d, ax, ay, 4);
}

// OPSLAG (2x2 tegels): de stockpile. Pallet met kratten, een berg schroot, een stapel planken en een kristalkist.
function tekenOpslag() {
  const d = new Doek(80, 80);
  const r = ruis(88);
  const ax = 40, ay = 44;
  const g = schaal(isoPunt(ax, ay));
  const B = (k, rr, z, u, v, h, ramp, o = {}) => d.blokS(...g(k, rr, z), u * F, v * F, h * F, ramp, { r, ...o });
  B(0, 0, 0, 8, 8, 1, T.bruin); // vloer van planken
  for (let s = 0; s < 16; s += 2) streep(d, g(s / 2, 0, 1), 16, 'rij', T.bruin[2]);
  B(0.5, 0.5, 1, 3, 3, 4, T.olijf); // krat
  B(0.5, 0.5, 5, 3, 3, 3, T.olijf);
  B(4.5, 0.5, 1, 3, 2, 3, T.bruin); // planken
  B(4.5, 0.5, 4, 3, 2, 1, T.bruin, { boven: 6 });
  // schrootberg: losse brokken
  for (let i = 0; i < 14; i++) {
    const k = 1 + r() * 3, rr = 4.5 + r() * 2.5, z = 1 + Math.floor(r() * 3);
    B(k, rr, z, 1, 1, 1 + Math.floor(r() * 2), r() < 0.4 ? T.roest : T.staal);
  }
  // kristalkist
  const kist = B(5, 4.5, 1, 2.5, 2.5, 3, T.staal);
  d.omlijn(K.lijn);
  d.vuil(0.06, K.olie, 0.4, r);
  d.neon(kist.P0[0], kist.P0[1] - 5, N.magenta, 1);
  d.neon(...g(0.5, 3.6, 6), N.natrium, 1);
  bewaar('opslag', d, ax, ay, 2);
}

tekenMuis('muis', 'gewoon');
tekenMuis('muis-monteur', 'monteur');
for (const g of ['schroot', 'hout', 'kristal']) tekenMuis(`muis-${g}`, g);
tekenMech();
tekenSjouwbot();
tekenBoor();
tekenPers();
tekenDynamo();
tekenBand();
tekenMast();
tekenKabels();
tekenMachine();
tekenOpslag();
tekenBandLeeg();
for (const g of ['schroot', 'hout', 'kristal', 'plaat', 'balk']) {
  tekenLading(g);
  tekenHoop(g);
}
tekenStapel();
tekenHoutbrander();

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
