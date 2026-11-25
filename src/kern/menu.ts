// Start-, uitleg-, pauze- en eindscherm. Eén scherm tegelijk, over het spel heen. Tekst in beeld is Engels.
import { versieTekst } from './omgeving';

const plaatjes = import.meta.glob(
  ['../../assets/muizen/muis-schroot.png', '../../assets/muizen/hoop-schroot.png', '../../assets/muizen/machine.png', '../../assets/land/steentijd/knotsdrager.png'],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;
const plaat = (naam: string): string => Object.entries(plaatjes).find(([k]) => k.endsWith(naam))?.[1] ?? '';

const GEZIEN = 'rm-uitleg-gezien';
const gezien = (): boolean => { try { return localStorage.getItem(GEZIEN) === '1'; } catch { return true; } };
const onthoud = (): void => { try { localStorage.setItem(GEZIEN, '1'); } catch { /* geen opslag: dan zien we het weer */ } };

// De vier stappen van de kernlus, in één scherm.
const STAPPEN: [string, string, string, string][] = [
  ['hoop-schroot.png', '1 TAKE', 'Send your rats to the fields (right click). They haul resources to the machine\'s store.', 'The land is yours to strip.'],
  ['knotsdrager.png', '2 WRATH RISES', 'Every load you take makes the land angrier. The Wrath meter in the top left climbs.', 'Take less, or be ready.'],
  ['muis-schroot.png', '3 DEFEND', 'From WARY on, raiders hit your machine. Rats near a raider fight back, so keep some at home.', 'Keep the machine whole.'],
  ['machine.png', '4 SHIFT', 'Charge the machine to 100% power with 50% integrity before the stream. Then you jump to the next world.', 'Miss it and the run is over.'],
];

export interface Menu {
  open: boolean; // een scherm ligt over het spel: het spel wacht
  pauze(aan?: boolean): void;
  toonEinde(kop: string, kleur: string, tekst: string, regel: string, opnieuw: () => void): void;
}

export function maakMenu(opties: { overslaan: boolean }): Menu {
  const el = document.createElement('div');
  el.id = 'menu';
  el.style.cssText = 'position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(5,6,8,.9);color:#e8e8e0;font:15px monospace;text-align:center;padding:20px;z-index:60;overflow:auto';
  document.body.append(el);
  for (const soort of ['pointerdown', 'pointerup', 'wheel', 'contextmenu', 'dblclick', 'keydown'] as const) el.addEventListener(soort, (e) => e.stopPropagation());
  let scherm: 'geen' | 'start' | 'uitleg' | 'pauze' | 'einde' = 'geen';
  let vanStart = false;

  const knop = (tekst: string, doe: () => void, hoofd = false): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = tekst;
    b.style.cssText = `font:inherit;font-weight:bold;padding:10px 26px;min-width:200px;background:#1d1e1c;color:${hoofd ? '#9dff2e' : '#c8ccd2'};border:2px solid ${hoofd ? '#9dff2e' : '#3d4143'};border-radius:0;cursor:pointer;touch-action:manipulation`;
    b.onclick = doe;
    return b;
  };
  const kop = (t: string, kleur = '#9dff2e'): HTMLElement => {
    const h = document.createElement('h1');
    h.textContent = t;
    h.style.cssText = `margin:0;font-size:40px;letter-spacing:4px;color:${kleur}`;
    return h;
  };
  const tekst = (t: string, kleur = '#9a9a90', breed = 520): HTMLElement => {
    const p = document.createElement('p');
    p.textContent = t;
    p.style.cssText = `margin:0;max-width:${breed}px;color:${kleur};line-height:1.5`;
    return p;
  };
  const zet = (s: typeof scherm, ...kinderen: HTMLElement[]): void => {
    scherm = s;
    el.replaceChildren(...kinderen);
    el.style.display = s === 'geen' ? 'none' : 'flex';
  };
  const sluit = (): void => zet('geen');

  function start(): void {
    zet('start', kop('REALITY MACHINE'), tekst('Your land drifts from world to world. Strip each one, survive its Wrath, and jump before the stream takes you.'),
      knop('PLAY', () => (gezien() ? sluit() : uitleg(true)), true), knop('HOW TO PLAY', () => uitleg(true)), tekst(versieTekst(), '#5e6261'));
  }
  function uitleg(uitStart: boolean): void {
    vanStart = uitStart;
    const rij = document.createElement('div');
    rij.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:12px;max-width:1000px';
    for (const [plaatje, titel, uit, slot] of STAPPEN) {
      const k = document.createElement('div');
      k.style.cssText = 'width:210px;padding:12px;background:#0b0c0c;border:1px solid #3d4143;display:flex;flex-direction:column;align-items:center;gap:8px';
      const img = document.createElement('img');
      img.src = plaat(plaatje);
      img.style.cssText = 'height:72px;image-rendering:pixelated;object-fit:contain';
      const t = document.createElement('b');
      t.textContent = titel;
      t.style.color = '#a8861c';
      k.append(img, t, tekst(uit, '#c8ccd2', 190), tekst(slot, '#ff9a1f', 190));
      k.lastElementChild!.setAttribute('style', k.lastElementChild!.getAttribute('style') + ';font-weight:bold');
      rij.append(k);
    }
    const lus = tekst('Take, get punished, defend, jump. Then do it again in a stranger world. Eight shifts and a finale.', '#e8e8e0', 700);
    const keys = tekst(matchMedia('(pointer: coarse)').matches ? 'Tap a rat to select, tap the ground to send it. Drag to look around, pinch to zoom.' : 'Drag to select rats, right click to send them. WASD to look around, scroll to zoom. P pauses.', '#9a9a90', 700);
    zet('uitleg', kop('HOW TO PLAY'), lus, rij, keys, knop(vanStart ? 'GOT IT, PLAY' : 'BACK', () => { onthoud(); if (vanStart) sluit(); else pauze(true); }, true));
  }
  function pauze(aan?: boolean): void {
    if (scherm === 'start' || scherm === 'einde' || (scherm === 'uitleg' && vanStart)) return;
    const wil = aan ?? scherm !== 'pauze';
    if (!wil) return sluit();
    zet('pauze', kop('PAUSED', '#c8ccd2'), knop('RESUME', sluit, true), knop('HOW TO PLAY', () => uitleg(false)),
      knop('RESTART RUN', () => { const p = new URLSearchParams(location.search); p.delete('seed'); p.delete('shift'); location.search = p.toString(); }),
      tekst('Press P to resume.', '#5e6261'));
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') pauze();
  });
  if (!opties.overslaan) start();

  return {
    get open() { return scherm !== 'geen'; },
    pauze,
    toonEinde(k, kleur, t, regel, opnieuw) {
      zet('einde', kop(k, kleur), tekst(t, '#e8e8e0'), tekst(regel), knop('NEW RUN', opnieuw, true));
    },
  };
}
