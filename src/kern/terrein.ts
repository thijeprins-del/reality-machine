// Terrein: de hoogtekaart van een dimensie. Hoogtes staan op de HOEKEN van tegels, in hele niveaus, dus er zijn
// (breed + 1) x (diep + 1) getallen. Tegel (x, y) loopt van x - 0,5 tot x + 0,5, dus hoek (i, j) ligt op (i - 0,5, j - 0,5).
// Een schuine tegel is twee platte driehoeken; hoogteOp en het tekenen knikken langs dezelfde lijn.
import { HOOGTE_MAX, HOOGTE_MIN, HOOGTE_PX, KLIP_HOOGTE, MAX_OPRITTEN, MIN_KLIP, MIN_PLATEAU, MIN_STUK, TERREIN_VLAK, TERREIN_VOL, type Heuvels } from '../data/dimensies';
import { TEGEL_B, TEGEL_H } from './iso';
import { volgende } from './toeval';

export const TEGEL_LAND = 0, TEGEL_WATER = 1, TEGEL_KLIP = 2;

export interface Terrein {
  breed: number;
  diep: number;
  hoogte: Int8Array;
}

// De vier hoeken van tegel (x, y), zoals je ze op het scherm ziet: achter, rechts, voor, links.
export function hoeken(t: Terrein, x: number, y: number): { a: number; r: number; v: number; l: number } {
  const s = t.breed + 1, h = t.hoogte, o = y * s + x;
  return { a: h[o], r: h[o + 1], v: h[o + s + 1], l: h[o + s] };
}

// Knikt deze tegel van links naar rechts (anders van achter naar voor)? Altijd langs de hoeken die het minst verschillen,
// zodat één hoge hoek een bultje wordt en geen vouw door de hele tegel.
export const knikLinksRechts = (a: number, r: number, v: number, l: number) => Math.abs(a - v) > Math.abs(r - l);

// De hoogte van de grond op een plek (kommagetallen, in niveaus). Buiten de kaart: de dichtstbijzijnde rand.
export function hoogteOp(t: Terrein, x: number, y: number): number {
  const u = Math.max(0, Math.min(t.breed, x + 0.5)), w = Math.max(0, Math.min(t.diep, y + 0.5));
  const i = Math.min(t.breed - 1, Math.floor(u)), j = Math.min(t.diep - 1, Math.floor(w));
  const f = u - i, g = w - j;
  const { a, r, v, l } = hoeken(t, i, j);
  if (knikLinksRechts(a, r, v, l))
    return f + g < 1 ? a + f * (r - a) + g * (l - a) : v + (1 - f) * (l - v) + (1 - g) * (r - v);
  return f > g ? a + f * (r - a) + g * (v - r) : a + g * (l - a) + f * (v - l);
}

// Welke tegel zie je op dit punt van de wereld (in schermpixels, zonder zoom)? We lopen langs de kijklijn van hoog naar
// laag: de eerste grond die we raken is wat vooraan staat, dus klikken op een heuvel raakt de heuvel en niet wat erachter ligt.
export function tegelOnder(t: Terrein, px: number, py: number): { kol: number; rij: number } {
  const a = px / (TEGEL_B / 2);
  for (let z = HOOGTE_MAX; ; z -= 0.125) {
    const b = (py + z * HOOGTE_PX) / (TEGEL_H / 2);
    const x = (a + b) / 2, y = (b - a) / 2;
    if (z <= HOOGTE_MIN || hoogteOp(t, x, y) >= z) return { kol: Math.round(x), rij: Math.round(y) };
  }
}

// Gladde ruis van -1 tot ongeveer 1: Perlin, met drie lagen die steeds fijner en zwakker worden.
function maakRuis(stroom: { toeval: number }): (x: number, y: number) => number {
  const p = new Uint8Array(512);
  const volgorde = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(volgende(stroom) * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = volgorde[i & 255];
  const zacht = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const helling = (h: number, x: number, y: number) => {
    const u = h & 1 ? x : y, v = h & 1 ? y : x;
    return (h & 2 ? -u : u) + (h & 4 ? -0.5 * v : 0.5 * v);
  };
  const laag = (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j;
    const I = i & 255, J = j & 255, u = zacht(f), w = zacht(g);
    const aa = helling(p[p[I] + J], f, g), ba = helling(p[p[I + 1] + J], f - 1, g);
    const ab = helling(p[p[I] + J + 1], f, g - 1), bb = helling(p[p[I + 1] + J + 1], f - 1, g - 1);
    return aa + u * (ba - aa) + w * (ab - aa + u * (bb - ab - ba + aa));
  };
  return (x, y) => (laag(x, y) + 0.5 * laag(x * 2 + 17, y * 2 + 31) + 0.25 * laag(x * 4 + 53, y * 4 + 71)) / 1.2;
}

// De hoogtekaart van één wereld. Rond de schijf blijft het vlak: daar ligt je eigen land, en muizen moeten er af kunnen.
// Pas verderop komen heuvels, meren (wat onder de grond zakt) en plateaus met klippen eromheen.
export function maakHoogtes(breed: number, diep: number, ring: { x: number; y: number; r: number }, heuvels: Heuvels, stroom: { toeval: number }): Int8Array {
  const s = breed + 1, n = s * (diep + 1);
  const h = new Int8Array(n);
  const verhoogd = new Int8Array(n);
  const ruis = maakRuis(stroom), klipRuis = maakRuis(stroom);
  const v0 = ring.r + TERREIN_VLAK, v1 = ring.r + TERREIN_VOL;
  for (let j = 0; j <= diep; j++)
    for (let i = 0; i <= breed; i++) {
      const d = Math.hypot(i - 0.5 - ring.x, j - 0.5 - ring.y);
      const m = Math.max(0, Math.min(1, (d - v0) / (v1 - v0)));
      const waarde = (heuvels.basis + ruis(i / heuvels.schaal, j / heuvels.schaal) * heuvels.hoog) * m * m * (3 - 2 * m);
      // Een plateau gaat aan de rand van zijn gebied in één keer KLIP_HOOGTE omhoog; dicht bij de schijf loopt het uit in een helling.
      const plateau = klipRuis(i / heuvels.klipSchaal, j / heuvels.klipSchaal) > heuvels.klipDrempel ? Math.round(KLIP_HOOGTE * m) : 0;
      verhoogd[j * s + i] = plateau;
      h[j * s + i] = Math.max(HOOGTE_MIN, Math.min(HOOGTE_MAX, Math.round(waarde) + plateau));
    }
  // Kleine plateaus eruit: daar komt alleen een snipper wand van.
  const buren = [-1, 1, -s, s, -s - 1, -s + 1, s - 1, s + 1];
  const naast = (o: number, a: number) => a >= 0 && a < n && Math.abs((a % s) - (o % s)) <= 1;
  const gezien = new Uint8Array(n);
  for (let o = 0; o < n; o++) {
    if (verhoogd[o] < KLIP_HOOGTE || gezien[o]) continue;
    const blob = [o];
    gezien[o] = 1;
    for (let i = 0; i < blob.length; i++)
      for (const b of buren) {
        const a = blob[i] + b;
        if (naast(blob[i], a) && !gezien[a] && verhoogd[a] >= KLIP_HOOGTE) {
          gezien[a] = 1;
          blob.push(a);
        }
      }
    if (blob.length >= MIN_PLATEAU) continue;
    for (const c of blob) {
      h[c] = Math.max(HOOGTE_MIN, h[c] - verhoogd[c]);
      verhoogd[c] = 0;
    }
  }
  // Eén losse hoek die boven of onder al zijn buren uitsteekt is geen heuvel maar een puistje: gelijk trekken.
  for (let j = 1; j < diep; j++)
    for (let i = 1; i < breed; i++) {
      const o = j * s + i;
      let hoog = -99, laag = 99;
      for (const b of [-1, 1, -s, s, -s - 1, -s + 1, s - 1, s + 1]) {
        hoog = Math.max(hoog, h[o + b]);
        laag = Math.min(laag, h[o + b]);
      }
      if (h[o] > hoog) h[o] = hoog;
      else if (h[o] < laag) h[o] = laag;
    }
  // De rand van een plateau moet ook echt een wand zijn. Loopt de grond ernaast iets omhoog, dan zou het daar een helling
  // worden en houd je losse stukjes wand over; dus die grond zakt tot hij de volle wand onder zich heeft. Grond die hoger ligt
  // dan het plateau laten we met rust, en we graven hier geen water: de wand onderbreekt daar.
  for (let o = 0; o < n; o++) {
    if (verhoogd[o] < KLIP_HOOGTE) continue;
    for (const b of buren) {
      const a = o + b;
      if (!naast(o, a) || verhoogd[a] > 0 || h[a] > h[o]) continue;
      if (h[o] - h[a] < KLIP_HOOGTE) h[a] = Math.max(Math.min(0, h[a]), h[o] - KLIP_HOOGTE);
    }
  }
  // Buren schelen hooguit één niveau, behalve over de rand van een plateau: daar twee, en dat wordt een klip. Zo verschillen
  // de hoeken van een tegel nooit meer dan KLIP_HOOGTE, en is er een eindig aantal tegelvormen om te tekenen.
  // Dit verlaagt alleen, dus de vlakte rond de schijf blijft vlak.
  const beperk = (o: number): boolean => {
    let anders = false;
    for (const b of buren) {
      const a = o + b;
      if (!naast(o, a)) continue;
      const mag = Math.abs(verhoogd[o] - verhoogd[a]) >= KLIP_HOOGTE ? KLIP_HOOGTE : 1;
      if (h[o] > h[a] + mag) {
        h[o] = h[a] + mag;
        anders = true;
      }
    }
    return anders;
  };
  for (let anders = true; anders; ) {
    anders = false;
    for (let o = 0; o < n; o++) if (beperk(o)) anders = true;
    for (let o = n - 1; o >= 0; o--) if (beperk(o)) anders = true;
  }
  return h;
}

// Klippen korter dan MIN_KLIP tegels worden hellingen. Hun hoge hoeken zakken, en de grond eromheen zakt mee tot het weer
// een helling is. De hoeken van de lange klippen blijven staan, zodat die heel blijven.
export function ruimKorteKlippenOp(t: Terrein): void {
  const { breed, diep, hoogte: h } = t;
  const s = breed + 1, n = h.length;
  const buren = [-1, 1, -s, s, -s - 1, -s + 1, s - 1, s + 1];
  for (let ronde = 0; ronde < 8; ronde++) {
    const soort = tegelSoorten(t);
    const gezien = new Uint8Array(soort.length);
    const kort: number[][] = [];
    const vast = new Uint8Array(n);
    for (let o = 0; o < soort.length; o++) {
      if (soort[o] !== TEGEL_KLIP || gezien[o]) continue;
      const stuk = [o];
      gezien[o] = 1;
      for (let i = 0; i < stuk.length; i++) {
        const x = stuk[i] % breed, y = (stuk[i] - x) / breed;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= breed || ny >= diep) continue;
            const a = ny * breed + nx;
            if (soort[a] === TEGEL_KLIP && !gezien[a]) {
              gezien[a] = 1;
              stuk.push(a);
            }
          }
      }
      if (stuk.length < MIN_KLIP) kort.push(stuk);
      else
        for (const c of stuk) {
          const x = c % breed, y = (c - x) / breed;
          for (const q of [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1]) vast[q] = 1;
        }
    }
    if (!kort.length) return;
    const rij: number[] = [];
    for (const stuk of kort)
      for (const c of stuk) {
        const x = c % breed, y = (c - x) / breed;
        const { a, r, v, l } = hoeken(t, x, y), hoog = Math.max(a, r, v, l);
        for (const [q, w] of [[y * s + x, a], [y * s + x + 1, r], [(y + 1) * s + x + 1, v], [(y + 1) * s + x, l]] as [number, number][])
          if (w === hoog && !vast[q]) {
            h[q] = w - 1;
            rij.push(q);
          }
      }
    for (let i = 0; i < rij.length; i++) {
      const o = rij[i];
      for (const b of buren) {
        const a = o + b;
        if (a < 0 || a >= n || Math.abs((a % s) - (o % s)) > 1 || vast[a] || h[a] <= h[o] + 1) continue;
        h[a] = h[o] + 1;
        rij.push(a);
      }
    }
    houdKlippenBinnenPerk(t); // naast een vaste hoek kan het nu te steil zijn geworden
  }
}

// Debug (F1): een hele tegel een niveau omhoog of omlaag. Zijn buren gaan mee waar het verschil anders groter wordt dan
// KLIP_HOOGTE, want daar is geen tegelvorm voor. Raakt dat een hoek die vast moet blijven (je schijf), dan gebeurt er niets.
export function verschuifTegel(t: Terrein, x: number, y: number, d: 1 | -1, vast: (i: number, j: number) => boolean): boolean {
  const s = t.breed + 1, n = t.hoogte.length, h = t.hoogte.slice();
  const rij: number[] = [];
  for (const q of [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1]) {
    const nieuw = Math.max(HOOGTE_MIN, Math.min(HOOGTE_MAX, h[q] + d));
    if (nieuw === h[q]) continue;
    h[q] = nieuw;
    rij.push(q);
  }
  if (!rij.length) return false;
  for (let i = 0; i < rij.length; i++) {
    const o = rij[i];
    if (vast(o % s, Math.floor(o / s))) return false;
    for (const b of [-1, 1, -s, s, -s - 1, -s + 1, s - 1, s + 1]) {
      const a = o + b;
      if (a < 0 || a >= n || Math.abs((a % s) - (o % s)) > 1) continue;
      const verschil = d > 0 ? h[o] - h[a] : h[a] - h[o];
      if (verschil <= KLIP_HOOGTE) continue;
      h[a] = h[o] - d * KLIP_HOOGTE;
      rij.push(a);
    }
  }
  t.hoogte.set(h);
  return true;
}

// Wat voor tegel is dit? Hoeken die 2 of meer verschillen: klip. Alle hoeken op -1: water.
export function tegelSoorten(t: Terrein): Uint8Array {
  const soort = new Uint8Array(t.breed * t.diep);
  for (let y = 0; y < t.diep; y++)
    for (let x = 0; x < t.breed; x++) {
      const { a, r, v, l } = hoeken(t, x, y);
      const hoog = Math.max(a, r, v, l), laag = Math.min(a, r, v, l);
      soort[y * t.breed + x] = hoog - laag >= KLIP_HOOGTE ? TEGEL_KLIP : hoog === HOOGTE_MIN ? TEGEL_WATER : TEGEL_LAND;
    }
  return soort;
}

// Alle land dat je kunt bereiken vanaf (x, y), lopend zonder over klippen of water te gaan.
function bereik(t: Terrein, soort: Uint8Array, x: number, y: number, uit: Int32Array, merk: number): number {
  const stapel = [y * t.breed + x];
  uit[stapel[0]] = merk;
  let aantal = 0;
  while (stapel.length) {
    const o = stapel.pop() as number;
    aantal++;
    const i = o % t.breed;
    for (const b of [i > 0 ? o - 1 : -1, i < t.breed - 1 ? o + 1 : -1, o - t.breed, o + t.breed]) {
      if (b < 0 || b >= soort.length || uit[b] || soort[b] !== TEGEL_LAND) continue;
      uit[b] = merk;
      stapel.push(b);
    }
  }
  return aantal;
}

// Maak een klip begaanbaar: de hoge hoeken één niveau omlaag, dan is het een helling.
function maakOprit(t: Terrein, x: number, y: number): void {
  const s = t.breed + 1, { a, r, v, l } = hoeken(t, x, y), hoog = Math.max(a, r, v, l);
  for (const [i, j, w] of [[x, y, a], [x + 1, y, r], [x + 1, y + 1, v], [x, y + 1, l]])
    if (w === hoog) t.hoogte[j * s + i] -= 1;
}

// Een oprit kan een hoek naast hem te ver laten uitsteken. Trek die mee omlaag, zodat een tegel nooit meer dan KLIP_HOOGTE
// verschilt. Dit verlaagt alleen wat te hoog staat, dus de oprit blijft open.
function houdKlippenBinnenPerk(t: Terrein): void {
  const s = t.breed + 1, h = t.hoogte, n = h.length;
  const buren = [-1, 1, -s, s, -s - 1, -s + 1, s - 1, s + 1];
  for (let anders = true; anders; ) {
    anders = false;
    for (let o = 0; o < n; o++)
      for (const b of buren) {
        const a = o + b;
        if (a < 0 || a >= n || Math.abs((a % s) - (o % s)) > 1 || h[o] <= h[a] + KLIP_HOOGTE) continue;
        h[o] = h[a] + KLIP_HOOGTE;
        anders = true;
      }
  }
}

// Grote stukken land achter een klip krijgen een oprit, zodat de wereld niet in stukjes valt. Eilanden in het water
// laten we met rust (daar komen ooit boten), en kleine stukjes ook: daar komen ook geen grondstoffen op.
export function verbindLand(t: Terrein, start: { x: number; y: number }, stroom: { toeval: number }): void {
  const { breed, diep } = t;
  for (let ronde = 0; ronde < MAX_OPRITTEN; ronde++) {
    const soort = tegelSoorten(t);
    const gebied = new Int32Array(breed * diep);
    bereik(t, soort, start.x, start.y, gebied, 1);
    const grootte = [0, 0];
    for (let o = 0; o < gebied.length; o++)
      if (soort[o] === TEGEL_LAND && !gebied[o]) grootte[grootte.length] = bereik(t, soort, o % breed, Math.floor(o / breed), gebied, grootte.length);
    // klippen met aan de ene kant ons land en recht tegenover een groot stuk land waar we nog niet komen
    const kansen: { x: number; y: number; dx: number; dy: number; stuk: number }[] = [];
    for (let y = 1; y < diep - 1; y++)
      for (let x = 1; x < breed - 1; x++) {
        if (soort[y * breed + x] !== TEGEL_KLIP) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const hier = gebied[(y - dy) * breed + x - dx], daar = gebied[(y + dy) * breed + x + dx];
          if (hier === 1 && daar > 1 && grootte[daar] >= MIN_STUK) kansen.push({ x, y, dx, dy, stuk: daar });
        }
      }
    if (!kansen.length) return;
    // per stuk land één oprit, twee tegels breed als de klip ernaast doorloopt
    const gedaan = new Set<number>();
    for (let k = kansen.length - 1; k > 0; k--) {
      const j = Math.floor(volgende(stroom) * (k + 1));
      [kansen[k], kansen[j]] = [kansen[j], kansen[k]];
    }
    for (const k of kansen) {
      if (gedaan.has(k.stuk)) continue;
      gedaan.add(k.stuk);
      maakOprit(t, k.x, k.y);
      const zx = k.x + k.dy, zy = k.y + k.dx;
      if (soort[zy * breed + zx] === TEGEL_KLIP) maakOprit(t, zx, zy);
    }
    houdKlippenBinnenPerk(t);
  }
}
