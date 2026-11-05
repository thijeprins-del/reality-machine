// Routes: waar eenheden kunnen komen en hoe ze er komen. Een Doorgang is wat één manier van bewegen kan: nu alleen lopen
// (`Kaart.lopen`). Boten of veerponten krijgen later een eigen Doorgang met het water als vrije tegels; de rest blijft gelijk.
// Honderden muizen naar één doel delen één richtingenkaart, dus het zoeken kost niet meer als de zwerm groter is.
export interface Doorgang {
  breed: number;
  diep: number;
  vrij: Uint8Array; // per tegel: 1 = hier kun je staan, en je kunt er komen vanaf je eigen land
  velden: Map<number, Int8Array>; // doeltegel -> per tegel de richting naar dat doel
}

const MAX_VELDEN = 256; // zoveel richtingenkaarten bewaren we; de oudste gaat eruit
const VOORUIT = 8; // zo veel stappen kijkt een eenheid vooruit om een rechte lijn te kunnen lopen
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];
const HIER = 8, ONBEREIKBAAR = -1;

export function vrijOp(d: Doorgang, x: number, y: number): boolean {
  const i = Math.round(x), j = Math.round(y);
  return i >= 0 && j >= 0 && i < d.breed && j < d.diep && d.vrij[j * d.breed + i] === 1;
}

// Kun je rechtdoor lopen? We prikken elke 0,2 tegel; een hoekje van een klip mag een muis net raken.
export function vrijeLijn(d: Doorgang, x0: number, y0: number, x1: number, y1: number): boolean {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.2);
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    if (!vrijOp(d, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

// De dichtstbijzijnde tegel waar je wel kunt staan, voor een klik op water of een klip.
export function dichtstbijVrij(d: Doorgang, x: number, y: number): { x: number; y: number } {
  const i0 = Math.round(x), j0 = Math.round(y);
  for (let r = 0; r < d.breed + d.diep; r++) {
    let beste: { x: number; y: number } | null = null, afst = Infinity;
    for (let j = j0 - r; j <= j0 + r; j++)
      for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || !vrijOp(d, i, j)) continue;
        const a = Math.hypot(i - x, j - y);
        if (a < afst) [beste, afst] = [{ x: i, y: j }, a];
      }
    if (beste) return beste;
  }
  return { x, y };
}

// Vanaf het doel naar buiten rekenen, recht 10 en schuin 14. Twee rijen op volgorde houden dit snel zonder heap.
// Schuin alleen als beide tegels ernaast vrij zijn: niet langs de hoek van een klip snijden.
function maakVeld(d: Doorgang, doel: number): Int8Array {
  const { breed, diep, vrij } = d;
  const naar = new Int8Array(breed * diep).fill(ONBEREIKBAAR);
  const kost = new Int32Array(breed * diep).fill(0x7fffffff);
  const recht = [doel], schuin: number[] = [];
  let r = 0, s = 0;
  kost[doel] = 0;
  naar[doel] = HIER;
  const tegenover = [1, 0, 3, 2, 7, 6, 5, 4];
  while (r < recht.length || s < schuin.length) {
    const neemRecht = s >= schuin.length || (r < recht.length && kost[recht[r] & 0xffffff] <= kost[schuin[s] & 0xffffff]);
    const o = neemRecht ? recht[r++] : schuin[s++];
    const x = o % breed, y = (o - x) / breed;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= breed || ny >= diep) continue;
      const n = ny * breed + nx;
      if (!vrij[n]) continue;
      if (k >= 4 && !(vrij[y * breed + nx] && vrij[ny * breed + x])) continue;
      const nieuw = kost[o] + (k < 4 ? 10 : 14);
      if (nieuw >= kost[n]) continue;
      kost[n] = nieuw;
      naar[n] = tegenover[k];
      (k < 4 ? recht : schuin).push(n);
    }
  }
  return naar;
}

function veldNaar(d: Doorgang, doel: number): Int8Array {
  let v = d.velden.get(doel);
  if (v) {
    d.velden.delete(doel); // achteraan: net gebruikt
  } else {
    v = maakVeld(d, doel);
    if (d.velden.size >= MAX_VELDEN) d.velden.delete(d.velden.keys().next().value as number);
  }
  d.velden.set(doel, v);
  return v;
}

// Het volgende punt op weg naar het doel, of null als je rechtdoor kunt. `ox` en `oy` zijn de eigen afwijking van een
// eenheid binnen een tegel, zodat een zwerm niet in één rij over de tegelmiddens loopt.
export function routePunt(d: Doorgang, x: number, y: number, doelX: number, doelY: number, ox: number, oy: number): { x: number; y: number } | null {
  if (vrijeLijn(d, x, y, doelX, doelY)) return null;
  if (!vrijOp(d, x, y)) return dichtstbijVrij(d, x, y); // staat ergens waar het niet kan: eerst terug op vrije grond
  const veld = veldNaar(d, Math.round(doelY) * d.breed + Math.round(doelX));
  let i = Math.round(x), j = Math.round(y);
  let punt: { x: number; y: number } | null = null;
  for (let stap = 0; stap < VOORUIT; stap++) {
    const k = veld[j * d.breed + i];
    if (k === HIER || k === ONBEREIKBAAR) break;
    i += DX[k];
    j += DY[k];
    const p = { x: i + ox, y: j + oy };
    if (!punt || vrijeLijn(d, x, y, p.x, p.y)) punt = p;
    else break;
  }
  return punt;
}
