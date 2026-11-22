// Minikaart: een vierkantje linksboven met het land (grond/water), de machine, je ratten en wat de camera ziet.
// Met mist aan (toets F of knop FOG) laat hij alleen zien wat je al verkend hebt. Klik of sleep om de camera te verplaatsen.
import type { Container } from 'pixi.js';
import { knop } from './scherm';
import { MIST_VERKEND, MIST_ZICHT, mistStand, zetMistAan } from './mist';
import type { SpelStaat } from './spel';
import { tegelOnder, TEGEL_WATER } from './terrein';

const MAX_PX = 150; // grootste zijde in beeldpunten
const VERVERS_SEC = 0.25;

export function maakMinikaart(wereld: Container, staat: () => SpelStaat, kijkNaar: (kol: number, rij: number) => void): { werk(sec: number): void } {
  const cv = document.createElement('canvas');
  cv.id = 'minikaart';
  cv.title = 'Minimap: click to look there. F toggles fog of war.';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d')!;

  const fogKnop = knop('FOG', 'fog of war on/off (F)', () => zetFog(!mistStand.aan));
  const zetFog = (aan: boolean) => {
    zetMistAan(aan);
    fogKnop.classList.toggle('aan', aan);
    klok = VERVERS_SEC;
  };
  fogKnop.classList.toggle('aan', mistStand.aan);
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    zetFog(!mistStand.aan);
  });

  let img: ImageData | null = null;
  let voorKaart: object | null = null;
  const naarTegel = (e: PointerEvent) => {
    const k = staat().kaart, r = cv.getBoundingClientRect();
    kijkNaar(Math.max(0, Math.min(k.breed - 1, ((e.clientX - r.left) / r.width) * k.breed)), Math.max(0, Math.min(k.diep - 1, ((e.clientY - r.top) / r.height) * k.diep)));
  };
  let sleept = false;
  cv.addEventListener('pointerdown', (e) => { e.stopPropagation(); sleept = true; cv.setPointerCapture(e.pointerId); naarTegel(e); });
  cv.addEventListener('pointermove', (e) => { if (sleept) naarTegel(e); });
  cv.addEventListener('pointerup', () => { sleept = false; });

  let klok = VERVERS_SEC;
  return {
    werk(sec) {
      const s = staat();
      cv.style.display = s.onderweg > 0 ? 'none' : 'block';
      if (s.onderweg > 0) return;
      klok += sec;
      if (klok < VERVERS_SEC) return;
      klok = 0;
      const k = s.kaart, m = k.mist, fog = mistStand.aan;
      if (voorKaart !== k) {
        voorKaart = k;
        const f = Math.min(1, MAX_PX / Math.max(k.breed, k.diep));
        cv.width = k.breed;
        cv.height = k.diep;
        cv.style.width = `${Math.round(k.breed * f)}px`;
        cv.style.height = `${Math.round(k.diep * f)}px`;
        img = ctx.createImageData(k.breed, k.diep);
      }
      const d = img!.data;
      for (let i = 0; i < k.soort.length; i++) {
        const t = m.toestand[i], water = k.soort[i] === TEGEL_WATER;
        let r = water ? 26 : 74, g = water ? 52 : 82, b = water ? 80 : 58;
        if (fog && t !== MIST_ZICHT) {
          const f = t === MIST_VERKEND ? 0.55 : 0;
          r *= f; g *= f; b *= f;
        }
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img!, 0, 0);
      const punt = (x: number, y: number, kleur: string, z = 1.5) => {
        ctx.fillStyle = kleur;
        ctx.fillRect(Math.round(x - z / 2), Math.round(y - z / 2), z, z);
      };
      const zichtbaar = (x: number, y: number) => !fog || m.toestand[Math.round(y) * m.breed + Math.round(x)] === MIST_ZICHT;
      ctx.strokeStyle = '#e0c040';
      ctx.lineWidth = Math.max(1, k.breed / 100);
      ctx.beginPath();
      ctx.arc(k.ring.x, k.ring.y, k.ring.r, 0, Math.PI * 2);
      ctx.stroke();
      const dot = Math.max(2, k.breed / 50);
      for (const w of s.werkers) punt(w.x, w.y, '#9dff2e', dot);
      for (const o of s.land.raiders) if (zichtbaar(o.x, o.y)) punt(o.x, o.y, '#ff4a3a', dot);
      // wat de camera nu ziet: de vier schermhoeken als tegels
      const hoek = (x: number, y: number) => {
        const p = wereld.toLocal({ x, y });
        const t = tegelOnder(k, p.x, p.y);
        return [t.kol, t.rij];
      };
      const w = innerWidth, h = innerHeight;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, k.breed / 120);
      ctx.beginPath();
      [hoek(0, 0), hoek(w, 0), hoek(w, h), hoek(0, h)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    },
  };
}
