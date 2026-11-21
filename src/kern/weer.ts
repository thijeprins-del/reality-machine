// Het weer van een shift-regel (data/regels.ts): donkerte en regen als laag over het spel. Alleen beeld, geen regels.
// Een canvas boven het Pixi-canvas en onder de knoppen; het vangt geen klikken.
import { regelVan } from '../land/wrath';
import type { SpelStaat } from './spel';

interface Druppel { x: number; y: number; v: number; l: number }

export function maakWeer(): { werk(s: SpelStaat, sec: number): void } {
  const cv = document.createElement('canvas');
  cv.id = 'weer';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;display:none';
  document.body.append(cv);
  const ctx = cv.getContext('2d')!;
  const druppels: Druppel[] = [];
  let donker = 0; // geleidelijk, zodat de landing zacht overgaat
  return {
    werk(s, sec) {
      const r = s.onderweg > 0 ? null : regelVan(s);
      const doel = r?.donker ?? 0;
      donker += (doel - donker) * Math.min(1, sec * 2);
      const regen = !!r?.regen;
      if (donker < 0.01 && !regen) { cv.style.display = 'none'; return; }
      cv.style.display = 'block';
      const b = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(b * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(b * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, b, h);
      if (donker >= 0.01) {
        const g = ctx.createRadialGradient(b / 2, h / 2, Math.min(b, h) * 0.2, b / 2, h / 2, Math.max(b, h) * 0.7);
        g.addColorStop(0, `rgba(6,8,28,${donker * 0.55})`);
        g.addColorStop(1, `rgba(2,3,14,${Math.min(0.9, donker * 1.4)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, b, h);
      }
      if (regen) {
        const doelAantal = Math.min(260, Math.round((b * h) / 5000));
        while (druppels.length < doelAantal) druppels.push({ x: Math.random() * b, y: Math.random() * h, v: 700 + Math.random() * 500, l: 8 + Math.random() * 10 });
        ctx.strokeStyle = 'rgba(170,200,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of druppels) {
          d.y += d.v * sec;
          d.x -= d.v * 0.25 * sec;
          if (d.y > h || d.x < -20) { d.y = -d.l; d.x = Math.random() * (b + 120); }
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.l * 0.25, d.y - d.l);
        }
        ctx.stroke();
      } else druppels.length = 0;
    },
  };
}
