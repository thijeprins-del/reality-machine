// Alles wat in HTML over het spel ligt: de balk met getallen, dialogen, tooltips en de knoppen.
// De stijl staat in index.html. Tekst in beeld is Engels.

export function maakBalk(): { zet(regels: string[]): void } {
  const balk = document.createElement('div');
  balk.id = 'balk';
  document.body.append(balk);
  let vorige = '';
  return {
    zet(regels) {
      const html = regels.map((r) => `<div>${r}</div>`).join('');
      if (html !== vorige) balk.innerHTML = vorige = html;
    },
  };
}

// De besturing, voor de dialoog CONTROLS: [wat je doet, wat er gebeurt]. Aanraken en muis hebben elk hun eigen lijst.
export function besturing(): [string, string][] {
  return matchMedia('(pointer: coarse)').matches
    ? [
        ['Tap a rat', 'select it'],
        ['Double tap', 'select all rats on screen'],
        ['Hold + drag', 'select with a box'],
        ['Tap the ground', 'send the selected rats there (a field: dig it)'],
        ['Drag', 'look around'],
        ['Pinch', 'zoom'],
      ]
    : [
        ['Drag', 'select rats (shift = add)'],
        ['Double click', 'select all rats on screen'],
        ['Right click', 'send the selected rats there (a field: dig it)'],
        ['WASD / arrows / middle button', 'look around'],
        ['Scroll', 'zoom'],
        ['Space', 'back to the machine'],
        ['Esc', 'clear the selection, stop building, close a dialog'],
      ];
}

// ---- tooltip: één tekstvakje bij de muis, voor alles wat uitleg heeft ----
let tipEl: HTMLElement | null = null;
export function toonTip(tekst: string | null, x = 0, y = 0): void {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'tip';
    document.body.appendChild(tipEl);
  }
  if (!tekst) {
    tipEl.style.display = 'none';
    return;
  }
  if (tipEl.textContent !== tekst) tipEl.textContent = tekst;
  tipEl.style.display = 'block';
  // rechtsboven de muis, maar binnen het scherm
  const b = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = `${Math.max(4, Math.min(innerWidth - b - 4, x + 14))}px`;
  tipEl.style.top = `${Math.max(4, y - h - 10)}px`;
}
// Elk element met data-tip binnen `wortel` toont die tekst als tooltip.
export function tipsIn(wortel: HTMLElement): void {
  wortel.addEventListener('pointermove', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    toonTip(el?.dataset.tip ?? null, e.clientX, e.clientY);
  });
  wortel.addEventListener('pointerleave', () => toonTip(null));
}

// ---- dialogen: een venster midden in beeld met een titel en een kruisje. Er staat er hooguit één open. ----
export interface Dialoog {
  el: HTMLElement;
  inhoud: HTMLElement;
  readonly open: boolean;
  zet(aan: boolean): void;
}
const dialogen: Dialoog[] = [];
// Klikken, scrollen en rechtsklikken op een venster of balk gaan niet door naar het spel eronder.
export function schermAf(el: HTMLElement): void {
  for (const soort of ['pointerdown', 'pointerup', 'wheel', 'contextmenu', 'dblclick'] as const)
    el.addEventListener(soort, (e) => {
      e.stopPropagation();
      if (soort === 'contextmenu') e.preventDefault();
    });
}
export function maakDialoog(id: string, titel: string, opZet?: (aan: boolean) => void): Dialoog {
  const el = document.createElement('div');
  el.className = 'dialoog';
  el.id = id;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', titel);
  const kop = document.createElement('div');
  kop.className = 'kop';
  const naam = document.createElement('b');
  naam.textContent = titel;
  const sluit = document.createElement('button');
  sluit.textContent = 'X';
  sluit.setAttribute('aria-label', `Close ${titel}`);
  kop.append(naam, sluit);
  const inhoud = document.createElement('div');
  inhoud.className = 'inhoud';
  el.append(kop, inhoud);
  document.body.appendChild(el);
  schermAf(el);
  let open = false;
  const d: Dialoog = {
    el,
    inhoud,
    get open() {
      return open;
    },
    zet(aan) {
      if (aan) for (const ander of dialogen) if (ander !== d && ander.open) ander.zet(false);
      open = aan;
      el.style.display = aan ? 'flex' : 'none';
      if (!aan) toonTip(null);
      opZet?.(aan);
    },
  };
  sluit.addEventListener('click', () => d.zet(false));
  if (!dialogen.length)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') for (const x of dialogen) if (x.open) x.zet(false);
    });
  dialogen.push(d);
  return d;
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

// Klein scherm (telefoon): dan staat het bouwmenu niet vanzelf open.
export const klein = () => innerWidth < 1000 || innerHeight < 640;
