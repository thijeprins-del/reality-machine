// Het controlepaneel van de muizen: pixelart, schuin linksonder over de wereld. Elke knop en elk scherm doet iets.
// Gewoon canvas 2D bovenop Pixi. Regels staan in energie.ts; dit bestand tekent alleen en vertaalt klikken.
import type { SpelStaat } from '../kern/spel';
import type { WereldBeeld } from '../kern/wereldbeeld';
import { maakBouwen } from './bouwen';
import { klein, knop as balkKnop } from '../kern/scherm';
import type { Grondstof } from '../kern/types';
import { MUIZEN_ENERGIE } from '../data/muizen';
import { draaiKnop, energie, MAX_MK, omhoog, STANDEN, stroomVan, upgradeBron, upgradeKosten, verbruikVan, zetBron, zetVerbruiker, zwakte, type Bron, type EnergieStaat } from './energie';
import { industrie, industrieVraag, opslagMax } from './industrie';
import { werk } from './werk';
import { kanBetalen, kostTekst, naamVan } from './kosten';
import { tekenRegels, type Regel } from './letters';

const kw = (n: number) => (Math.abs(n % 1) > 0.05 ? n.toFixed(1) : String(Math.round(n)));

const PW = 484, PH = 212;
// Omtrek: hoog aan de linkerkant, schuin omlaag naar een lager rechterdeel.
const OMTREK: [number, number][] = [[0, 0], [184, 0], [244, 60], [476, 60], [484, 68], [484, 212], [0, 212]];
const MOD: Record<string, [number, number, number, number, string]> = {
  bronnen: [4, 6, 178, 98, 'POWER SOURCES'],
  voorraad: [4, 108, 178, 44, 'STOCK'],
  muizen: [4, 156, 178, 52, 'MICE'],
  net: [186, 64, 142, 100, 'POWER GRID'],
  verbruik: [332, 64, 148, 100, 'CONSUMERS'],
  log: [186, 168, 294, 40, 'LOG'],
};

export const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
  O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', '/': '001001010100100', '%': '101001010100101',
  '!': '010010010000010', '?': '110001010000010', ' ': '000000000000000', ',': '000000000010100', '(': '010100100100010', ')': '010001001001010', '^': '010101000000000',
};
export const KL = { groen: '#9dff2e', amber: '#ff9a1f', rood: '#ff2a3a', cyaan: '#4ef2ff', magenta: '#ff2fb0', geel: '#ffd23f', label: '#8d9189', dim: '#3a3d3b', stencil: '#a8861c' };
export const GRONDSTOFKLEUR: Record<Grondstof, string> = { schroot: '#a8a49a', hout: '#b07a3c', kristal: KL.cyaan };

const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function binnen(x: number, y: number): boolean {
  let in_ = false;
  for (let i = 0, j = OMTREK.length - 1; i < OMTREK.length; j = i++) {
    const [xi, yi] = OMTREK[i], [xj, yj] = OMTREK[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
}
const doek = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });

interface Hit { x: number; y: number; w: number; h: number; doe: (() => void) | null; hulp: string }

export function maakPaneel(staat: () => SpelStaat, beeld?: WereldBeeld): { werk(sec: number): void } {
  const pv = doek(PW, PH);
  pv.id = 'paneel';
  pv.setAttribute('aria-label', 'Mouse control panel: power sources, stock, mice, power grid, consumers and log');
  Object.assign(pv.style, { position: 'fixed', left: '0', bottom: '0', zIndex: '5', pointerEvents: 'none', display: 'block' });
  document.body.appendChild(pv);
  const pvc = pv.getContext('2d')!;
  const pcan = doek(PW, PH), pc = pcan.getContext('2d')!;
  const pgl = doek(PW, PH), pg = pgl.getContext('2d')!;
  const pw1 = doek(Math.ceil(PW / 3), Math.ceil(PH / 3)), pw1c = pw1.getContext('2d')!;
  const pw2 = doek(Math.ceil(PW / 8), Math.ceil(PH / 8)), pw2c = pw2.getContext('2d')!;
  const plaat = doek(PW, PH);
  let ps = 2, tijd = 0, scoop = 0, logScroll = 0, hover = -1, hits: Hit[] = [];

  let open = !klein(); // op een telefoon dicht tot je op PANEL tikt
  function maat(): void {
    pv.style.display = open ? 'block' : 'none';
    pv.style.bottom = klein() ? '52px' : '0'; // de knoppenbalk blijft vrij
    const ps0 = klein() ? Math.min((innerWidth - 8) / PW, (innerHeight - 60) / PH) : Math.min((innerWidth * 0.78) / PW, (innerHeight * 0.5) / PH);
    ps = ps0 >= 1 ? Math.floor(ps0 * 2) / 2 : ps0; // halve stappen: groot genoeg, nog scherp genoeg
    const dpr = Math.min(2, devicePixelRatio || 1);
    pv.style.width = `${Math.floor(PW * ps)}px`;
    pv.style.height = `${Math.floor(PH * ps)}px`;
    pv.width = Math.round(PW * ps * dpr);
    pv.height = Math.round(PH * ps * dpr);
    const hulp = document.getElementById('hulp');
    if (hulp) hulp.style.left = `${Math.floor(PW * ps) + 8}px`;
  }

  // ---- tekenhulp ----
  const R = (x: number, y: number, w: number, h: number, k: string, c: CanvasRenderingContext2D = pc) => {
    c.fillStyle = k;
    c.fillRect(x, y, w, h);
  };
  const G = (x: number, y: number, w: number, h: number, k: string) => {
    R(x, y, w, h, k);
    R(x, y, w, h, k, pg);
  };
  // tekst komt in een rij en wordt na het opschalen scherp getekend (letters.ts); alleen de gloed blijft pixels
  let regels: Regel[] = [];
  let stil = false; // tekst onder een afdekking: niet tekenen
  function txt(s: string, x: number, y: number, k: string, sz = 1, gloed = false, c: CanvasRenderingContext2D = pc): number {
    const t = s.toUpperCase();
    if (!stil && c === pc) regels.push({ s: t, x, y, k, sz, gloed });
    return x + 4 * sz * t.length;
  }
  function verzonken(x: number, y: number, w: number, h: number, bg = '#0e0f0f'): void {
    R(x, y, w, h, bg);
    R(x, y, w, 1, '#050505');
    R(x, y, 1, h, '#050505');
    R(x, y + h - 1, w, 1, '#2f3231');
    R(x + w - 1, y, 1, h, '#2f3231');
  }
  const hit = (x: number, y: number, w: number, h: number, doe: (() => void) | null, hulp: string) => hits.push({ x, y, w, h, doe, hulp });

  function tekenPlaat(): void {
    const c = plaat.getContext('2d')!;
    const img = c.createImageData(PW, PH), d = img.data;
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        if (!binnen(x + 0.5, y + 0.5)) continue;
        const rand = !binnen(x - 1.5, y + 0.5) || !binnen(x + 0.5, y - 1.5) || !binnen(x + 2.5, y + 0.5);
        const v = rand ? 8 : 26 + hash(x, y, 2) * 7 + (hash(x >> 3, y >> 1, 5) < 0.04 ? -6 : 0) + (y % 50 === 0 ? -8 : 0);
        const i = (y * PW + x) * 4;
        d[i] = v + 1;
        d[i + 1] = v + 2;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
    c.putImageData(img, 0, 0);
    // gevarenstrepen langs de schuine rand
    for (let s = 0; s < 60; s++)
      for (let j = 3; j < 7; j++) {
        c.fillStyle = Math.floor((s + j) / 3) % 2 ? '#0a0a0a' : '#7a6418';
        c.fillRect(184 + s - j, s + j - 1, 1, 1);
      }
    for (const [, [x, y, w, h, naam]] of Object.entries(MOD)) {
      c.fillStyle = '#141615';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#060606';
      c.fillRect(x, y, w, 1);
      c.fillRect(x, y, 1, h);
      c.fillStyle = '#353837';
      c.fillRect(x, y + h - 1, w, 1);
      c.fillRect(x + w - 1, y, 1, h);
      for (const [rx, ry] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) {
        c.fillStyle = '#4a4d4b';
        c.fillRect(rx, ry, 2, 2);
        c.fillStyle = '#0a0a0a';
        c.fillRect(rx + 1, ry + 1, 1, 1);
      }
      c.fillStyle = '#0a0b0b';
      c.fillRect(x + 6, y + 1, naam.length * 4 + 3, 7);
      let lx = x + 8;
      for (const ch of naam) {
        const f = FONT[ch] ?? FONT[' '];
        for (let i = 0; i < 15; i++)
          if (f[i] === '1') {
            c.fillStyle = KL.stencil;
            c.fillRect(lx + (i % 3), y + 2 + Math.floor(i / 3), 1, 1);
          }
        lx += 4;
      }
    }
    // een paar kabels over de plaat
    c.strokeStyle = '#07070a';
    c.lineWidth = 1;
    for (const [a, b, z] of [[[180, 2], [190, 166], 10], [[330, 60], [334, 166], 5], [[60, 212], [120, 156], -8]] as [number[], number[], number][]) {
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.quadraticCurveTo((a[0] + b[0]) / 2 + z, (a[1] + b[1]) / 2, b[0], b[1]);
      c.stroke();
    }
  }

  function hendel(x: number, y: number, aan: boolean, kleur: string, storing: boolean): void {
    verzonken(x, y, 14, 32, '#0b0c0c');
    R(x + 5, y + 4, 4, 24, '#030303');
    const hy = aan ? y + 3 : y + 21;
    R(x + 2, hy, 10, 6, '#6b1a16');
    R(x + 2, hy, 10, 1, '#a8322a');
    R(x + 2, hy + 5, 10, 1, '#2a0806');
    R(x + 3, hy + 1, 3, 2, '#d0574a');
    if (storing) G(x + 5, y + 1, 4, 2, Math.floor(tijd * 5) % 2 ? KL.rood : '#300');
    else if (aan) G(x + 5, y + 1, 4, 2, kleur);
    else R(x + 5, y + 1, 4, 2, '#1a1c1b');
  }
  function knop(cx: number, cy: number, stand: number, kleur: string): void {
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const d2 = x * x + y * y;
        if (d2 > 50) continue;
        R(cx + x, cy + y, 1, 1, d2 > 38 ? '#070707' : d2 > 26 ? (x + y < 0 ? '#5e6261' : '#25292b') : x + y < 0 ? '#3d4143' : '#303436');
      }
    const hoeken = [-Math.PI * 0.8, -Math.PI / 2, -Math.PI * 0.2];
    for (let i = 1; i <= 5; i++) G(Math.round(cx + Math.cos(hoeken[stand]) * i), Math.round(cy + Math.sin(hoeken[stand]) * i), 1, 1, kleur);
    ['L', 'N', 'O'].forEach((l, i) =>
      txt(l, Math.round(cx + Math.cos(hoeken[i]) * 10) - 1, Math.round(cy + Math.sin(hoeken[i]) * 10) - 2, i === stand ? kleur : KL.dim, 1, i === stand),
    );
  }
  function hitteBalk(x: number, y: number, w: number, h: number, hitte: number): void {
    verzonken(x, y, w, h, '#060707');
    const vul = Math.round(((h - 2) * hitte) / 100);
    for (let i = 0; i < vul; i++) {
      const f = i / (h - 2);
      G(x + 1, y + h - 2 - i, w - 2, 1, f < 0.5 ? '#3a8fff' : f < 0.75 ? '#ffd23f' : f < 0.85 ? '#ff9a1f' : '#ff2a3a');
    }
    R(x - 2, y + Math.round(h - 2 - (h - 2) * 0.85), 2, 1, KL.rood);
  }

  function bron(s: SpelStaat, b: Bron, cx: number, cy: number, knipper: boolean): void {
    stil = !b.mk;
    verzonken(cx, cy, 54, 88, '#101111');
    txt(b.kort, cx + 3, cy + 3, KL.label);
    const over = b.stand === 2 && b.levert > 0;
    const lamp = over ? (knipper ? KL.amber : '#402000') : b.levert > 0 ? KL.groen : '#1d1f1e';
    if (b.levert > 0) G(cx + 46, cy + 3, 5, 5, lamp);
    else R(cx + 46, cy + 3, 5, 5, lamp);
    hit(cx + 2, cy + 1, 30, 9, null, b.renners ? `${b.naam}: MICE RUN IN IT. MORE MICE, MORE POWER. NO FUEL` : `${b.naam}: TURNS ${naamVan(b.brandstof!)} FROM STOCK INTO POWER`);
    hendel(cx + 3, cy + 11, b.aan, b.kleur, false);
    hit(cx + 3, cy + 11, 14, 32, () => zetBron(s, b), `LEVER: ${b.naam} ON/OFF (KEY ${b.toets})`);
    knop(cx + 28, cy + 25, b.stand, b.stand === 2 ? KL.amber : b.kleur);
    hit(cx + 18, cy + 13, 21, 23, () => draaiKnop(s, b), `DIAL LOW/NORMAL/OVERCHARGE (SHIFT+${b.toets}). OVERCHARGE = LOTS OF POWER, WEAKER AFTERWARDS`);
    hitteBalk(cx + 45, cy + 11, 6, 50, b.hitte);
    txt(String(Math.round(b.hitte)).padStart(3, ' '), cx + 40, cy + 64, b.hitte > 60 ? KL.amber : KL.label);
    hit(cx + 42, cy + 11, 11, 58, null, `HEAT FROM OVERCHARGE: NOW ${Math.round(zwakte(b) * 100)}% STRENGTH. COOLS DOWN BY ITSELF`);
    // upgradeknop naast de naam: + = er kan een MK bij
    const up = upgradeKosten(b);
    const kan = !!up && kanBetalen(s.voorraad, up);
    verzonken(cx + 34, cy + 1, 9, 9, '#070707');
    stil = false;
    if (up) txt('+', cx + 37, cy + 3, kan ? KL.geel : KL.dim, 1, kan);
    else txt(String(b.mk), cx + 37, cy + 3, KL.groen, 1, true);
    stil = !b.mk;
    hit(cx + 34, cy + 1, 9, 9, () => upgradeBron(s, b), up ? `UPGRADE TO MK${b.mk + 1}: ${kostTekst(up, true)}. MORE POWER, MORE FUEL` : `${b.naam} IS MK${MAX_MK}, THE MAXIMUM`);
    verzonken(cx + 3, cy + 46, 36, 15, '#050806');
    const lev = kw(b.levert);
    txt(b.levert > 0 ? `+${lev}` : '--', cx + 6, cy + 49, b.levert > 0 ? (over ? KL.amber : KL.groen) : '#173014', lev.length > 2 ? 1 : 2, b.levert > 0);
    hit(cx + 3, cy + 46, 36, 15, null, `${b.naam} NOW GIVES ${lev} KW. ${STANDEN.map((n, i) => `${n[0]} ${kw(stroomVan(b, i as 0 | 1 | 2))}`).join(' ')}`);
    if (b.renners) {
      // looprad: hoeveel muizen erin rennen tegen hoeveel er nodig zijn
      const nodig = b.renners[b.stand];
      R(cx + 3, cy + 65, 4, 4, '#d8cfc0');
      txt(`${b.rennen}/${nodig}`, cx + 9, cy + 65, !b.aan ? KL.dim : b.rennen >= nodig ? KL.groen : KL.amber);
      hit(cx + 2, cy + 63, 36, 8, null, `MICE IN THE WHEEL: ${b.rennen} OF ${nodig}. LOW ${b.renners[0]}, NORMAL ${b.renners[1]}, OVERCHARGE ${b.renners[2]}`);
    } else {
      R(cx + 3, cy + 65, 4, 4, GRONDSTOFKLEUR[b.brandstof!]);
      txt(`-${verbruikVan(b).toFixed(2).replace(/^0/, '')}/S`, cx + 9, cy + 65, b.aan ? KL.amber : KL.dim);
    }
    const zwak = b.hitte > 3 && b.stand !== 2;
    const status = !b.aan ? 'OFF' : over ? 'OVER!' : zwak ? `WEAK${Math.round(zwakte(b) * 100)}` : 'RUNNING';
    txt(status, cx + 3, cy + 77, !b.aan ? KL.dim : over ? KL.amber : zwak ? KL.geel : KL.groen, 1, b.aan);
    if (b.mk) txt(`MK${b.mk}`, cx + 39, cy + 77, KL.stencil);
    else {
      // nog niet gebouwd: een lege plek met een bouwknop (of alleen uit loot)
      R(cx + 1, cy + 10, 52, 77, 'rgba(8,9,9,.88)');
      stil = false;
      if (b.loot) {
        txt('ONLY', cx + 19, cy + 30, KL.dim);
        txt('FROM LOOT', cx + 9, cy + 38, KL.magenta, 1, true);
        hit(cx + 1, cy + 10, 52, 77, null, `${b.naam}: ONLY FROM LOOT`);
        return;
      }
      const k = b.bouw[0];
      const kan2 = kanBetalen(s.voorraad, k);
      txt('NOT', cx + 21, cy + 24, KL.dim);
      txt('BUILT', cx + 17, cy + 31, KL.dim);
      verzonken(cx + 7, cy + 44, 40, 13, '#070707');
      txt('BUILD', cx + 17, cy + 48, kan2 ? KL.geel : KL.dim, 1, kan2);
      txt(kostTekst(k), cx + 27 - kostTekst(k).length * 2, cy + 64, kan2 ? KL.amber : KL.dim);
      hit(cx + 1, cy + 10, 52, 77, () => upgradeBron(s, b), `BUILD ${b.naam}: ${kostTekst(k, true)}. BURNS ${naamVan(b.brandstof ?? '')}`);
    }
  }

  function teken(s: SpelStaat, e: EnergieStaat): void {
    hits = [];
    regels = [];
    pc.clearRect(0, 0, PW, PH);
    pc.drawImage(plaat, 0, 0);
    pg.clearRect(0, 0, PW, PH);
    const knipper = Math.floor(tijd * 4) % 2 === 0;

    // BRONNEN
    // hooguit drie kaarten; een bron die alleen uit loot komt en er nog niet is, staat er niet bij
    e.bronnen.filter((b) => b.mk || !b.loot).slice(0, 3).forEach((b, i) => bron(s, b, 8 + i * 58, 14, knipper));

    // OPSLAG (de voorraad die de muizen aanslepen)
    (['schroot', 'hout', 'kristal'] as Grondstof[]).forEach((g, i) => {
      const y = 116 + i * 11;
      verzonken(8, y - 1, 170, 10, '#0a0b0b');
      if (g === 'kristal') G(10, y + 1, 5, 5, GRONDSTOFKLEUR[g]);
      else R(10, y + 1, 5, 5, GRONDSTOFKLEUR[g]);
      txt(naamVan(g), 18, y + 1, KL.label);
      const w = Math.floor(s.voorraad[g] ?? 0);
      const max = opslagMax(s, g);
      txt(String(w).padStart(3, '0'), 50, y + 1, w < 4 ? (knipper ? KL.rood : '#501010') : w >= max ? (knipper ? KL.rood : KL.amber) : '#ffe08a', 1, true);
      txt(`/${max}`, 62, y + 1, KL.dim);
      // vulmeter
      R(80, y + 6, 26, 1, '#050505');
      G(80, y + 6, Math.round((26 * Math.min(w, max)) / max), 1, w >= max ? KL.rood : GRONDSTOFKLEUR[g]);
      const tr = e.trend[g];
      txt(`${tr >= 0 ? '+' : ''}${tr.toFixed(2)}/S`, 110, y + 1, tr > 0.01 ? KL.groen : tr < -0.01 ? KL.rood : KL.dim);
      hit(8, y - 1, 170, 10, null, w >= max ? `${naamVan(g)} FULL! BUILD A STOCKPILE FOR ${naamVan(g)}` : `${naamVan(g)} IN STOCK, MAX ${max}. MORE = A STOCKPILE FOR ${naamVan(g)}`);
    });

    // MUIZEN: wat ze uit zichzelf aan het doen zijn
    const tel = werk(s).telling;
    const rijen: [string, number, string, string][] = [
      ['BUILDING', tel.bouw, KL.geel, 'FINISHING BUILD SITES. COMES FIRST'],
      ['WHEEL+FAB', tel.ren + tel.fab, KL.cyaan, 'RUNNING IN THE WHEEL AND WORKING IN FABRICATORS'],
      ['HAULING', tel.haal + tel.breng + tel.lever, KL.amber, 'BRINGING PARTS TO BUILD SITES, INPUT TO FABRICATORS, OUTPUT TO THE STOCK'],
      ['MINING', tel.graaf, KL.groen, 'DIGGING RESOURCES BY HAND, WHILE THERE IS ROOM'],
      ['IDLE', tel.vrij, KL.label, 'NOTHING TO DO: STOCK FULL OR NOTHING TO BUILD'],
    ];
    const totaal = s.werkers.length || 1;
    rijen.forEach(([naam, n, k, hulp], i) => {
      const y = 166 + i * 8;
      txt(naam, 8, y, KL.label);
      txt(String(n).padStart(3, ' '), 54, y, n ? k : KL.dim, 1, n > 0);
      verzonken(70, y, 104, 6, '#070707');
      const bw = Math.round((102 * n) / totaal);
      for (let x = 0; x < bw; x += 2) G(71 + x, y + 1, 1, 4, k);
      hit(6, y - 1, 170, 8, null, `${naam}: ${hulp}`);
    });

    // STROOMNET
    const nx = 190, ny = 73;
    verzonken(nx, ny, 134, 52, '#03100a');
    for (let x = nx + 1; x < nx + 133; x += 11) R(x, ny + 1, 1, 50, '#0a2216');
    for (let y = ny + 1; y < ny + 51; y += 10) R(nx + 1, y, 132, 1, '#0a2216');
    const H = e.hist, n = H.length;
    const lijn = (x: number, a: number, b: number, k: string) => G(x, Math.min(a, b), 1, Math.abs(a - b) + 1, k);
    if (scoop === 0) {
      const yv = (w: number) => ny + 50 - Math.round(Math.min(24, Math.max(0, w)) * 2);
      for (let i = 1; i < n; i++) {
        const x = nx + 1 + 132 - n + i;
        lijn(x, yv(H[i].a), yv(H[i - 1].a), KL.groen);
        lijn(x, yv(H[i].v), yv(H[i - 1].v), KL.amber);
      }
      txt('KW', nx + 3, ny + 3, '#2c6b3a');
    } else {
      const yv = (h: number) => ny + 50 - Math.round(h * 0.48);
      e.bronnen.forEach((b, j) => {
        for (let i = 1; i < n; i++) lijn(nx + 1 + 132 - n + i, yv(H[i].h[j]), yv(H[i - 1].h[j]), b.kleur);
      });
      R(nx + 1, yv(85), 132, 1, '#5a1010');
      txt('HEAT', nx + 3, ny + 3, '#2c6b3a');
    }
    for (let y = ny + 1; y < ny + 51; y += 2) R(nx + 1, y, 132, 1, 'rgba(0,0,0,.25)');
    hit(nx, ny, 134, 52, () => {
      scoop = 1 - scoop;
    }, scoop ? 'SCOPE: HEAT PER SOURCE. CLICK: POWER' : 'SCOPE: GREEN SUPPLY, AMBER DEMAND. CLICK: HEAT');
    const netto = e.aanbod - e.vraag;
    txt('SUPPLY', nx, ny + 56, KL.label);
    txt(kw(e.aanbod), nx, ny + 63, KL.groen, kw(e.aanbod).length > 3 ? 1 : 2, true);
    txt('DEMAND', nx + 34, ny + 56, KL.label);
    txt(kw(e.vraag), nx + 34, ny + 63, KL.amber, kw(e.vraag).length > 3 ? 1 : 2, true);
    txt('NET', nx + 68, ny + 56, KL.label);
    const nt = (netto > 0 ? '+' : '') + kw(netto);
    txt(nt, nx + 68, ny + 63, netto < 0 ? KL.rood : netto > 0 ? KL.geel : KL.groen, nt.length > 3 ? 1 : 2, true);
    hit(nx, ny + 55, 98, 20, null, netto > 0 ? `${kw(netto)} KW SPARE: SWITCH MORE ON OR BURN LESS` : netto < 0 ? 'SHORTAGE: WHATEVER IS AT THE BOTTOM GETS NOTHING' : 'EXACTLY IN BALANCE');
    verzonken(nx, ny + 77, 92, 8, '#070707');
    R(nx + 45, ny + 78, 1, 6, '#3a3d3b');
    G(nx + 45 + Math.round(Math.min(1, Math.max(-1, netto / 8)) * 42), ny + 78, 2, 6, netto < 0 ? KL.rood : netto > 2 ? KL.geel : KL.groen);
    // tekort: wie valt er uit
    const zx = nx + 100, zy = ny + 54;
    verzonken(zx, zy, 34, 32, '#0c0d0d');
    const wie = e.verbruikers.find((c) => c.id === e.tekort);
    if (!wie) {
      txt('GRID', zx + 9, zy + 6, KL.label);
      txt('OK', zx + 13, zy + 17, KL.groen, 1, true);
    } else {
      txt('SHORT', zx + 7, zy + 6, knipper ? KL.rood : '#701010', 1, knipper);
      txt(wie.naam.slice(0, 7), zx + 17 - Math.min(7, wie.naam.length) * 2, zy + 17, KL.amber, 1, true);
    }
    hit(zx, zy, 34, 32, null, wie ? `${wie.naam} GETS TOO LITTLE. SWITCH SOMETHING OFF OR MOVE IT UP (^)` : 'EVERYONE GETS ENOUGH POWER');

    // VERBRUIKERS
    const m = s.machine;
    e.verbruikers.forEach((c, i) => {
      const x0 = 336, y0 = 72 + i * 23;
      verzonken(x0, y0, 140, 22, '#101111');
      R(x0 + 3, y0 + 3, 9, 16, '#050505');
      if (c.aan) {
        R(x0 + 4, y0 + 4, 7, 7, '#4c5051');
        G(x0 + 5, y0 + 5, 5, 2, KL.groen);
        R(x0 + 4, y0 + 11, 7, 7, '#1c1f21');
      } else {
        R(x0 + 4, y0 + 4, 7, 7, '#1c1f21');
        R(x0 + 4, y0 + 11, 7, 7, '#4c5051');
        R(x0 + 5, y0 + 15, 5, 2, '#2a0a0a');
      }
      hit(x0 + 1, y0 + 1, 13, 20, () => zetVerbruiker(s, c), `${c.naam} ON/OFF (KEY ${c.toets}). NEEDS ${kw(c.vraag)} KW`);
      const eind = txt(c.naam, x0 + 16, y0 + 3, KL.label);
      txt(`${kw(c.vraag)}KW`, eind + 3, y0 + 3, c.aan ? KL.amber : KL.dim);
      const led = c.krijgt >= 0.999 ? KL.groen : c.krijgt > 0 ? KL.amber : c.aan ? KL.rood : '#1d1f1e';
      if (c.aan) G(x0 + 130, y0 + 3, 5, 5, led);
      else R(x0 + 130, y0 + 3, 5, 5, led);
      // voorrang: ^ zet hem een plek hoger
      if (i > 0) {
        verzonken(x0 + 120, y0 + 1, 8, 8, '#070707');
        txt('^', x0 + 122, y0 + 2, KL.cyaan);
        hit(x0 + 120, y0 + 1, 8, 8, () => omhoog(s, c), `PRIORITY: MOVE ${c.naam} UP. THE TOP GETS POWER FIRST`);
      }
      let f = c.aan ? c.krijgt : 0, info = '', kleur = KL.cyaan, hulp = '';
      if (c.id === 'machine') {
        f = m.energie / m.maxEnergie;
        kleur = f >= 1 ? KL.groen : KL.rood;
        info = f >= 1 ? 'READY TO JUMP' : `POWER ${Math.round(f * 100)}%`;
        hulp = 'MACHINE: NEEDS FULL POWER WHEN THE STREAM COMES';
      } else if (c.id === 'koeling') {
        info = c.aan ? (c.krijgt > 0 ? 'SOURCES COOL FASTER' : 'NO POWER') : 'OFF';
        hulp = 'COOLING: HOT SOURCES RECOVER FASTER';
      } else if (c.id === 'lampen') {
        kleur = KL.geel;
        info = c.krijgt > 0 ? `MINING +${Math.round(MUIZEN_ENERGIE.lampenSneller * c.krijgt * 100)}%` : c.aan ? 'NO POWER' : 'OFF';
        hulp = 'WORK LAMPS: MICE MINE FASTER';
      } else {
        const ind = industrie(s);
        kleur = KL.groen;
        const pct = c.aan && c.krijgt < 0.999 ? ` ${Math.round(c.krijgt * 100)}%` : '';
        info = `${ind.fabrieken.filter((b) => !b.af).length} FAB ${ind.boren.filter((b) => !b.af).length} DRILL ${[...ind.banden.values()].filter((b) => !b.af).length} BELT${pct}`;
        hulp = `INDUSTRY: FABRICATORS, DRILLS AND BELTS (${kw(industrieVraag(s))} KW)`;
      }
      verzonken(x0 + 72, y0 + 10, 54, 5, '#050505');
      const vw = Math.round(52 * Math.min(1, Math.max(0, f)));
      for (let x = 0; x < vw; x += 2) G(x0 + 73 + x, y0 + 11, 1, 3, kleur);
      txt(info.slice(0, 30), x0 + 16, y0 + 16, c.aan ? KL.label : KL.dim);
      hit(x0 + 15, y0 + 1, 104, 20, null, hulp);
    });

    // LOGBOEK
    const lx = 190, ly = 175;
    verzonken(lx, ly, 286, 30, '#0d0802');
    const kleuren = { amber: KL.amber, rood: KL.rood, groen: KL.groen, cyaan: KL.cyaan };
    for (let i = 0; i < 3; i++) {
      const r = e.log[i + logScroll];
      if (!r) continue;
      const nieuw = i === 0 && logScroll === 0;
      // lange regels worden smaller geschoven in plaats van afgekapt (tot 58 tekens)
      const t = r.tekst.slice(0, 58);
      txt(t.slice(0, 44), lx + 3, ly + 3 + i * 7, nieuw ? kleuren[r.kleur] : '#6b4a14', 1, nieuw);
      if (regels.length) Object.assign(regels[regels.length - 1], { s: t, w: 174 });
    }
    R(lx + 180, ly + 2, 1, 26, '#2a1a06');
    const uitleg = hover >= 0 && hits[hover] ? hits[hover].hulp : logScroll ? 'OLDER MESSAGES. CLICK FOR MORE' : 'POINT AT SOMETHING FOR HELP';
    // uitleg rechts in twee regels van 25 tekens
    const woorden = uitleg.split(' ');
    const zinnen = [''];
    for (const w of woorden) {
      if ((zinnen[zinnen.length - 1] + ' ' + w).trim().length > 25 && zinnen.length < 3) zinnen.push('');
      zinnen[zinnen.length - 1] = (zinnen[zinnen.length - 1] + ' ' + w).trim();
    }
    zinnen.slice(0, 3).forEach((r, i) => txt(r.slice(0, 25), lx + 184, ly + 3 + i * 8, KL.cyaan, 1, hover >= 0));
    for (let y = ly + 1; y < ly + 29; y += 2) R(lx + 1, y, 284, 1, 'rgba(0,0,0,.22)');
    hit(lx, ly, 180, 30, () => {
      logScroll = e.log.length > 3 ? (logScroll + 3) % (e.log.length - 2) : 0;
    }, 'LOG: CLICK FOR OLDER MESSAGES');

    if (hover >= 0 && hits[hover]?.doe) {
      const h = hits[hover];
      pg.strokeStyle = '#ffd23f88';
      pg.lineWidth = 1;
      pg.strokeRect(h.x - 0.5, h.y - 0.5, h.w + 1, h.h + 1);
    }

    // naar het scherm met gloed
    const W2 = pv.width, H2 = pv.height;
    pvc.clearRect(0, 0, W2, H2);
    pvc.globalCompositeOperation = 'source-over';
    pvc.globalAlpha = 1;
    pvc.imageSmoothingEnabled = false;
    pvc.drawImage(pcan, 0, 0, W2, H2);
    pvc.globalCompositeOperation = 'lighter';
    pvc.drawImage(pgl, 0, 0, W2, H2);
    pw1c.clearRect(0, 0, pw1.width, pw1.height);
    pw1c.imageSmoothingEnabled = true;
    pw1c.drawImage(pgl, 0, 0, pw1.width, pw1.height);
    pw2c.clearRect(0, 0, pw2.width, pw2.height);
    pw2c.imageSmoothingEnabled = true;
    pw2c.drawImage(pw1, 0, 0, pw2.width, pw2.height);
    pvc.imageSmoothingEnabled = true;
    pvc.globalAlpha = 0.8;
    pvc.drawImage(pw1, 0, 0, W2, H2);
    pvc.globalAlpha = 0.6;
    pvc.drawImage(pw2, 0, 0, W2, H2);
    pvc.globalAlpha = 1;
    pvc.globalCompositeOperation = 'source-over';
    tekenRegels(pvc, regels, W2 / PW, H2 / PH);
  }

  // ---- invoer: alleen binnen de omtrek; daarbuiten gaat alles door naar het spel ----
  const punt = (e: MouseEvent) => {
    const r = pv.getBoundingClientRect();
    if (e.clientX < r.left || e.clientY < r.top || e.clientX > r.right || e.clientY > r.bottom) return null;
    const p = { x: ((e.clientX - r.left) / r.width) * PW, y: ((e.clientY - r.top) / r.height) * PH };
    return binnen(p.x, p.y) ? p : null;
  };
  const zoek = (p: { x: number; y: number }) => {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h) return i;
    }
    return -1;
  };
  window.addEventListener('pointermove', (e) => {
    const p = punt(e);
    hover = p ? zoek(p) : -1;
    document.body.style.cursor = hover >= 0 && hits[hover].doe ? 'pointer' : '';
  });
  window.addEventListener(
    'pointerdown',
    (e) => {
      const p = punt(e);
      if (!p) return;
      e.stopPropagation();
      e.preventDefault();
      if (e.button !== 0) return;
      const i = zoek(p);
      hover = i; // ook bij tikken de uitleg laten zien
      hits[i]?.doe?.();
    },
    { capture: true },
  );
  for (const soort of ['wheel', 'contextmenu'] as const)
    window.addEventListener(
      soort,
      (e) => {
        if (punt(e)) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      { capture: true, passive: false },
    );
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const s = staat(), en = energie(s), t = e.key.toUpperCase();
    const b = en.bronnen.find((x) => x.toets === t || (e.shiftKey && ['!', '@', '#'][Number(x.toets) - 1] === e.key));
    if (b) return e.shiftKey ? draaiKnop(s, b) : zetBron(s, b);
    const c = en.verbruikers.find((x) => x.toets === t);
    if (c) return zetVerbruiker(s, c);
  });

  tekenPlaat();
  maat();
  window.addEventListener('resize', maat);
  const bouwen = beeld ? maakBouwen(staat, beeld) : null;
  // telefoon: het paneel en het bouwmenu om de beurt open, met knoppen
  if (klein()) {
    let kPaneel: HTMLButtonElement, kBouw: HTMLButtonElement | null = null;
    const zet = (paneel: boolean, bouw: boolean) => {
      open = paneel;
      maat();
      bouwen?.zicht(bouw);
      kPaneel.classList.toggle('aan', paneel);
      kBouw?.classList.toggle('aan', bouw);
    };
    kPaneel = balkKnop('PANEL', 'power, stock and mice', () => zet(!open, false));
    if (bouwen) kBouw = balkKnop('BUILD', 'build menu', () => zet(false, !kBouw!.classList.contains('aan')));
  }
  return {
    werk(sec) {
      tijd += sec;
      bouwen?.werk(sec);
      const s = staat();
      teken(s, energie(s));
    },
  };
}
