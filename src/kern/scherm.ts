// Alles wat in HTML over het spel ligt: de balk met getallen en de knoppen.
export function maakBalk(): { zet(regels: string[]): void } {
  const balk = document.createElement('div');
  balk.id = 'balk';
  const hulp = document.createElement('div');
  hulp.id = 'hulp';
  hulp.textContent = matchMedia('(pointer: coarse)').matches
    ? 'tap a rat = select · double tap = all on screen · hold + drag = box · tap the ground = order · drag = look · pinch = zoom'
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
