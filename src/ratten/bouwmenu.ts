// Het bouwmenu rechts: een kaart per gebouw van deze wereld (plaatje, naam, kosten), daaronder alles over het
// gebouw dat je aanwijst of gekozen hebt (wat het doet, kosten tegen wat je hebt, stroom, ploeg, recepten met iconen),
// en het gebouw dat je in de wereld hebt aangeklikt (stand, recept kiezen, wat een band uit een magazijn trekt).
// In de kop staat welke economie geldt en uit welk bestand ze komt (handig bij het schaven aan economies/*.json).
// Tiers: wat op slot zit staat er gedimd bij met zijn prijs in research packs. Klik de kaart en koop het vrij met UNLOCK;
// recepten op slot koop je vrij in de lijst van het aangeklikte gebouw.
// Gewoon HTML bovenop het spel; de stijl staat in index.html. Regels staan in industrie.ts.
import { actieveEconomie, economie, goed, ONDERZOEK, volumeVan, type BouwSoort, type ReceptSoort } from '../kern/economie';
import { schermAf, tipsIn } from '../kern/scherm';
import type { SpelStaat } from '../kern/spel';
import type { Goed, Voorraad } from '../kern/types';
import { gebouwPlaatje, goedIcoon } from './beeld';
import { bouwSoorten, industrie, isVrij, kiesRecept, koop, koopOordeel, opslagMax, opslagVol, receptenVan, receptVan, soortVan, zetUit, type Gebouw, type Oordeel } from './industrie';
import { kanBetalen, naamVan } from './kosten';

export interface Knop { id: string; naam: string; uitleg: string; soort?: BouwSoort }
export function uitlegVan(b: BouwSoort): string {
  if (b.aard === 'belt') return 'Drag from an output arrow of a building to storage, or to an input arrow (the ones with a bar) of another. R turns a single tile.';
  if (b.aard === 'pole') return 'Carries power. Cables run from pole to pole.';
  if (b.aard === 'sink') return 'Storage for anything. Click it to let a belt next to it take goods out.';
  if (b.aard === 'trash') return 'Destroys what a belt brings in.';
  if (b.aard === 'splitter') return 'A junction: belts run in and out, what comes in leaves in turns.';
  if (b.aard === 'grabber') return 'An arm: it takes a good from the belt behind it and drops it on the belt in front. Use it to move goods from one line to another. R turns it.';
  if (b.aard === 'merger') return 'A junction: several belts run in, one runs out.';
  if (b.workshop) return 'Turns goods into research packs: click it and pick what to study. Deeper goods give more packs. Spend packs here in the build menu to unlock buildings and recipes. Packs vaporize in the stream.';
  if (b.generator) return 'A generator: it burns fuel and gives power while it burns. Bring fuel by belt (to an input arrow) or by rats. R turns its arrows.';
  if (b.onDeposit) return `Place it next to a field of ${b.depRes.map((g) => naamVan(g).toLowerCase()).join(' or ')}. The machine throws it there. It digs out the whole field.`;
  return `Makes goods from a recipe. Bring its input by belt (to an input arrow, the ones with a bar) or by rats${b.recipes.length > 1 ? '; click it to pick a recipe' : ''}. R turns its arrows.`;
}
const soortNaam = (b: BouwSoort): string =>
  b.aard === 'belt' || b.aard === 'splitter' || b.aard === 'merger' || b.aard === 'grabber' ? 'LOGISTICS' : b.workshop ? 'RESEARCH' : b.aard === 'pole' || b.generator ? 'POWER' : b.aard === 'sink' ? 'STORAGE' : b.aard === 'trash' ? 'WASTE' : b.onDeposit ? 'EXTRACTION' : 'PRODUCTION';
export const knoppen = (): Knop[] => [
  ...bouwSoorten().map((b) => ({ id: b.id, naam: b.name, uitleg: uitlegVan(b), soort: b })),
  { id: 'sloop', naam: 'DEMOLISH', uitleg: 'Click or drag over what you want gone. You get the build cost back. Key: X.' },
];

const veilig = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const leeg = (v: Voorraad) => !Object.values(v).some((n) => (n ?? 0) > 0);
// Het icoon van een goed, met zijn naam als tooltip.
function icoon(g: Goed): string {
  const s = goed(g), plaatje = goedIcoon(s) ?? s.icon;
  return plaatje ? `<img class="ico plaatje" src="${plaatje}" alt="" data-tip="${veilig(s.name)}">` : `<i class="ico" style="background:${s.color}" data-tip="${veilig(s.name)}"></i>`;
}
// Een rijtje goederen met aantallen: "[icoon] 12 [icoon] 6". Met `heb` wordt rood wat je niet hebt.
function stuks(v: Voorraad, heb?: Voorraad, keer = 1): string {
  const delen = Object.entries(v).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) =>
    `<span class="stuk${heb && (heb[g] ?? 0) < (n ?? 0) * keer ? ' tekort' : ''}">${icoon(g)}${n}</span>`);
  return delen.join('') || '<span class="stuk gratis">FREE</span>';
}
const receptRegel = (r: ReceptSoort): string =>
  `${leeg(r.inputs) ? '' : `${stuks(r.inputs)}<span class="pijl">&gt;</span>`}${leeg(r.outputs) && r.power ? '' : stuks(r.outputs)}${r.power ? `<span class="kw">+${r.power} kW</span>` : ''}<span class="tijd">${r.time}s</span>`;

export interface BouwmenuHaken {
  staat: () => SpelStaat;
  modus: () => string | null; // wat je aan het neerzetten bent: id van een gebouw, 'sloop' of null
  kies: (id: string) => void;
  gekozen: () => number | null; // het gebouw dat in de wereld is aangeklikt
  melding: () => Oordeel | null; // of het op de plek onder de muis kan
}

export function maakBouwmenu(h: BouwmenuHaken): { werk(sec: number): void; zicht(aan: boolean): void } {
  const menu = document.createElement('div');
  menu.id = 'bouw';
  menu.setAttribute('aria-label', 'Build menu');
  menu.innerHTML = '<div class="kop"></div><div class="kaarten"></div><div class="melding"></div><div class="detail"></div><div class="gekozen"><div class="vast"></div><div class="stand"></div></div>';
  document.body.appendChild(menu);
  schermAf(menu);
  tipsIn(menu);
  const deel = (q: string) => menu.querySelector<HTMLElement>(q)!;
  const kop = deel('.kop'), kaarten = deel('.kaarten'), meld = deel('.melding'), detail = deel('.detail'), vast = deel('.gekozen .vast'), stand = deel('.gekozen .stand');
  const vorige = new Map<HTMLElement, string>();
  const zet = (el: HTMLElement, html: string) => {
    if (vorige.get(el) === html) return;
    vorige.set(el, html);
    el.innerHTML = html;
    el.hidden = !html;
  };

  // Aanwijzen en klikken. Op pointerdown, niet op click: een kaart die net opnieuw getekend is zou een click missen.
  let wijst: string | null = null;
  kaarten.addEventListener('pointerover', (e) => {
    wijst = (e.target as HTMLElement).closest<HTMLElement>('[data-kies]')?.dataset.kies ?? null;
  });
  kaarten.addEventListener('pointerleave', () => (wijst = null));
  menu.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement, s = h.staat();
    // vrijkopen: 'g:<gebouw>' uit de economie van deze wereld, of 'r:<recept>' uit de economie van het aangeklikte gebouw
    const kopen = el.closest<HTMLElement>('[data-koop]');
    if (kopen) {
      const [soort, id] = [kopen.dataset.koop![0], kopen.dataset.koop!.slice(2)];
      const eco = soort === 'g' ? actieveEconomie() : economie(kopen.dataset.eco!);
      const wat = soort === 'g' ? eco.gebouwen.get(id) : eco.recepten.get(id);
      if (wat) koop(s, eco, wat);
      return;
    }
    const kaart = el.closest<HTMLElement>('[data-kies]');
    if (kaart) return h.kies(kaart.dataset.kies!);
    const g = industrie(s).gebouwen.find((x) => x.id === h.gekozen());
    if (!g) return;
    const recept = el.closest<HTMLElement>('[data-recept]');
    if (recept) return kiesRecept(s, g, recept.dataset.recept || null);
    const uit = el.closest<HTMLElement>('[data-uit]');
    if (uit) zetUit(s, g, uit.dataset.uit!);
  });

  function kaartenHtml(s: SpelStaat): string {
    return knoppen().map((k) => {
      const b = k.soort, plaatje = b ? gebouwPlaatje(b) : undefined;
      const opSlot = !!b && !isVrij(s, actieveEconomie().id, b);
      const duur = b && !opSlot && !kanBetalen(s.voorraad, b.cost);
      return `<button class="kaart${h.modus() === k.id ? ' aan' : ''}${duur ? ' duur' : ''}${opSlot ? ' slot' : ''}${b ? '' : ' sloop'}" data-kies="${k.id}">
        ${b && b.tier > 1 ? `<span class="tier">${opSlot ? 'LOCKED ' : ''}T${b.tier}</span>` : ''}
        ${b ? '' : '<span class="toets">X</span>'}
        <span class="beeld">${plaatje ? `<img src="${plaatje}" alt="">` : b ? `<i style="background:${b.color}"></i>` : '<b>X</b>'}</span>
        <span class="naam">${veilig(k.naam)}</span>
        <span class="kost">${opSlot ? `<span class="stuk${(s.voorraad[ONDERZOEK] ?? 0) < b!.unlock ? ' tekort' : ''}">${icoon(ONDERZOEK)}${b!.unlock}</span>` : b ? stuks(b.cost, s.voorraad) + (b.aard === 'belt' ? '<span class="per">/tile</span>' : '') : '<span class="stuk gratis">COST BACK</span>'}</span>
      </button>`;
    }).join('');
  }

  // Alles over het gebouw dat je aanwijst (of, als je niets aanwijst, het gebouw dat je aan het neerzetten bent).
  function detailHtml(s: SpelStaat): string {
    const k = knoppen().find((x) => x.id === (wijst ?? h.modus()));
    if (!k) return '';
    const b = k.soort;
    if (!b) return `<div class="titel"><b>${k.naam}</b><span class="soort">TOOL</span></div><p>${veilig(k.uitleg)}</p>`;
    const eco = actieveEconomie(), plaatje = gebouwPlaatje(b);
    const feiten: [string, string][] = [['SIZE', `${b.size} x ${b.size}`], ['BUILD', `${b.work} s`]];
    if (b.kW > 0) feiten.push(['POWER', `${b.kW} kW`]);
    if (b.crew > 0) feiten.push(['CREW', `${b.crew} rats`]);
    if (b.aard === 'sink') feiten.push(['STORAGE', `+${b.storage}`]);
    if (b.aard === 'prod' && !b.generator) feiten.push(['OUTPUT', `holds ${b.storage}`]);
    if (b.generator) feiten.push(['GIVES', `${Math.max(...b.recipes.map((id) => actieveEconomie().recepten.get(id)?.power ?? 0))} kW`]);
    if (b.aard === 'belt') feiten.push(['SPEED', `${b.speed} tiles/s`]);
    if (b.aard === 'grabber') feiten.push(['SPEED', `${+(b.speed / 2).toFixed(2)} goods/s`]);
    if (b.aard === 'pole') feiten.push(['REACH', `${b.reach} tiles`], ['LINK', `${b.link} tiles`]);
    if (b.onDeposit) feiten.push(['RANGE', `${b.range} tiles`]);
    feiten.push(['WHERE', b.insideRing ? 'inside the ring' : b.onDeposit ? 'next to a field' : 'anywhere']);
    const recepten = b.recipes.map((id) => eco.recepten.get(id)!).filter(Boolean);
    return `<div class="titel"><b>${veilig(b.name)}</b><span class="soort">${soortNaam(b)}</span></div>
      <div class="boven">${plaatje ? `<img class="groot" src="${plaatje}" alt="">` : ''}<p>${veilig(k.uitleg)}</p></div>
      ${slotHtml(s, b)}
      <div class="feiten">${feiten.map(([a, w]) => `<span><i>${a}</i>${w}</span>`).join('')}</div>
      <div class="rij"><i>COST${b.aard === 'belt' ? ' PER TILE' : ''}</i><span class="lijst">${Object.entries(b.cost).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) =>
        `<span class="stuk${(s.voorraad[g] ?? 0) < (n ?? 0) ? ' tekort' : ''}">${icoon(g)}${n}<small>have ${Math.floor(s.voorraad[g] ?? 0)}</small></span>`).join('') || '<span class="stuk gratis">FREE</span>'}</span></div>
      ${recepten.length ? `<div class="rij"><i>${b.onDeposit ? 'DIGS' : recepten.length > 1 ? 'RECIPES' : b.generator ? 'BURNS' : 'RECIPE'}</i><span class="lijst kolom">${recepten.map((r) =>
        `<span class="recept${isVrij(s, eco.id, r) ? '' : ' slot'}" data-tip="${veilig(r.name)}${isVrij(s, eco.id, r) ? '' : `: locked, ${r.unlock} research packs`}">${receptRegel(r)}${isVrij(s, eco.id, r) ? '' : `<span class="tier">T${r.tier}</span>`}</span>`).join('')}</span></div>` : ''}`;
  }
  // Een gebouw op slot: zijn tier, de prijs en de knop om het vrij te kopen (met de reden als het nog niet kan).
  function slotHtml(s: SpelStaat, b: BouwSoort): string {
    const eco = actieveEconomie();
    if (isVrij(s, eco.id, b)) return '';
    const o = koopOordeel(s, eco, b);
    return `<div class="slotbalk"><span>LOCKED · TIER ${b.tier}</span><button class="${o.ok ? 'kan' : 'nee'}" data-koop="g:${b.id}">UNLOCK ${icoon(ONDERZOEK)}${b.unlock}</button>${o.ok ? '' : `<small>${veilig(o.reden)}</small>`}</div>`;
  }

  // Het gebouw dat je in de wereld hebt aangeklikt: het vaste deel (naam, knoppen) en de stand (verandert steeds).
  function gekozenHtml(s: SpelStaat, g: Gebouw): [string, string] {
    const b = soortVan(g);
    let vastHtml = `<div class="titel"><b>${veilig(b.name)}</b><span class="soort">SELECTED</span></div>`;
    let standHtml = '';
    if (g.af) standHtml = `<p class="bouwt">BEING BUILT${leeg(g.nodig) ? '' : '. STILL NEEDS'}</p>${leeg(g.nodig) ? '' : `<div class="lijst">${stuks(g.nodig)}</div>`}`;
    else if (b.aard === 'sink') {
      const keuze = [...new Set([...(g.uit ? [g.uit] : []), ...Object.keys(s.voorraad).filter((x) => (s.voorraad[x] ?? 0) >= 1)])];
      vastHtml += `<p>+${b.storage} storage. A belt starting next to it takes out:</p>
        <div class="knoppen">${keuze.map((x) => `<button class="${g.uit === x ? 'aan' : ''}" data-uit="${x}" data-tip="Belts next to this ${veilig(b.name.toLowerCase())} take ${veilig(naamVan(x).toLowerCase())} out. Click again to stop">${icoon(x)}${veilig(naamVan(x))}</button>`).join('') || '<span class="stil">NOTHING IN STORAGE YET</span>'}</div>`;
    } else if (b.aard === 'prod') {
      const r = receptVan(g);
      if (!b.onDeposit)
        vastHtml += `<div class="knoppen kolom">${[...receptenVan(g), null].map((x) => {
          if (x && !isVrij(s, g.eco, x)) {
            const o = koopOordeel(s, economie(g.eco), x);
            return `<button class="slot ${o.ok ? 'kan' : 'nee'}" data-koop="r:${x.id}" data-eco="${g.eco}" data-tip="${veilig(x.name)}: locked (tier ${x.tier}). ${veilig(o.reden)}">${receptRegel(x)}<span class="prijs">UNLOCK ${icoon(ONDERZOEK)}${x.unlock}</span></button>`;
          }
          return `<button class="${g.recept === (x?.id ?? null) ? 'aan' : ''}" data-recept="${x?.id ?? ''}" data-tip="${x ? veilig(x.name) : `Stop this ${veilig(b.name.toLowerCase())}`}">${x ? receptRegel(x) : 'STOP'}</button>`;
        }).join('')}</div>`;
      const telling: Voorraad = {};
      for (const x of g.buffer) telling[x] = (telling[x] ?? 0) + 1;
      standHtml = `<p class="${g.geblokt ? 'geblokt' : 'draait'}">${veilig(g.geblokt || (r ? r.name.toUpperCase() : 'IDLE'))}</p>
        <div class="balk"><i style="width:${Math.round(100 * Math.min(1, g.klok))}%"></i></div>
        <div class="feiten">${b.generator ? `<span><i>GIVES</i>${g.betaald && !g.geblokt ? r?.power ?? 0 : 0} kW</span>` : `<span><i>OUTPUT</i>${Math.round(volumeVan(telling, (x) => goed(x).volume))}/${b.storage}</span>`}${b.crew ? `<span><i>RATS</i>${g.ploeg}/${b.crew}</span>` : ''}${b.kW ? `<span><i>POWER</i>${b.kW} kW</span>` : ''}</div>
        ${r && !leeg(r.inputs) ? `<div class="rij"><i>IN</i><span class="lijst">${Object.keys(r.inputs).map((x) => `<span class="stuk">${icoon(x)}${Math.floor(g.invoer[x] ?? 0)}</span>`).join('')}</span></div>` : ''}
        ${r && !leeg(r.outputs) ? `<div class="rij"><i>OUT</i><span class="lijst">${Object.keys(r.outputs).map((x) => `<span class="stuk">${icoon(x)}${telling[x] ?? 0}</span>`).join('')}</span></div>` : ''}`;
    } else vastHtml += `<p>${veilig(uitlegVan(b))}</p>`;
    if (b.aard === 'grabber' && !g.af) standHtml = `<p class="${g.geblokt ? 'geblokt' : 'draait'}">${veilig(g.geblokt || (g.buffer.length ? `CARRYING ${naamVan(g.buffer[0])}` : 'WAITING FOR A GOOD'))}</p>`;
    if (b.aard === 'prod' && !b.onDeposit) vastHtml += '<p class="tip">R turns its arrows: where belts go in and come out.</p>';
    return [vastHtml, standHtml];
  }

  let open = true, klok = 1;
  return {
    zicht(aan) {
      open = aan;
      menu.style.display = aan ? '' : 'none';
    },
    werk(sec) {
      klok += sec;
      if (!open || klok < 0.12) return;
      klok = 0;
      const s = h.staat(), eco = actieveEconomie();
      const vol = opslagVol(s), max = opslagMax(s);
      zet(kop, `<b>BUILD</b><span class="eco" data-tip="The economy of this world: what lies here and what you can build">${veilig(eco.name)}</span>
        <span class="bestand" data-tip="The file this economy comes from">economies/${veilig(eco.id)}.json</span>
        <span class="packs" data-tip="Research packs: made in the laboratory, spent here to unlock buildings and recipes. They vaporize in the stream">${icoon(ONDERZOEK)}${Math.floor(s.voorraad[ONDERZOEK] ?? 0)}</span>
        <span class="opslag${vol >= max - 1 ? ' vol' : ''}" data-tip="Storage used: everything shares one stock">STORAGE ${Math.round(vol)}/${Math.round(max)}</span>`);
      zet(kaarten, kaartenHtml(s));
      const m = h.melding();
      zet(meld, m && m.reden ? `<span class="${m.ok ? 'ok' : 'fout'}">${veilig(m.reden)}</span>` : '');
      zet(detail, detailHtml(s));
      const g = industrie(s).gebouwen.find((x) => x.id === h.gekozen());
      const [a, b] = g ? gekozenHtml(s, g) : ['', ''];
      zet(vast, a);
      zet(stand, b);
    },
  };
}
