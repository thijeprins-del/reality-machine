// Camera en besturing. Muis: slepen = selecteren (shift = erbij), dubbelklik = alle eenheden in beeld,
// rechtsklik = opdracht, middelste knop slepen = kijken, scrollen = zoomen.
// Toetsen: WASD of pijlen = kijken, Esc = niets geselecteerd, spatie = terug naar de machine.
import { Graphics, type Application, type Container } from 'pixi.js';
import { naarScherm, TEGEL_B, TEGEL_H } from './iso';
import type { SpelStaat } from './spel';
import type { TerreinBewerker } from './terreinbewerker';
import { hoogteOp, tegelOnder } from './terrein';

export interface Besturing {
  selectie: Set<number>;
  werk(sec: number): void;
}

// Scherm (in de wereld-container) naar de tegel eronder, op vlakke grond. Met heuvels: tegelOnder in terrein.ts.
export function naarTegel(x: number, y: number): { kol: number; rij: number } {
  const a = x / (TEGEL_B / 2), b = y / (TEGEL_H / 2);
  return { kol: Math.round((a + b) / 2), rij: Math.round((b - a) / 2) };
}

export function maakBesturing(
  app: Application,
  wereld: Container,
  staat: () => SpelStaat,
  opZoom: (z: number) => void,
  opdracht: (ids: number[], kol: number, rij: number) => void,
  bewerker?: TerreinBewerker, // testgereedschap (F2): als het open staat, verft de linkerknop terrein
): Besturing {
  const selectie = new Set<number>();
  const kader = new Graphics();
  app.stage.addChild(kader);
  const canvas = app.canvas;

  let zoom = app.screen.width > 2400 ? 2 : 1;
  // camera = het wereldpunt in het midden van het scherm
  let m = staat().kaart.machine;
  const startPunt = () => naarScherm(m.x + m.breed / 2, m.y + m.diep / 2);
  const cam = { x: startPunt().x + 60, y: startPunt().y - 110 };
  const zet = () => {
    const k = staat().kaart;
    cam.x = Math.max(naarScherm(0, k.diep).x, Math.min(naarScherm(k.breed, 0).x, cam.x));
    cam.y = Math.max(0, Math.min(naarScherm(k.breed, k.diep).y, cam.y));
    wereld.scale.set(zoom);
    wereld.position.set(Math.round(app.screen.width / 2 - cam.x * zoom), Math.round(app.screen.height / 2 - cam.y * zoom));
    opZoom(zoom);
  };
  zet();
  app.renderer.on('resize', zet);

  const toetsen = new Set<string>();
  window.addEventListener('keydown', (e) => {
    toetsen.add(e.key.toLowerCase());
    if (e.key === 'Escape') selectie.clear();
    if (e.key === ' ') {
      const start = startPunt();
      cam.x = start.x;
      cam.y = start.y;
      zet();
    }
  });
  window.addEventListener('keyup', (e) => toetsen.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => toetsen.clear());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.min(4, Math.max(1, zoom + (e.deltaY < 0 ? 1 : -1)));
    zet();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // werker-posities op het scherm
  const opScherm = (x: number, y: number) => {
    const p = naarScherm(x, y, hoogteOp(staat().kaart, x, y));
    return { x: wereld.position.x + p.x * zoom, y: wereld.position.y + (p.y - 8) * zoom };
  };

  let sleep: { x0: number; y0: number; x1: number; y1: number; extra: boolean } | null = null;
  let kijk: { x: number; y: number } | null = null;
  let laatsteKlik = 0;
  let verven = false;
  let laatsteVerf = { kol: -1, rij: -1 };
  const tegelOnderMuis = (x: number, y: number) => {
    const p = wereld.toLocal({ x, y });
    return tegelOnder(staat().kaart, p.x, p.y);
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0 && !e.shiftKey && bewerker?.actief) {
      const t = tegelOnderMuis(e.offsetX, e.offsetY);
      bewerker.neer(t.kol, t.rij);
      verven = true;
      laatsteVerf = t;
      return;
    }
    if (e.button === 0) sleep = { x0: e.offsetX, y0: e.offsetY, x1: e.offsetX, y1: e.offsetY, extra: e.shiftKey };
    if (e.button === 1) {
      e.preventDefault();
      kijk = { x: e.offsetX, y: e.offsetY };
    }
    if (e.button === 2 && selectie.size) {
      const p = wereld.toLocal({ x: e.offsetX, y: e.offsetY });
      const t = tegelOnder(staat().kaart, p.x, p.y);
      opdracht([...selectie], t.kol, t.rij);
    }
  });
  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (bewerker?.actief) {
      if (e.target !== canvas && !verven) bewerker.zweef(null, null);
      else {
        const t = tegelOnderMuis(x, y);
        if (!verven) bewerker.zweef(t.kol, t.rij);
        else if (t.kol !== laatsteVerf.kol || t.rij !== laatsteVerf.rij) {
          bewerker.sleep(t.kol, t.rij);
          laatsteVerf = t;
        }
      }
    }
    if (sleep) {
      sleep.x1 = x;
      sleep.y1 = y;
    }
    if (kijk) {
      cam.x -= (x - kijk.x) / zoom;
      cam.y -= (y - kijk.y) / zoom;
      kijk = { x, y };
      zet();
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) verven = false;
    if (e.button === 1) kijk = null;
    if (e.button !== 0 || !sleep) return;
    const s = sleep;
    sleep = null;
    if (!s.extra) selectie.clear();
    const l = Math.min(s.x0, s.x1), r = Math.max(s.x0, s.x1), t = Math.min(s.y0, s.y1), b = Math.max(s.y0, s.y1);
    const werkers = staat().werkers;
    if (r - l < 5 && b - t < 5) {
      const nu = performance.now();
      if (nu - laatsteKlik < 350) {
        // dubbelklik: alles wat in beeld is
        for (const w of werkers) {
          const p = opScherm(w.x, w.y);
          if (p.x >= 0 && p.y >= 0 && p.x <= app.screen.width && p.y <= app.screen.height) selectie.add(w.id);
        }
      } else {
        // klik: de dichtstbijzijnde eenheid onder de muis
        let beste = -1, afst = 14 * zoom;
        for (const w of werkers) {
          const p = opScherm(w.x, w.y);
          const d = Math.hypot(p.x - s.x0, p.y - s.y0);
          if (d < afst) [beste, afst] = [w.id, d];
        }
        if (beste >= 0) selectie.add(beste);
      }
      laatsteKlik = nu;
      return;
    }
    for (const w of werkers) {
      const p = opScherm(w.x, w.y);
      if (p.x >= l && p.x <= r && p.y >= t && p.y <= b) selectie.add(w.id);
    }
  });

  return {
    selectie,
    werk(sec) {
      // nieuwe wereld: de schijf ligt nu op andere tegels, en de camera gaat mee zodat hij op dezelfde plek in beeld blijft
      const nu = staat().kaart.machine;
      if (nu !== m) {
        const d = naarScherm(nu.x - m.x, nu.y - m.y);
        cam.x += d.x;
        cam.y += d.y;
        m = nu;
        zet();
      }
      const v = (900 * sec) / zoom;
      let dx = 0, dy = 0;
      if (toetsen.has('a') || toetsen.has('arrowleft')) dx -= v;
      if (toetsen.has('d') || toetsen.has('arrowright')) dx += v;
      if (toetsen.has('w') || toetsen.has('arrowup')) dy -= v;
      if (toetsen.has('s') || toetsen.has('arrowdown')) dy += v;
      if (dx || dy) {
        cam.x += dx;
        cam.y += dy;
        zet();
      }
      kader.clear();
      if (sleep && (Math.abs(sleep.x1 - sleep.x0) > 4 || Math.abs(sleep.y1 - sleep.y0) > 4)) {
        const l = Math.min(sleep.x0, sleep.x1), t = Math.min(sleep.y0, sleep.y1);
        kader
          .rect(l, t, Math.abs(sleep.x1 - sleep.x0), Math.abs(sleep.y1 - sleep.y0))
          .fill({ color: 0x9dff2e, alpha: 0.06 })
          .stroke({ width: 1, color: 0x9dff2e, alpha: 0.8 });
      }
    },
  };
}
