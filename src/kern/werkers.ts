// Werkers: eenheden die grondstoffen halen. Lopen naar een afzetting, graven, sjouwen naar de opslag, en weer terug.
// Posities in tegels (kommagetallen); het midden van tegel (x, y) ligt op (x, y).
import { afzettingOp, type Afzetting, type Blok, type Kaart } from './kaart';
import { hash01, volgende } from './toeval';
import type { EenheidSoort, Grondstof, Voorraad } from './types';

export type Taak = 'rust' | 'lopen' | 'naarBron' | 'graven' | 'naarOpslag';

export interface Werker {
  id: number;
  soort: string;
  x: number;
  y: number;
  doelX: number;
  doelY: number;
  via: { x: number; y: number } | null; // omweg om de machine heen
  taak: Taak;
  bron: number; // id van de afzetting, -1 = geen
  lading: { goed: Grondstof; n: number } | null;
  klok: number;
  kijkt: 1 | -1; // 1 = naar rechts op het scherm
}

// Wat de werkers nodig hebben uit de spelstaat.
export interface WerkStaat {
  toeval: number;
  kaart: Kaart;
  werkers: Werker[];
  voorraad: Voorraad;
}

const ZOEK_STRAAL = 8; // zoek zo ver naar een nieuwe afzetting van hetzelfde goed als de oude op is

export function maakWerkers(soort: string, aantal: number, k: Kaart, s: { toeval: number }): Werker[] {
  const uit: Werker[] = [];
  const rond = k.machine;
  const mx = rond.x + rond.breed / 2 - 0.5, my = rond.y + rond.diep / 2 - 0.5;
  const vrij = (x: number, y: number) =>
    [k.machine, k.opslag].every((b) => x < b.x - 0.8 || y < b.y - 0.8 || x > b.x + b.breed - 0.2 || y > b.y + b.diep - 0.2);
  for (let i = 0; i < aantal; i++) {
    // een dichte zwerm rond de machine, niet erin en niet op de opslag
    let x = mx, y = my;
    for (let poging = 0; poging < 20 && !vrij(x, y); poging++) {
      const hoek = volgende(s) * Math.PI * 2;
      const af = rond.breed / 2 + 1 + Math.sqrt(volgende(s)) * 3.5;
      x = mx + Math.cos(hoek) * af;
      y = my + Math.sin(hoek) * af;
    }
    uit.push({ id: i, soort, x, y, doelX: x, doelY: y, via: null, taak: 'rust', bron: -1, lading: null, klok: 0, kijkt: 1 });
  }
  return uit;
}

// Stuur werkers naar een tegel: een afzetting = daar gaan graven, de opslag = lading brengen, anders erheen lopen.
export function stuur(s: WerkStaat, ids: number[], kol: number, rij: number): void {
  const groep = ids.map((id) => s.werkers[id]).filter(Boolean);
  if (!groep.length) return;
  const k = s.kaart;
  const raak = afzettingOp(k, kol, rij);
  if (raak) {
    // verdeel de groep over het hele veld rond de klik, dichtstbij eerst
    const veld = k.afzettingen
      .filter((a) => a.goed === raak.goed && a.rest > 0 && Math.hypot(a.x - kol, a.y - rij) <= 4)
      .sort((a, b) => Math.hypot(a.x - kol, a.y - rij) - Math.hypot(b.x - kol, b.y - rij));
    groep.forEach((w, i) => naarBron(s, w, veld[i % veld.length]));
    return;
  }
  const o = k.opslag;
  if (kol >= o.x && rij >= o.y && kol < o.x + o.breed && rij < o.y + o.diep) {
    for (const w of groep) {
      w.bron = -1;
      if (w.lading) naarOpslag(s, w);
      else loop(s, w, kol + (hash01(w.id) - 0.5) * 3, rij + (hash01(w.id + 7) - 0.5) * 3, 'lopen');
    }
    return;
  }
  // gewoon lopen: in een dicht vierkant rond het doel
  const zijde = Math.ceil(Math.sqrt(groep.length));
  const tussen = 0.28;
  groep.forEach((w, i) => {
    const gx = (i % zijde) - (zijde - 1) / 2, gy = Math.floor(i / zijde) - (zijde - 1) / 2;
    w.bron = -1;
    loop(s, w, kol + gx * tussen, rij + gy * tussen, 'lopen');
  });
}

export function stapWerkers(s: WerkStaat, soorten: EenheidSoort[], sec: number): void {
  for (const w of s.werkers) {
    const soort = soorten.find((e) => e.soort === w.soort);
    if (!soort) continue;
    if (w.taak === 'graven') {
      graaf(s, w, soort, sec);
      continue;
    }
    if (w.taak === 'rust') continue;
    if (beweeg(w, soort.snelheid * sec)) aangekomen(s, w);
  }
}

function graaf(s: WerkStaat, w: Werker, soort: EenheidSoort, sec: number): void {
  const a = s.kaart.afzettingen[w.bron];
  if (!a || a.rest <= 0) return zoekNieuweBron(s, w, a);
  w.klok += sec;
  if (w.klok < (soort.werk?.mijnSec ?? 1)) return;
  const n = Math.min(soort.werk?.draagt ?? 1, a.rest);
  a.rest -= n;
  w.lading = { goed: a.goed, n };
  naarOpslag(s, w);
}

function aangekomen(s: WerkStaat, w: Werker): void {
  if (w.taak === 'naarBron') {
    const a = s.kaart.afzettingen[w.bron];
    if (!a || a.rest <= 0) return zoekNieuweBron(s, w, a);
    w.taak = 'graven';
    w.klok = 0;
  } else if (w.taak === 'naarOpslag') {
    if (w.lading) s.voorraad[w.lading.goed] = (s.voorraad[w.lading.goed] ?? 0) + w.lading.n;
    w.lading = null;
    const a = s.kaart.afzettingen[w.bron];
    if (a && a.rest > 0) naarBron(s, w, a);
    else if (a) zoekNieuweBron(s, w, a);
    else w.taak = 'rust';
  } else {
    w.taak = 'rust';
  }
}

function zoekNieuweBron(s: WerkStaat, w: Werker, oud: Afzetting | undefined): void {
  let beste: Afzetting | null = null;
  let afst = Infinity;
  if (oud)
    for (const a of s.kaart.afzettingen) {
      if (a.goed !== oud.goed || a.rest <= 0) continue;
      const d = Math.hypot(a.x - oud.x, a.y - oud.y);
      if (d <= ZOEK_STRAAL && d < afst) [beste, afst] = [a, d];
    }
  if (beste) naarBron(s, w, beste);
  else if (w.lading) naarOpslag(s, w);
  else {
    w.bron = -1;
    w.taak = 'rust';
  }
}

function naarBron(s: WerkStaat, w: Werker, a: Afzetting): void {
  w.bron = a.id;
  // elke werker zijn eigen plekje op de tegel, zodat een zwerm zich verspreidt
  loop(s, w, a.x + (hash01(w.id * 3 + 1) - 0.5) * 0.8, a.y + (hash01(w.id * 3 + 2) - 0.5) * 0.8, 'naarBron');
}

function naarOpslag(s: WerkStaat, w: Werker): void {
  // een plek langs de rand van de opslag, aan de kant waar de werker vandaan komt
  const o = s.kaart.opslag;
  const cx = o.x + o.breed / 2 - 0.5, cy = o.y + o.diep / 2 - 0.5;
  const hoek = Math.atan2(w.y - cy, w.x - cx) + (volgende(s) - 0.5) * 1.2;
  const r = Math.max(o.breed, o.diep) / 2 + 0.3;
  loop(s, w, cx + Math.cos(hoek) * r, cy + Math.sin(hoek) * r, 'naarOpslag');
}

function loop(s: WerkStaat, w: Werker, x: number, y: number, taak: Taak): void {
  w.doelX = x;
  w.doelY = y;
  w.taak = taak;
  w.klok = 0;
  w.via = omweg(s.kaart.machine, w.x, w.y, x, y);
}

// Loopt de rechte lijn door de machine? Dan via de hoek die de kortste omweg geeft.
function omweg(b: Blok, x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null {
  const m = 0.7;
  const r = { l: b.x - 0.5 - m, t: b.y - 0.5 - m, r: b.x + b.breed - 0.5 + m, b: b.y + b.diep - 0.5 + m };
  if (!snijdt(r, x0, y0, x1, y1)) return null;
  let beste: { x: number; y: number } | null = null;
  let lengte = Infinity;
  for (const h of [{ x: r.l, y: r.t }, { x: r.r, y: r.t }, { x: r.l, y: r.b }, { x: r.r, y: r.b }]) {
    const l = Math.hypot(h.x - x0, h.y - y0) + Math.hypot(x1 - h.x, y1 - h.y);
    if (l < lengte) [beste, lengte] = [h, l];
  }
  return beste;
}

function snijdt(r: { l: number; t: number; r: number; b: number }, x0: number, y0: number, x1: number, y1: number): boolean {
  // Liang-Barsky, iets binnen de rand zodat langs de hoek lopen niet telt
  const e = 0.05;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [
    [-dx, x0 - (r.l + e)], [dx, r.r - e - x0], [-dy, y0 - (r.t + e)], [dy, r.b - e - y0],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

// Beweeg een stuk richting het doel (eerst via de omweg). Geeft true bij aankomst.
function beweeg(w: Werker, stap: number): boolean {
  const doel = w.via ?? { x: w.doelX, y: w.doelY };
  const dx = doel.x - w.x, dy = doel.y - w.y;
  const d = Math.hypot(dx, dy);
  // op het scherm is rechts = +kol en -rij
  if (Math.abs(dx - dy) > 0.01) w.kijkt = dx - dy > 0 ? 1 : -1;
  if (d <= stap) {
    w.x = doel.x;
    w.y = doel.y;
    if (w.via) {
      w.via = null;
      return false;
    }
    return true;
  }
  w.x += (dx / d) * stap;
  w.y += (dy / d) * stap;
  return false;
}
