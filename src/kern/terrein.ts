// Terrein: het land van een dimensie. Elke tegel heeft zijn EIGEN vier hoekhoogtes (achter, rechts, voor, links), in hele
// niveaus: `hoogte` telt vier getallen per tegel. Waar twee buren op hun gedeelde rand even hoog zijn, loopt de grond door.
// Waar ze verschillen staat er een wand, en daar kan niemand langs: een klip is dus geen tegel, maar een rand tussen twee
// tegels. Binnen een tegel schelen twee hoeken langs een rand hooguit één niveau, dus een tegel is altijd vlak of een helling.
// Zo is elke kaart te tekenen: het zijn blokken met een vlakke of schuine bovenkant.
// Tegel (x, y) loopt van x - 0,5 tot x + 0,5. Een schuine tegel is twee platte driehoeken; hoogteOp en het tekenen knikken
// langs dezelfde lijn.
import { HOOGTE_MAX, HOOGTE_MIN, HOOGTE_PX, MAX_OPRITTEN, MIN_PLATEAU, MIN_STUK, PLATEAU_VANAF, TERREIN_VLAK, TERREIN_VOL, type Heuvels } from '../data/dimensies';
import { TEGEL_B, TEGEL_H } from './iso';
import { volgende } from './toeval';

export const TEGEL_LAND = 0, TEGEL_WATER = 1;

export interface Terrein {
  breed: number;
  diep: number;
  hoogte: Int8Array; // per tegel vier hoeken: achter, rechts, voor, links
}

// De vier hoeken van tegel (x, y), zoals je ze op het scherm ziet: achter, rechts, voor, links.
export function hoeken(t: Terrein, x: number, y: number): { a: number; r: number; v: number; l: number } {
  const h = t.hoogte, o = (y * t.breed + x) * 4;
  return { a: h[o], r: h[o + 1], v: h[o + 2], l: h[o + 3] };
}

// Welke hoek van een tegel ligt op roosterpunt (tegel + (di, dj))? (0,0) achter, (1,0) rechts, (1,1) voor, (0,1) links.
const hoekVan = (di: number, dj: number) => (dj === 0 ? di : 3 - di);

// Loopt de grond door van tegel (x, y) naar zijn buur? naar = 0 is de buur (x + 1, y), naar = 1 de buur (x, y + 1).
// Alleen als de rand aan beide einden even hoog is; anders staat er een wand.
export function randOpen(t: Terrein, x: number, y: number, naar: 0 | 1): boolean {
  const h = t.hoogte, o = (y * t.breed + x) * 4, b = naar === 0 ? o + 4 : o + t.breed * 4;
  return naar === 0 ? h[o + 1] === h[b] && h[o + 2] === h[b + 3] : h[o + 3] === h[b] && h[o + 2] === h[b + 1];
}

// Per tegel: bit 1 = je kunt lopend naar (x + 1, y), bit 2 = naar (x, y + 1). Alleen land, en alleen waar de grond doorloopt.
export function openRanden(t: Terrein, soort: Uint8Array): Uint8Array {
  const { breed, diep } = t, open = new Uint8Array(breed * diep);
  for (let y = 0; y < diep; y++)
    for (let x = 0; x < breed; x++) {
      const o = y * breed + x;
      if (soort[o] !== TEGEL_LAND) continue;
      if (x < breed - 1 && soort[o + 1] === TEGEL_LAND && randOpen(t, x, y, 0)) open[o] |= 1;
      if (y < diep - 1 && soort[o + breed] === TEGEL_LAND && randOpen(t, x, y, 1)) open[o] |= 2;
    }
  return open;
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

// Wat voor tegel is dit? Alle hoeken op de laagste hoogte: water. Anders land.
export function tegelSoorten(t: Terrein): Uint8Array {
  const soort = new Uint8Array(t.breed * t.diep), h = t.hoogte;
  for (let o = 0; o < soort.length; o++)
    soort[o] = Math.max(h[o * 4], h[o * 4 + 1], h[o * 4 + 2], h[o * 4 + 3]) === HOOGTE_MIN ? TEGEL_WATER : TEGEL_LAND;
  return soort;
}

// Al het land in stukken waar je lopend kunt komen. Stuk 1 is het land rond de start; water is 0.
function gebieden(t: Terrein, soort: Uint8Array, start: { x: number; y: number }): { gebied: Int32Array; grootte: number[] } {
  const { breed } = t, open = openRanden(t, soort);
  const gebied = new Int32Array(soort.length), grootte = [0];
  const vul = (begin: number, merk: number): number => {
    const stapel = [begin];
    gebied[begin] = merk;
    let aantal = 0;
    while (stapel.length) {
      const o = stapel.pop() as number, x = o % breed;
      aantal++;
      const buren = [
        x < breed - 1 && open[o] & 1 ? o + 1 : -1,
        x > 0 && open[o - 1] & 1 ? o - 1 : -1,
        o + breed < gebied.length && open[o] & 2 ? o + breed : -1,
        o >= breed && open[o - breed] & 2 ? o - breed : -1,
      ];
      for (const b of buren) {
        if (b < 0 || gebied[b]) continue;
        gebied[b] = merk;
        stapel.push(b);
      }
    }
    return aantal;
  };
  grootte.push(vul(start.y * breed + start.x, 1));
  for (let o = 0; o < gebied.length; o++) if (soort[o] === TEGEL_LAND && !gebied[o]) grootte.push(vul(o, grootte.length));
  return { gebied, grootte };
}

// Het land van één wereld. Eerst glooiend land uit ruis: heuvels, en meren waar het onder de grond zakt. Rond de schijf blijft
// het vlak, want daar ligt je eigen land en komen de kleppen op de grond (kaart.ts zet die er daarna in). Dan plateaus: hele tegels die een paar niveaus omhoog
// gaan, met een wand eromheen. Elk plateau krijgt een oprit, of het verdwijnt weer.
export function maakTerrein(breed: number, diep: number, ring: { x: number; y: number; r: number }, heuvels: Heuvels, stroom: { toeval: number }, start: { x: number; y: number }): Terrein {
  const s = breed + 1, n = s * (diep + 1);
  const c = new Int8Array(n); // het glooiende land: één hoogte per roosterhoek, buren schelen hooguit één niveau
  const ruis = maakRuis(stroom), klipRuis = maakRuis(stroom);
  const v0 = ring.r + TERREIN_VLAK, v1 = ring.r + TERREIN_VOL;
  const mate = (x: number, y: number) => Math.max(0, Math.min(1, (Math.hypot(x - ring.x, y - ring.y) - v0) / (v1 - v0)));
  for (let j = 0; j <= diep; j++)
    for (let i = 0; i <= breed; i++) {
      const m = mate(i - 0.5, j - 0.5);
      const waarde = (heuvels.basis + ruis(i / heuvels.schaal, j / heuvels.schaal) * heuvels.hoog) * m * m * (3 - 2 * m);
      c[j * s + i] = Math.max(HOOGTE_MIN, Math.min(HOOGTE_MAX, Math.round(waarde)));
    }
  const buren = [-1, 1, -s, s, -s - 1, -s + 1, s - 1, s + 1];
  // Eén losse hoek die boven of onder al zijn buren uitsteekt is geen heuvel maar een puistje: gelijk trekken.
  for (let j = 1; j < diep; j++)
    for (let i = 1; i < breed; i++) {
      const o = j * s + i;
      let hoog = -99, laag = 99;
      for (const b of buren) {
        hoog = Math.max(hoog, c[o + b]);
        laag = Math.min(laag, c[o + b]);
      }
      if (c[o] > hoog) c[o] = hoog;
      else if (c[o] < laag) c[o] = laag;
    }
  // Buren schelen hooguit één niveau, ook schuin. Dit verlaagt alleen, dus de vlakte rond de schijf blijft vlak.
  const beperk = (o: number): boolean => {
    let anders = false;
    for (const b of buren) {
      const a = o + b;
      if (a < 0 || a >= n || Math.abs((a % s) - (o % s)) > 1 || c[o] <= c[a] + 1) continue;
      c[o] = c[a] + 1;
      anders = true;
    }
    return anders;
  };
  for (let anders = true; anders; ) {
    anders = false;
    for (let o = 0; o < n; o++) if (beperk(o)) anders = true;
    for (let o = n - 1; o >= 0; o--) if (beperk(o)) anders = true;
  }

  // Plateaus: tegels waar de tweede ruis hoog is, een eind van de schijf af.
  const plateau = new Uint8Array(breed * diep);
  for (let y = 0; y < diep; y++)
    for (let x = 0; x < breed; x++)
      if (mate(x, y) >= PLATEAU_VANAF && klipRuis((x + 0.5) / heuvels.klipSchaal, (y + 0.5) / heuvels.klipSchaal) > heuvels.klipDrempel) plateau[y * breed + x] = 1;
  // De rand gladstrijken: uitsteeksels van één tegel eraf, inhammen van één tegel dicht.
  const buurPlateaus = (x: number, y: number) =>
    (x > 0 ? plateau[y * breed + x - 1] : 0) + (x < breed - 1 ? plateau[y * breed + x + 1] : 0) + (y > 0 ? plateau[(y - 1) * breed + x] : 0) + (y < diep - 1 ? plateau[(y + 1) * breed + x] : 0);
  for (let ronde = 0; ronde < 3; ronde++)
    for (let y = 0; y < diep; y++)
      for (let x = 0; x < breed; x++) {
        const b = buurPlateaus(x, y), o = y * breed + x;
        if (plateau[o] && b <= 1) plateau[o] = 0;
        else if (!plateau[o] && b >= 3 && mate(x, y) >= PLATEAU_VANAF) plateau[o] = 1;
      }
  // Elk plateau als los stuk; te kleine stukken vervallen.
  const stukVan = new Int32Array(breed * diep);
  const stukken: number[][] = [[]];
  for (let o = 0; o < plateau.length; o++) {
    if (!plateau[o] || stukVan[o]) continue;
    const stuk = [o];
    stukVan[o] = stukken.length;
    for (let i = 0; i < stuk.length; i++) {
      const x = stuk[i] % breed;
      for (const b of [x > 0 ? stuk[i] - 1 : -1, x < breed - 1 ? stuk[i] + 1 : -1, stuk[i] - breed, stuk[i] + breed]) {
        if (b < 0 || b >= plateau.length || !plateau[b] || stukVan[b]) continue;
        stukVan[b] = stukken.length;
        stuk.push(b);
      }
    }
    stukken.push(stuk);
  }
  for (const stuk of stukken) if (stuk.length < MIN_PLATEAU) for (const o of stuk) plateau[o] = 0;

  const t: Terrein = { breed, diep, hoogte: new Int8Array(breed * diep * 4) };
  const zetTegel = (o: number) => {
    const x = o % breed, q = ((o - x) / breed) * s + x, p = plateau[o] ? heuvels.klipHoog : 0;
    [c[q], c[q + 1], c[q + s + 1], c[q + s]].forEach((z, i) => (t.hoogte[o * 4 + i] = Math.min(HOOGTE_MAX, z + p)));
  };
  for (let o = 0; o < plateau.length; o++) zetTegel(o);

  // Opritten. Een oprit is klipHoog tegels lang en ligt in het plateau: elke tegel een niveau hoger dan de vorige, tot hij
  // bovenaan aansluit. Hij verbindt land waar je al kunt komen met een groot stuk waar je nog niet kunt komen, omhoog of omlaag.
  const K = heuvels.klipHoog;
  const oprit = new Uint8Array(breed * diep);
  const richtingen = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // de twee roosterhoeken waar de oprit begint: de rand tussen het lage land en de eerste tegel van de oprit
  const beginHoeken = (x: number, y: number, dx: number, dy: number) =>
    dx === 1 ? [[x, y], [x, y + 1]] : dx === -1 ? [[x + 1, y], [x + 1, y + 1]] : dy === 1 ? [[x, y], [x + 1, y]] : [[x, y + 1], [x + 1, y + 1]];
  const legOprit = (x: number, y: number, dx: number, dy: number) => {
    for (let i = 0; i < K; i++) {
      const tx = x + i * dx, ty = y + i * dy;
      oprit[ty * breed + tx] = 1;
      for (const [i0, j0] of beginHoeken(x, y, dx, dy))
        for (const k of [i, i + 1]) {
          const z = Math.min(c[j0 * s + i0] + k, c[(j0 + K * dy) * s + i0 + K * dx] + K, HOOGTE_MAX);
          t.hoogte[(ty * breed + tx) * 4 + hoekVan(i0 + k * dx - tx, j0 + k * dy - ty)] = z;
        }
    }
  };
  for (let ronde = 0; ronde < MAX_OPRITTEN; ronde++) {
    const soort = tegelSoorten(t);
    const { gebied, grootte } = gebieden(t, soort, start);
    const kansen: { x: number; y: number; r: number; stuk: number }[] = [];
    for (let y = 0; y < diep; y++)
      for (let x = 0; x < breed; x++) {
        if (!plateau[y * breed + x] || oprit[y * breed + x]) continue;
        richtingen.forEach(([dx, dy], r) => {
          const ax = x - dx, ay = y - dy, ex = x + K * dx, ey = y + K * dy;
          if (ax < 0 || ay < 0 || ax >= breed || ay >= diep || ex < 0 || ey < 0 || ex >= breed || ey >= diep) return;
          const A = ay * breed + ax;
          if (plateau[A] || oprit[A] || soort[A] !== TEGEL_LAND) return;
          // de oprit zelf en de tegel waar hij op uitkomt moeten plateau zijn
          for (let i = 0; i <= K; i++) {
            const o = (y + i * dy) * breed + x + i * dx;
            if (!plateau[o] || oprit[o]) return;
          }
          const boven = gebied[ey * breed + ex], onder = gebied[A];
          if ((boven === 1) === (onder === 1)) return; // precies één kant moet al bereikbaar zijn
          const stuk = boven === 1 ? onder : boven;
          if (grootte[stuk] < MIN_STUK) return;
          // het land eronder mag onder de oprit niet oplopen, anders wordt hij te steil
          for (const [i0, j0] of beginHoeken(x, y, dx, dy)) if (c[(j0 + K * dy) * s + i0 + K * dx] > c[j0 * s + i0]) return;
          kansen.push({ x, y, r, stuk });
        });
      }
    if (!kansen.length) break;
    for (let k = kansen.length - 1; k > 0; k--) {
      const j = Math.floor(volgende(stroom) * (k + 1));
      [kansen[k], kansen[j]] = [kansen[j], kansen[k]];
    }
    // per stuk land één oprit, twee tegels breed als dat kan
    const gedaan = new Set<number>();
    for (const k of kansen) {
      if (gedaan.has(k.stuk)) continue;
      gedaan.add(k.stuk);
      const [dx, dy] = richtingen[k.r];
      legOprit(k.x, k.y, dx, dy);
      const naast = kansen.find((n2) => n2.r === k.r && n2.stuk === k.stuk && Math.abs(n2.x - k.x) === Math.abs(dy) && Math.abs(n2.y - k.y) === Math.abs(dx));
      if (naast) legOprit(naast.x, naast.y, dx, dy);
    }
  }
  // Een plateau waar je nog steeds niet op kunt komen, verdwijnt: het zou alleen maar land afsnijden.
  const { gebied } = gebieden(t, tegelSoorten(t), start);
  for (const stuk of stukken) {
    if (!stuk.length || !plateau[stuk[0]] || stuk.some((o) => gebied[o] === 1)) continue;
    for (const o of stuk) {
      plateau[o] = 0;
      zetTegel(o);
    }
  }
  return t;
}

// Terreinbewerker: zet hoeken van tegels op een nieuwe hoogte. Sleutel = tegel * 4 + hoek (0 achter, 1 rechts, 2 voor, 3 links).
// samen = hoeken van buren die op die plek even hoog lagen gaan mee, zodat glooiend land glooiend blijft; anders scheurt de
// tegel los van zijn buren en komt er een wand. Een tegel blijft altijd vlak of een helling: zijn andere hoeken schuiven zo
// nodig mee. Raakt het een tegel die vast ligt (je schijf), dan gebeurt er niets.
export function verzetHoeken(t: Terrein, doelen: Map<number, number>, samen: boolean, vast: (tegel: number) => boolean): boolean {
  const { breed, diep } = t, h = t.hoogte.slice();
  const werk: [number, number][] = [...doelen];
  let anders = false;
  for (let i = 0; i < werk.length; i++) {
    if (i > 400000) return false;
    const [q, z] = werk[i], oud = h[q];
    if (oud === z) continue;
    const tegel = q >> 2, hoek = q & 3;
    if (vast(tegel)) return false;
    h[q] = z;
    anders = true;
    // de twee hoeken ernaast in dezelfde tegel: hooguit één niveau verschil langs een rand
    for (const b of [(hoek + 1) & 3, (hoek + 3) & 3]) {
      const w = h[tegel * 4 + b];
      if (Math.abs(w - z) > 1) werk.push([tegel * 4 + b, w < z ? z - 1 : z + 1]);
    }
    if (!samen) continue;
    // hetzelfde roosterpunt in de drie tegels eromheen
    const x = tegel % breed, y = (tegel - x) / breed;
    const gi = x + (hoek === 1 || hoek === 2 ? 1 : 0), gj = y + (hoek >= 2 ? 1 : 0);
    for (const [tx, ty] of [[gi - 1, gj - 1], [gi, gj - 1], [gi - 1, gj], [gi, gj]]) {
      if (tx < 0 || ty < 0 || tx >= breed || ty >= diep || (tx === x && ty === y)) continue;
      const q2 = (ty * breed + tx) * 4 + hoekVan(gi - tx, gj - ty);
      if (h[q2] === oud) werk.push([q2, z]);
    }
  }
  if (!anders) return false;
  t.hoogte.set(h);
  return true;
}
