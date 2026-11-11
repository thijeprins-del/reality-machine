// Mist van de wereld (fog of war). Per tegel: nog nooit gezien, eerder gezien, of nu in beeld van iemand van jou.
// Alleen regels, geen tekenwerk: het tekenen staat in wereldbeeld.ts. Geen toeval, dus de seed blijft hetzelfde spel geven.
import { MIST_UPDATE_SEC } from '../data/dimensies';

export const MIST_ONBEKEND = 0;
export const MIST_VERKEND = 1;
export const MIST_ZICHT = 2;

export interface Mist {
  breed: number;
  diep: number;
  toestand: Uint8Array;
  stempel: Uint32Array; // in welke ronde een tegel het laatst gezien werd
  ronde: number;
  lit: number[]; // tegels die nu in beeld zijn, zodat we niet de hele kaart hoeven af te lopen
  gewijzigd: number[]; // tegels die van toestand veranderden sinds het beeld het laatst keek
  alles: boolean; // te veel veranderd om bij te houden: het beeld tekent alles opnieuw
  klok: number;
  versie: number; // gaat omhoog als er iets veranderde: het beeld tekent alleen dan opnieuw
}

export interface Kijker {
  x: number;
  y: number;
  r: number; // zichtstraal in tegels
}

const MAX_GEWIJZIGD = 50000;

export function maakMist(breed: number, diep: number): Mist {
  return {
    breed, diep, toestand: new Uint8Array(breed * diep), stempel: new Uint32Array(breed * diep), ronde: 0,
    lit: [], gewijzigd: [], alles: true, klok: MIST_UPDATE_SEC, versie: 0,
  };
}

// Alles wat een kijker nu ziet wordt "nu in beeld"; wat eerder in beeld was en nu niet meer, blijft verkend.
// Alleen tegels die van toestand veranderen worden bijgehouden, zodat de kosten met het aantal kijkers meegroeien en niet met de kaart.
export function werkMist(m: Mist, sec: number, kijkers: () => Kijker[]): void {
  m.klok += sec;
  if (m.klok < MIST_UPDATE_SEC) return;
  m.klok = 0;
  const { breed, diep, toestand, stempel, gewijzigd } = m;
  const ronde = ++m.ronde;
  const nu: number[] = [];
  const wijzig = (i: number, t: number) => {
    toestand[i] = t;
    if (gewijzigd.length < MAX_GEWIJZIGD) gewijzigd.push(i);
    else m.alles = true;
  };
  for (const k of kijkers()) {
    const r2 = k.r * k.r;
    const y0 = Math.max(0, Math.floor(k.y - k.r)), y1 = Math.min(diep - 1, Math.ceil(k.y + k.r));
    const x0 = Math.max(0, Math.floor(k.x - k.r)), x1 = Math.min(breed - 1, Math.ceil(k.x + k.r));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * breed + x;
        if (stempel[i] === ronde || (x - k.x) ** 2 + (y - k.y) ** 2 > r2) continue;
        stempel[i] = ronde;
        nu.push(i);
        if (toestand[i] !== MIST_ZICHT) wijzig(i, MIST_ZICHT);
      }
  }
  for (const i of m.lit) if (stempel[i] !== ronde) wijzig(i, MIST_VERKEND);
  m.lit = nu;
  if (gewijzigd.length || m.alles) m.versie++;
}

// Is deze tegel ooit gezien? Voor regels die iets verborgen houden (bouwen, gericht sturen).
export function verkend(m: Mist, kol: number, rij: number): boolean {
  if (kol < 0 || rij < 0 || kol >= m.breed || rij >= m.diep) return false;
  return m.toestand[Math.floor(rij) * m.breed + Math.floor(kol)] !== MIST_ONBEKEND;
}
