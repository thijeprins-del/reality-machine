// Alles wat in HTML over het spel ligt: het startmenu en de balk met getallen.
import type { FactieId } from './types';

export interface Keuze {
  id: FactieId;
  naam: string;
  regel: string;
  speelbaar: boolean;
}

// Startmenu: kies je factie. Een factie die nog niet speelbaar is staat er wel, maar is niet te kiezen.
export function kiesFactie(keuzes: Keuze[]): Promise<FactieId> {
  const menu = document.createElement('div');
  menu.id = 'menu';
  menu.innerHTML = `
    <h1>Reality Machine</h1>
    <p>Choose your faction</p>
    <div class="keuzes">${keuzes
      .map(
        (k) => `<button data-id="${k.id}" ${k.speelbaar ? '' : 'disabled'}>
          <b>${k.naam}</b><span>${k.regel}</span></button>`,
      )
      .join('')}</div>`;
  document.body.appendChild(menu);
  return new Promise((klaar) => {
    menu.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        menu.remove();
        klaar(b.dataset.id as FactieId);
      }),
    );
  });
}

export function maakBalk(): { zet(regels: string[]): void } {
  const balk = document.createElement('div');
  balk.id = 'balk';
  const hulp = document.createElement('div');
  hulp.id = 'hulp';
  hulp.textContent = matchMedia('(pointer: coarse)').matches
    ? 'tap a mouse = select · double tap = all on screen · hold + drag = box · tap the ground = order · drag = look · pinch = zoom'
    : 'drag = select (shift = add) · double click = all on screen · right click = order · WASD/arrows or middle button = look · scroll = zoom · space = machine';
  document.body.append(balk, hulp);
  let vorige = '';
  return {
    zet(regels) {
      const html = regels.map((r) => `<div>${r}</div>`).join('');
      if (html !== vorige) balk.innerHTML = vorige = html;
    },
  };
}

// Een knop in de knoppenbalk rechtsonder (voor aanraken en kleine schermen). Geeft de knop terug.
export function knop(tekst: string, titel: string, doe: () => void): HTMLButtonElement {
  let balk = document.getElementById('knoppen');
  if (!balk) {
    balk = document.createElement('div');
    balk.id = 'knoppen';
    document.body.appendChild(balk);
  }
  const b = document.createElement('button');
  b.textContent = tekst;
  b.title = titel;
  b.addEventListener('pointerdown', (e) => e.stopPropagation(), { capture: true });
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    doe();
  });
  balk.appendChild(b);
  return b;
}

// Klein scherm (telefoon): dan staan het paneel en het bouwmenu niet tegelijk open.
export const klein = () => innerWidth < 1000 || innerHeight < 640;
