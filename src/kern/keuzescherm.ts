// De splitsing in het niets: na de stream kies je uit drie werelden. Elke kaart laat een glimp van de landingsplek zien:
// soort wereld, gevaar (Wrath bij de landing), grondstoffen en wat de wereld meegeeft. Alleen DOM, geen regels.
import { BONUS_KAPITAAL, BONUS_REPARATIE } from '../data/run';
import { WRATH_STADIA } from '../data/wrath';
import { ARCHETYPES } from '../land/archetypes';
import type { GerolDimensie } from '../land/genereer';
import { stadium, stadiumNummer } from '../land/wrath';
import type { Keuze } from './spel';
import { wereldType } from './wereldtypes';

const kaartBestanden = import.meta.glob('../../assets/land/*/*-otter-0.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const otter = (a: string): string | undefined => Object.entries(kaartBestanden).find(([k]) => k.endsWith(`/${a}/${a}-otter-0.png`))?.[1];

const kleur = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const KOP: Record<GerolDimensie['profiel'], { titel: string; regel: string; kleur: string }> = {
  veilig: { titel: 'QUIET DRIFT', regel: 'Calm landing, the machine is patched up, but thin pickings.', kleur: '#6fcf6f' },
  normaal: { titel: 'THE STREAM', regel: 'Where the stream would have taken you anyway.', kleur: '#c8ccd2' },
  rijk: { titel: 'RICH AND ANGRY', regel: 'Extra supplies on landing, but the land is already furious.', kleur: '#ff6a1a' },
};
const GOED: Record<string, string> = { metaal: 'metal', hout: 'wood', water: 'water', steen: 'stone' };

export const gevaar = (d: GerolDimensie): { naam: string; kleur: string; nr: number } => {
  const st = stadium(d.beginWrath);
  return { naam: st.naam, kleur: st.kleur, nr: stadiumNummer(d.beginWrath) + 1 };
};

function kaart(d: GerolDimensie, i: number, kies: (i: number) => void): HTMLElement {
  const a = ARCHETYPES[d.archetype], w = wereldType(d.wereldtype), k = KOP[d.profiel], g = gevaar(d);
  const delen = d.aanbod.map((x) => GOED[x.goed] ?? d.uniek.find((u) => u.id === x.goed)?.naam.toLowerCase() ?? x.goed);
  const uniek = d.uniek.map((u) => u.naam).join(', ');
  const bonus = d.profiel === 'veilig' ? `+${BONUS_REPARATIE}% machine integrity on landing` : d.profiel === 'rijk' ? `+${Math.round(BONUS_KAPITAAL * 100)}% extra starting supplies on landing` : 'no bonus';
  const vlak = w ? w.grond.slice(0, 4).map((c) => `<i style="background:${kleur(c)}"></i>`).join('') : '';
  const el = document.createElement('button');
  el.className = 'splits';
  el.style.setProperty('--ac', k.kleur);
  el.innerHTML = `
    <small>${i + 1} · ${k.titel}</small>
    <div class="kop"><img src="${otter(d.archetype) ?? ''}" alt=""><div><b>${d.naam}</b><br><span>${a.naam} · ${d.familie === 'beschaving' ? 'civilisation' : d.familie === 'wildernis' ? 'wildlife' : 'special'}</span></div></div>
    <div class="vlak">${vlak}</div>
    <p class="regel">${k.regel}</p>
    <dl>
      <dt>Lands</dt><dd>${d.plek}</dd>
      <dt>Danger</dt><dd><b style="color:${g.kleur}">${g.naam}</b> · Wrath ${d.beginWrath} · strength ${d.sterkte.toFixed(2)}</dd>
      <dt>Fights</dt><dd>${a.vecht}</dd>
      <dt>Resources</dt><dd>${delen.join(', ')}<br><b style="color:#9dff2e">unique: ${uniek}</b></dd>
      <dt>Loot</dt><dd>${d.loot.length} blueprint${d.loot.length === 1 ? '' : 's'}</dd>
      <dt>Bonus</dt><dd>${bonus}</dd>
      ${d.regel ? `<dt>Rule</dt><dd>${d.regel}</dd>` : ''}
    </dl>`;
  el.onclick = () => kies(i);
  return el;
}

// Zet het scherm neer (of weg). Geeft een functie die elke beeldtik kan roepen met de huidige keuze.
export function maakKeuzescherm(kies: (i: number) => void): (k: Keuze | undefined) => void {
  const st = document.createElement('style');
  st.textContent = `
    #splitsing { position: fixed; inset: 0; z-index: 40; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
      padding: 16px; overflow: auto; font: 14px monospace; color: #e8e8e0;
      background: radial-gradient(ellipse at 50% 40%, rgba(24,18,40,.94), rgba(3,3,6,.97) 70%); }
    #splitsing h1 { margin: 0; font-size: 26px; color: #9dff2e; letter-spacing: 3px; }
    #splitsing .rij { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 14px; justify-content: center; }
    .splits { width: 290px; text-align: left; font: inherit; color: inherit; background: #101214; border: 2px solid #34383c; padding: 12px; cursor: pointer; }
    .splits:hover, .splits:focus { border-color: var(--ac); outline: none; box-shadow: 0 0 18px -4px var(--ac); }
    .splits small { color: var(--ac); letter-spacing: 2px; }
    .splits .kop { display: flex; gap: 10px; align-items: center; margin: 8px 0; }
    .splits .kop img { width: 64px; height: 64px; image-rendering: pixelated; background: #07080a; }
    .splits .kop span { color: #9a9a90; }
    .splits .vlak { display: flex; height: 10px; margin-bottom: 8px; } .splits .vlak i { flex: 1; }
    .splits .regel { margin: 0 0 8px; color: var(--ac); }
    .splits dl { margin: 0; display: grid; grid-template-columns: 74px 1fr; gap: 4px 8px; font-size: 12px; }
    .splits dt { color: #7d8288; } .splits dd { margin: 0; }
    #splitsing p.tip { margin: 0; color: #7d8288; font-size: 12px; }`;
  document.head.append(st);
  const d = document.createElement('div');
  d.id = 'splitsing';
  document.body.append(d);
  let getoond: Keuze | undefined;
  window.addEventListener('keydown', (e) => { if (getoond && ['1', '2', '3'].includes(e.key)) kies(Number(e.key) - 1); });
  return (k) => {
    if (k === getoond) return;
    getoond = k;
    d.style.display = k ? 'flex' : 'none';
    d.replaceChildren();
    if (!k) return;
    const h = document.createElement('h1');
    h.textContent = `THE STREAM FORKS · SHIFT ${k.nummer - 1} TO ${k.nummer}`;
    const rij = document.createElement('div');
    rij.className = 'rij';
    k.opties.forEach((o, i) => rij.append(kaart(o, i, kies)));
    const tip = document.createElement('p');
    tip.className = 'tip';
    tip.textContent = `Pick where the disc lands (click or press 1-3). The clock is stopped. Danger levels: ${WRATH_STADIA.map((s) => s.naam).join(' < ')}.`;
    d.append(h, rij, tip);
  };
}
