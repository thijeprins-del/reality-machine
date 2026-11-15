// De vaste balk linksonder: klein gehouden, zodat het spel in beeld blijft.
//   - de voorraad: elk goed dat in je magazijnen ligt, met zijn icoon en het aantal
//   - stroom: twee getallen, aanbod en vraag
//   - RATS en LOG: ingeklapt tot je erop klikt
//   - drie knoppen: PRODUCTION (wat je per minuut maakt), POWER (bronnen, net, verbruikers) en CONTROLS (besturing)
// Uitleg staat in tooltips, niet vast in beeld. Gewoon HTML bovenop het spel; de stijl staat in index.html.
import { actieveEconomie, goed } from '../kern/economie';
import { besturing, maakDialoog, schermAf, tipsIn, type Dialoog } from '../kern/scherm';
import type { SpelStaat } from '../kern/spel';
import type { Goed, Voorraad } from '../kern/types';
import { energie } from './energie';
import { bouwSoorten, opslagMax, opslagVol } from './industrie';
import { werk } from './werk';

const kw = (n: number) => (Math.abs(n % 1) > 0.05 ? n.toFixed(1) : String(Math.round(n)));
const veilig = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// Het icoon van een goed: het plaatje uit het economiebestand, anders een blokje in zijn kleur.
function icoon(g: Goed): string {
  const s = goed(g);
  return s.icon ? `<img class="ico" src="${s.icon}" alt="">` : `<i class="ico${s.glows ? ' gloeit' : ''}" style="background:${s.color};color:${s.color}"></i>`;
}
// Alle goederen om te tonen: eerst die van deze wereld (in de volgorde van het bestand), dan wat er verder nog ligt.
const alleGoederen = (s: SpelStaat): Goed[] => [...new Set([...actieveEconomie().goederen.keys(), ...Object.keys(s.voorraad)])];

const PRODUCTIE_VENSTER = 30; // seconden waarover "per minuut" gemeten wordt
const NIEUWS_SEC = 8; // zo lang staat een nieuwe melding naast LOG als het logboek dicht is

export function maakHud(staat: () => SpelStaat, stroom: Dialoog): { werk(sec: number): void } {
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div class="inv" aria-label="Inventory"></div>
    <div class="stroom" data-tip="Power: what your sources supply and what is switched on demands. Open POWER to change it."></div>
    <div class="vouw" data-v="ratten"><button class="kopje" aria-expanded="false"><span class="pijl">+</span> RATS <span class="kort"></span></button><div class="lijf" hidden></div></div>
    <div class="vouw" data-v="log"><button class="kopje" aria-expanded="false"><span class="pijl">+</span> LOG <span class="kort"></span></button><div class="lijf" hidden></div></div>
    <div class="knoppen">
      <button data-d="productie" data-tip="What you have and what you make per minute">PRODUCTION</button>
      <button data-d="stroom" data-tip="Power sources, the power grid and what uses power">POWER</button>
      <button data-d="besturing" data-tip="Mouse and keyboard controls">CONTROLS</button>
    </div>`;
  document.body.appendChild(hud);
  schermAf(hud);
  tipsIn(hud);
  const deel = (q: string) => hud.querySelector<HTMLElement>(q)!;
  const inv = deel('.inv'), stroomRegel = deel('.stroom');
  // een stuk van de balk alleen opnieuw opbouwen als het veranderd is
  const vorige = new Map<HTMLElement, string>();
  const zet = (el: HTMLElement, html: string) => {
    if (vorige.get(el) === html) return;
    vorige.set(el, html);
    el.innerHTML = html;
  };

  // ---- inklapbare delen: standaard dicht ----
  const open: Record<string, boolean> = { ratten: false, log: false };
  hud.querySelectorAll<HTMLElement>('.vouw').forEach((v) => {
    const kop = v.querySelector<HTMLElement>('.kopje')!, lijf = v.querySelector<HTMLElement>('.lijf')!;
    kop.addEventListener('click', () => {
      const aan = (open[v.dataset.v!] = !open[v.dataset.v!]);
      lijf.hidden = !aan;
      kop.setAttribute('aria-expanded', String(aan));
      kop.querySelector('.pijl')!.textContent = aan ? '-' : '+';
    });
  });

  // ---- dialogen ----
  const productie = maakDialoog('dlg-productie', 'PRODUCTION');
  tipsIn(productie.inhoud);
  const hulp = maakDialoog('dlg-besturing', 'CONTROLS', (aan) => {
    if (aan) hulp.inhoud.innerHTML = besturingHtml();
  });
  const dialogen: Record<string, Dialoog> = { productie, stroom, besturing: hulp };
  const knoppen = [...hud.querySelectorAll<HTMLButtonElement>('.knoppen button')];
  for (const k of knoppen) k.addEventListener('click', () => dialogen[k.dataset.d!].zet(!dialogen[k.dataset.d!].open));

  function besturingHtml(): string {
    const rij = ([a, b]: [string, string]) => `<tr><th>${veilig(a)}</th><td>${veilig(b)}</td></tr>`;
    const bouw: [string, string][] = [
      ...bouwSoorten().filter((b) => b.key).map((b): [string, string] => [b.key, `build: ${b.name.toLowerCase()}`]),
      ['X', 'demolish (click or drag); you get the cost back'],
      ['R', 'turn a single belt tile'],
      ['Click a building', 'set it up: its recipe, or what a belt takes out of storage'],
    ];
    const net: [string, string][] = [['1 2 3', 'power source on / off'], ['Shift + 1 2 3', 'dial: low, normal, overcharge'], ['4 5 6 7', 'consumer on / off'], ['F1', 'grid and heights'], ['F2', 'terrain editor (the clock stops)']];
    return `<h3>Rats and camera</h3><table>${besturing().map(rij).join('')}</table>
      <h3>Building in this world</h3><table>${bouw.map(rij).join('')}</table>
      <h3>Power and tools</h3><table>${net.map(rij).join('')}</table>`;
  }

  // ---- productie: wat er per minuut bij komt of af gaat, gemeten over het laatste halve minuut ----
  const monsters: { t: number; v: Voorraad }[] = [];
  let klok = 0, monsterKlok = 0, tekenKlok = 0;
  let laatsteLog = '', logSinds = -99;
  function perMinuut(s: SpelStaat, g: Goed): number | null {
    const oud = monsters[0];
    if (!oud || klok - oud.t < 4) return null; // nog te kort gemeten
    return (((s.voorraad[g] ?? 0) - (oud.v[g] ?? 0)) / (klok - oud.t)) * 60;
  }
  function productieHtml(s: SpelStaat): string {
    const rijen = alleGoederen(s).map((g) => {
      const n = Math.floor(s.voorraad[g] ?? 0), pm = perMinuut(s, g);
      const kleur = pm === null || Math.abs(pm) < 0.5 ? 'nul' : pm > 0 ? 'plus' : 'min';
      const tekst = pm === null ? '...' : Math.abs(pm) < 0.5 ? '0' : `${pm > 0 ? '+' : ''}${Math.round(pm)}`;
      return `<tr class="${n ? '' : 'leeg'}"><td>${icoon(g)}</td><th>${veilig(goed(g).name)}</th><td class="getal">${n}</td><td class="getal ${kleur}">${tekst}</td></tr>`;
    });
    return `<table class="productie"><thead><tr><td></td><th>GOOD</th><td class="getal">IN STOCK</td><td class="getal" data-tip="Net change per minute over the last ${PRODUCTIE_VENSTER} seconds: what you make and dig, minus what you use">PER MINUTE</td></tr></thead>
      <tbody>${rijen.join('')}</tbody></table>
      <p>Storage ${Math.round(opslagVol(s))} of ${Math.round(opslagMax(s))} used. Per minute is the net change: made and dug, minus used.</p>`;
  }

  return {
    werk(sec) {
      const s = staat(), e = energie(s);
      klok += sec;
      monsterKlok += sec;
      if (monsterKlok >= 2 || !monsters.length) {
        monsterKlok = 0;
        monsters.push({ t: klok, v: { ...s.voorraad } });
        while (monsters.length > 1 && klok - monsters[1].t >= PRODUCTIE_VENSTER) monsters.shift();
      }
      // een paar keer per seconde is genoeg
      tekenKlok += sec;
      if (tekenKlok < 0.2) return;
      tekenKlok = 0;

      // voorraad: alles wat er ligt
      const vol = opslagVol(s), max = opslagMax(s);
      const items = alleGoederen(s).filter((g) => (s.voorraad[g] ?? 0) >= 1)
        .map((g) => `<span class="item" data-tip="${veilig(goed(g).name)}: ${Math.floor(s.voorraad[g] ?? 0)} in storage">${icoon(g)}${Math.floor(s.voorraad[g] ?? 0)}</span>`);
      zet(inv, (items.join('') || '<span class="stil">NOTHING IN STORAGE</span>') +
        `<span class="opslag${vol >= max - 1 ? ' vol' : ''}" data-tip="Storage used: everything shares one stock. Build storage for more room.">${Math.round(vol)}/${Math.round(max)}</span>`);

      // stroom: twee getallen
      zet(stroomRegel, `SUPPLY <b class="aanbod">${kw(e.aanbod)}</b> DEMAND <b class="${e.vraag > e.aanbod + 0.05 ? 'tekort' : 'vraag'}">${kw(e.vraag)}</b>`);

      // ratten
      const tel = werk(s).telling;
      const bezig = s.werkers.length - tel.vrij;
      zet(deel('[data-v="ratten"] .kort'), `${bezig} of ${s.werkers.length} busy`);
      if (open.ratten) {
        const rijen: [string, number, string][] = [
          ['BUILDING', tel.bouw, 'Finishing build sites. Comes first'],
          ['WHEEL + WORK', tel.ren + tel.fab, 'Running in the wheel and working in buildings'],
          ['HAULING', tel.haal + tel.breng + tel.lever, 'Bringing parts to build sites, input to buildings, output to storage'],
          ['DIGGING', tel.graaf, 'Digging resources by hand, while there is room'],
          ['IDLE', tel.vrij, 'Nothing to do: storage full or nothing to build'],
        ];
        const totaal = s.werkers.length || 1;
        zet(deel('[data-v="ratten"] .lijf'), rijen.map(([naam, n, tip]) =>
          `<div class="rij" data-tip="${tip}"><span>${naam}</span><b>${n}</b><span class="staaf"><i style="width:${Math.round((100 * n) / totaal)}%"></i></span></div>`).join(''));
      }

      // logboek: dicht alleen de nieuwste melding, en die maar even
      const nieuwste = e.log[0]?.tekst ?? '';
      if (nieuwste !== laatsteLog) {
        laatsteLog = nieuwste;
        logSinds = klok;
      }
      const vers = klok - logSinds < NIEUWS_SEC && !open.log;
      zet(deel('[data-v="log"] .kort'), vers && e.log[0] ? `<span class="log-${e.log[0].kleur}">${veilig(nieuwste)}</span>` : '');
      if (open.log) zet(deel('[data-v="log"] .lijf'), e.log.slice(0, 8).map((r, i) => `<div class="${i ? 'oud' : `log-${r.kleur}`}">${veilig(r.tekst)}</div>`).join('') || '<div class="oud">NOTHING YET</div>');

      for (const k of knoppen) k.classList.toggle('aan', dialogen[k.dataset.d!].open);
      if (productie.open) zet(productie.inhoud, productieHtml(s));
    },
  };
}
