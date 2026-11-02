// Het controlepaneel van de muizen: pixelart, schuin linksonder over de wereld. Elke knop en elk scherm doet iets.
// Gewoon canvas 2D bovenop Pixi. Regels staan in energie.ts; dit bestand tekent alleen en vertaalt klikken.
import type { SpelStaat } from '../kern/spel';
import type { Grondstof } from '../kern/types';
import { MUIZEN_ENERGIE } from '../data/muizen';
import { draaiKnop, energie, noodstop, resetZekering, zetBron, zetVerbruiker, type Bron, type EnergieStaat } from './energie';

const PW = 484, PH = 212;
// Omtrek: hoog aan de linkerkant, schuin omlaag naar een lager rechterdeel.
const OMTREK: [number, number][] = [[0, 0], [184, 0], [244, 60], [476, 60], [484, 68], [484, 212], [0, 212]];
const MOD: Record<string, [number, number, number, number, string]> = {
  bronnen: [4, 6, 178, 98, 'BRONNEN'],
  voorraad: [4, 108, 178, 44, 'OPSLAG'],
  nood: [4, 156, 74, 52, 'NOOD'],
  net: [186, 64, 142, 100, 'STROOMNET'],
  verbruik: [332, 64, 148, 100, 'VERBRUIKERS'],
  log: [186, 168, 294, 40, 'LOGBOEK'],
};

const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
  O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', '/': '001001010100100', '%': '101001010100101',
  '!': '010010010000010', '?': '110001010000010', ' ': '000000000000000', ',': '000000000010100', '(': '010100100100010', ')': '010001001001010', '^': '010101000000000',
};
const KL = { groen: '#9dff2e', amber: '#ff9a1f', rood: '#ff2a3a', cyaan: '#4ef2ff', magenta: '#ff2fb0', geel: '#ffd23f', label: '#8d9189', dim: '#3a3d3b', stencil: '#a8861c' };
const GRONDSTOFKLEUR: Record<Grondstof, string> = { schroot: '#a8a49a', hout: '#b07a3c', kristal: KL.cyaan };

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

export function maakPaneel(staat: () => SpelStaat): { werk(sec: number): void } {
  const pv = doek(PW, PH);
  pv.id = 'paneel';
  pv.setAttribute('aria-label', 'Controlepaneel van de muizen: bronnen, opslag, stroomnet, verbruikers, logboek en noodstop');
  Object.assign(pv.style, { position: 'fixed', left: '0', bottom: '0', zIndex: '5', pointerEvents: 'none', display: 'block' });
  document.body.appendChild(pv);
  const pvc = pv.getContext('2d')!;
  const pcan = doek(PW, PH), pc = pcan.getContext('2d')!;
  const pgl = doek(PW, PH), pg = pgl.getContext('2d')!;
  const pw1 = doek(Math.ceil(PW / 3), Math.ceil(PH / 3)), pw1c = pw1.getContext('2d')!;
  const pw2 = doek(Math.ceil(PW / 8), Math.ceil(PH / 8)), pw2c = pw2.getContext('2d')!;
  const plaat = doek(PW, PH);
  let ps = 2, tijd = 0, scoop = 0, logScroll = 0, hover = -1, hits: Hit[] = [];

  function maat(): void {
    const ps0 = Math.min((innerWidth * 0.78) / PW, (innerHeight * 0.5) / PH);
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
  function txt(s: string, x: number, y: number, k: string, sz = 1, gloed = false, c: CanvasRenderingContext2D = pc): number {
    for (const ch of s.toUpperCase()) {
      const f = FONT[ch] ?? FONT['?'];
      for (let i = 0; i < 15; i++)
        if (f[i] === '1') {
          const xx = x + (i % 3) * sz, yy = y + Math.floor(i / 3) * sz;
          R(xx, yy, sz, sz, k, c);
          if (gloed) R(xx, yy, sz, sz, k, pg);
        }
      x += 4 * sz;
    }
    return x;
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
    // ventilatierooster tussen noodknop en logboek
    for (let y = 160; y < 204; y += 3) {
      c.fillStyle = '#0b0c0c';
      c.fillRect(86, y, 92, 2);
      c.fillStyle = '#383b3a';
      c.fillRect(86, y + 2, 92, 1);
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
    ['L', 'M', 'H'].forEach((l, i) =>
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
    verzonken(cx, cy, 54, 88, '#101111');
    txt(b.naam, cx + 3, cy + 3, KL.label);
    const lamp = b.storing ? (knipper ? KL.rood : '#300') : b.levert > 0 ? (b.hitte > 85 ? KL.amber : KL.groen) : '#1d1f1e';
    if (b.storing || b.levert > 0) G(cx + 46, cy + 3, 5, 5, lamp);
    else R(cx + 46, cy + 3, 5, 5, lamp);
    hit(cx + 2, cy + 1, 50, 9, null, `${b.naam}: ${b.brandstof.toUpperCase()} UIT DE OPSLAG WORDT STROOM`);
    hendel(cx + 3, cy + 11, b.aan, b.kleur, b.storing);
    hit(cx + 3, cy + 11, 14, 32, () => zetBron(s, b), `HENDEL: ${b.naam} AAN/UIT (TOETS ${b.toets})`);
    knop(cx + 28, cy + 25, b.stand, b.kleur);
    hit(cx + 18, cy + 13, 21, 23, () => draaiKnop(s, b), `KNOP L/M/H: MEER STROOM, HITTE EN ${b.brandstof.toUpperCase()}`);
    hitteBalk(cx + 45, cy + 11, 6, 50, b.hitte);
    txt(String(Math.round(b.hitte)).padStart(3, ' '), cx + 40, cy + 64, b.hitte > 85 ? KL.rood : KL.label);
    hit(cx + 42, cy + 11, 11, 58, null, `HITTE ${b.naam}: OP 100 STORING, TOT HIJ ONDER ${MUIZEN_ENERGIE.storingTot} IS`);
    verzonken(cx + 3, cy + 46, 36, 15, '#050806');
    txt(b.levert > 0 ? `+${b.levert}` : '--', cx + 6, cy + 49, b.levert > 0 ? KL.groen : '#173014', 2, b.levert > 0);
    hit(cx + 3, cy + 46, 36, 15, null, `${b.naam} LEVERT NU ${b.levert} KW (STAND: ${b.stroom[b.stand]} KW)`);
    R(cx + 3, cy + 65, 4, 4, GRONDSTOFKLEUR[b.brandstof]);
    txt(`-${b.verbruik[b.stand].toFixed(2).replace(/^0/, '')}/S`, cx + 9, cy + 65, b.aan ? KL.amber : KL.dim);
    const status = b.storing ? 'STORING' : !b.aan ? 'UIT' : b.hitte > 85 ? 'HEET!' : 'DRAAIT';
    txt(status, cx + 3, cy + 77, b.storing ? KL.rood : !b.aan ? KL.dim : b.hitte > 85 ? KL.amber : KL.groen, 1, b.storing || b.aan);
  }

  function teken(s: SpelStaat, e: EnergieStaat): void {
    hits = [];
    pc.clearRect(0, 0, PW, PH);
    pc.drawImage(plaat, 0, 0);
    pg.clearRect(0, 0, PW, PH);
    const knipper = Math.floor(tijd * 4) % 2 === 0;

    // BRONNEN
    e.bronnen.forEach((b, i) => bron(s, b, 8 + i * 58, 14, knipper));

    // OPSLAG (de voorraad die de muizen aanslepen)
    (['schroot', 'hout', 'kristal'] as Grondstof[]).forEach((g, i) => {
      const y = 116 + i * 11;
      verzonken(8, y - 1, 170, 10, '#0a0b0b');
      if (g === 'kristal') G(10, y + 1, 5, 5, GRONDSTOFKLEUR[g]);
      else R(10, y + 1, 5, 5, GRONDSTOFKLEUR[g]);
      txt(g, 18, y + 1, KL.label);
      const w = Math.floor(s.voorraad[g] ?? 0);
      txt(String(w).padStart(4, '0'), 62, y + 1, w < 4 ? (knipper ? KL.rood : '#501010') : '#ffe08a', 1, true);
      const tr = e.trend[g];
      txt(`${tr >= 0 ? '+' : ''}${tr.toFixed(2)}/S`, 86, y + 1, tr > 0.01 ? KL.groen : tr < -0.01 ? KL.rood : KL.dim);
      const wie = e.bronnen.find((b) => b.brandstof === g);
      txt(wie ? wie.naam.slice(0, 6) : '', 146, y + 1, wie && wie.levert > 0 ? KL.amber : KL.dim);
      hit(8, y - 1, 170, 10, null, `${g.toUpperCase()} IN DE OPSLAG. STUUR MUIZEN EROP (RECHTSKLIK)`);
    });

    // NOODSTOP
    const nk = 41, nyc = 182, laden = e.nood > 0;
    for (let y = -14; y <= 14; y++)
      for (let x = -14; x <= 14; x++) {
        const d2 = x * x + y * y;
        if (d2 > 196) continue;
        let k: string;
        if (d2 > 156) k = '#0a0a0a';
        else if (laden) k = d2 < 30 && x + y < 0 ? '#4a1010' : '#2c0808';
        else k = d2 < 44 && x + y < -2 ? '#ff5a5a' : x + y < 0 ? '#c8141e' : '#7a0a10';
        R(nk + x, nyc + y + (laden ? 1 : 0), 1, 1, k);
      }
    if (!laden) {
      txt('STOP', nk - 7, nyc - 2, '#2a0204');
      pg.fillStyle = '#ff2a3a55';
      pg.fillRect(nk - 9, nyc - 9, 18, 18);
    } else txt(String(Math.ceil(e.nood)), nk - 2, nyc - 1, KL.rood);
    for (let i = 0; i < 66; i++)
      for (let j = 0; j < 2; j++) R(8 + i, 204 + j, 1, 1, Math.floor((i + j) / 3) % 2 ? '#0a0a0a' : '#8a7016');
    hit(nk - 14, nyc - 14, 29, 29, () => noodstop(s), laden ? `NOODSTOP LAADT OP (${Math.ceil(e.nood)} S)` : 'NOODSTOP (N): ALLES UIT, 40 HITTE ERAF');

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
      txt('HITTE', nx + 3, ny + 3, '#2c6b3a');
    }
    for (let y = ny + 1; y < ny + 51; y += 2) R(nx + 1, y, 132, 1, 'rgba(0,0,0,.25)');
    hit(nx, ny, 134, 52, () => {
      scoop = 1 - scoop;
    }, scoop ? 'SCOOP: HITTE PER BRON. KLIK: STROOM' : 'SCOOP: GROEN AANBOD, AMBER VRAAG. KLIK: HITTE');
    const netto = e.aanbod - e.vraag;
    txt('AANBOD', nx, ny + 56, KL.label);
    txt(String(e.aanbod), nx, ny + 63, KL.groen, 2, true);
    txt('VRAAG', nx + 34, ny + 56, KL.label);
    txt(String(e.vraag), nx + 34, ny + 63, KL.amber, 2, true);
    txt('NETTO', nx + 68, ny + 56, KL.label);
    txt((netto > 0 ? '+' : '') + netto, nx + 68, ny + 63, netto < 0 ? KL.rood : netto > 0 ? KL.geel : KL.groen, 2, true);
    hit(nx, ny + 55, 98, 20, null, netto > 0 ? `${netto} KW OVER: DAT WORDT HITTE IN JE BRONNEN` : netto < 0 ? 'TEKORT: ALLES DRAAIT TRAAG, ZEKERING LIJDT' : 'PRECIES IN BALANS');
    verzonken(nx, ny + 77, 92, 8, '#070707');
    R(nx + 45, ny + 78, 1, 6, '#3a3d3b');
    G(nx + 45 + Math.round(Math.min(1, Math.max(-1, netto / 8)) * 42), ny + 78, 2, 6, netto < 0 ? KL.rood : netto > 2 ? KL.geel : KL.groen);
    // zekering
    const zx = nx + 100, zy = ny + 54;
    verzonken(zx, zy, 34, 32, '#0c0d0d');
    txt('ZEKER', zx + 3, zy + 2, KL.label);
    R(zx + 3, zy + 10, 3, 9, '#8e918c');
    R(zx + 28, zy + 10, 3, 9, '#8e918c');
    R(zx + 6, zy + 11, 22, 7, '#0c1a1e');
    R(zx + 6, zy + 11, 22, 1, '#2a4a50');
    if (e.zekering.heel) {
      for (let x = 0; x < 22; x++) G(zx + 6 + x, zy + 14 + (x % 4 === 0 ? -1 : x % 4 === 2 ? 1 : 0), 1, 1, e.aanbod < e.vraag ? KL.amber : '#ffe08a');
      txt('HEEL', zx + 9, zy + 21, KL.groen, 1, true);
    } else {
      R(zx + 6, zy + 14, 8, 1, '#3a3a3a');
      R(zx + 21, zy + 14, 7, 1, '#3a3a3a');
      txt('RESET', zx + 7, zy + 21, knipper ? KL.rood : '#4a1010', 1, knipper);
    }
    R(zx + 3, zy + 28, 28, 2, '#050505');
    G(zx + 3, zy + 28, Math.round((28 * e.zekering.spanning) / MUIZEN_ENERGIE.zekeringSec), 2, KL.rood);
    hit(zx, zy, 34, 32, () => resetZekering(s), e.zekering.heel ? `ZEKERING: SLAAT DOOR NA ${MUIZEN_ENERGIE.zekeringSec} S TEKORT` : 'ZEKERING DOOR! KLIK OF Z: NIEUWE ERIN');

    // VERBRUIKERS
    const m = s.machine;
    e.verbruikers.forEach((c, i) => {
      const x0 = 336, y0 = 73 + i * 30;
      verzonken(x0, y0, 140, 27, '#101111');
      R(x0 + 3, y0 + 4, 9, 16, '#050505');
      if (c.aan) {
        R(x0 + 4, y0 + 5, 7, 7, '#4c5051');
        G(x0 + 5, y0 + 6, 5, 2, c.storing ? KL.rood : KL.groen);
        R(x0 + 4, y0 + 12, 7, 7, '#1c1f21');
      } else {
        R(x0 + 4, y0 + 5, 7, 7, '#1c1f21');
        R(x0 + 4, y0 + 12, 7, 7, '#4c5051');
        R(x0 + 5, y0 + 16, 5, 2, '#2a0a0a');
      }
      hit(x0 + 1, y0 + 1, 13, 25, () => zetVerbruiker(s, c), `${c.naam} AAN/UIT (TOETS ${c.toets}). VRAAGT ${c.vraag} KW`);
      txt(c.naam, x0 + 16, y0 + 4, KL.label);
      txt(`${c.vraag} KW`, x0 + 16, y0 + 12, c.aan ? KL.amber : KL.dim);
      const led = c.storing ? (knipper ? KL.rood : '#300') : c.krijgt >= 0.999 ? KL.groen : c.krijgt > 0 ? KL.amber : c.aan ? KL.rood : '#1d1f1e';
      if (c.aan || c.storing) G(x0 + 130, y0 + 4, 5, 5, led);
      else R(x0 + 130, y0 + 4, 5, 5, led);
      let f = 0, info = '', kleur = KL.cyaan, hulp = '';
      if (c.id === 'machine') {
        f = m.energie / m.maxEnergie;
        kleur = f >= 1 ? KL.groen : KL.cyaan;
        info = `ENERGIE ${Math.floor(m.energie)}/${m.maxEnergie} HITTE ${Math.round(c.hitte)}`;
        hulp = 'MACHINE: LAADT DE ENERGIE VOOR DE STREAM';
      } else if (c.id === 'koeling') {
        f = c.krijgt;
        info = c.krijgt > 0 ? `-${(MUIZEN_ENERGIE.koeling * c.krijgt).toFixed(1)} HITTE/S OP ALLES` : 'STIL';
        hulp = 'KOELING: HAALT HITTE UIT ALLES';
      } else {
        f = c.hitte / 100;
        kleur = c.hitte > 85 ? KL.rood : KL.geel;
        info = c.krijgt > 0 ? `GRAVEN +${Math.round(MUIZEN_ENERGIE.lampenSneller * c.krijgt * 100)}% HITTE ${Math.round(c.hitte)}` : `HITTE ${Math.round(c.hitte)}`;
        hulp = 'WERKLAMPEN: MUIZEN GRAVEN SNELLER. WORDEN HEET';
      }
      verzonken(x0 + 52, y0 + 5, 74, 6, '#050505');
      const vw = Math.round(72 * Math.min(1, Math.max(0, f)));
      for (let x = 0; x < vw; x += 2) G(x0 + 53 + x, y0 + 6, 1, 4, kleur);
      txt(info.slice(0, 30), x0 + 16, y0 + 20, c.aan ? KL.label : KL.dim);
      hit(x0 + 15, y0 + 1, 124, 25, null, hulp);
    });

    // LOGBOEK
    const lx = 190, ly = 175;
    verzonken(lx, ly, 286, 30, '#0d0802');
    const kleuren = { amber: KL.amber, rood: KL.rood, groen: KL.groen, cyaan: KL.cyaan };
    for (let i = 0; i < 3; i++) {
      const r = e.log[i + logScroll];
      if (!r) continue;
      const nieuw = i === 0 && logScroll === 0;
      txt(r.tekst.slice(0, 44), lx + 3, ly + 3 + i * 7, nieuw ? kleuren[r.kleur] : '#6b4a14', 1, nieuw);
    }
    R(lx + 180, ly + 2, 1, 26, '#2a1a06');
    const uitleg = hover >= 0 && hits[hover] ? hits[hover].hulp : logScroll ? 'OUDERE MELDINGEN. KLIK VOOR MEER' : 'WIJS IETS AAN VOOR UITLEG';
    // uitleg rechts in twee regels van 25 tekens
    const woorden = uitleg.split(' ');
    const regels = [''];
    for (const w of woorden) {
      if ((regels[regels.length - 1] + ' ' + w).trim().length > 25 && regels.length < 3) regels.push('');
      regels[regels.length - 1] = (regels[regels.length - 1] + ' ' + w).trim();
    }
    regels.slice(0, 3).forEach((r, i) => txt(r.slice(0, 25), lx + 184, ly + 3 + i * 8, KL.cyaan, 1, hover >= 0));
    for (let y = ly + 1; y < ly + 29; y += 2) R(lx + 1, y, 284, 1, 'rgba(0,0,0,.22)');
    hit(lx, ly, 180, 30, () => {
      logScroll = e.log.length > 3 ? (logScroll + 3) % (e.log.length - 2) : 0;
    }, 'LOGBOEK: KLIK VOOR OUDERE MELDINGEN');

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
    if (t === 'Z') resetZekering(s);
    if (t === 'N') noodstop(s);
  });

  tekenPlaat();
  maat();
  window.addEventListener('resize', maat);
  return {
    werk(sec) {
      tijd += sec;
      const s = staat();
      teken(s, energie(s));
    },
  };
}
