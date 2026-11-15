// Industrie van de pack rats: alles wat je neerzet. Wat er te bouwen valt, wat het kost en wat het doet staat in de
// economie van de wereld (economies/*.json, kern/economie.ts); dit bestand kent alleen de soorten gedrag:
//   prod      maakt iets volgens een recept (fabricator); met "onDeposit" staat hij bij een veld en wint hij dat veld (boor)
//   sink      magazijn: neemt alles aan en geeft de opslag meer ruimte
//   trash     vernietigt wat een band erin brengt
//   splitter / merger   kruispunt op de banden: wat erin loopt gaat om de beurt de banden op die ervan weg lopen
//   belt      lopende band, één tegel
//   pole      paal: draagt stroom verder
// Puur regels, geen tekenen en geen Math.random. Getallen die niet bij een economie horen staan in src/data/ratten.ts.
//
// - Neerzetten maakt een bouwplek. Ratten halen de bouwspullen uit de opslag, brengen ze en bouwen het af (werk.ts).
// - Een productiegebouw krijgt zijn invoer gebracht (ratten, of een band die erin loopt) en legt wat het maakt voor zijn
//   voet. Daar gaat het een band op die tegen de voet begint, of ratten sjouwen het naar de opslag.
//   Maakt een recept meer dan één product, dan heeft elk product zijn eigen randtegels (zie `uitgangen`): een band die
//   daar begint draagt alleen dat product.
// - Gebouwen met stroomvraag draaien alleen binnen bereik van de machine of van een aangesloten paal.
// - Een gebouw onthoudt uit welke economie het komt: na een sprong naar een andere wereld blijft het staan en werken.
// - Bij de stream wordt alles buiten de ring ingepakt: de bouwkosten komen terug.
import { actieveEconomie, economie, goed, grondstoffenVan, volumeVan, type BouwSoort, type ReceptSoort } from '../kern/economie';
import { binnenBlok, binnenRing, type Blok } from '../kern/kaart';
import { TEGEL_WATER } from '../kern/terrein';
import type { SpelStaat } from '../kern/spel';
import type { Band, Goed, Richting, Trucje, Voorraad } from '../kern/types';
import { energie, log, verbruiker } from './energie';
import { betaal, kanBetalen, kostTekst, naamVan, terug } from './kosten';

export interface IndustrieGetallen {
  vliegSec: number; // zo lang vliegt een winningsgebouw van de machine naar zijn veld
  hoop: number; // zoveel is één hoop in beeld
  ploegBouw: number; // zoveel ratten tegelijk op één bouwplek
  machineBereik: number; // zo ver om de machine is er stroom zonder paal
  invoerKeer: number; // een gebouw wil genoeg invoer hebben liggen voor zoveel keer zijn recept
  kruispunt: number; // zoveel stuks houdt een splitter of merger vast
}

// Een gebouw op de kaart. Welke velden iets betekenen hangt af van zijn soort (soortVan).
export interface Gebouw {
  id: number;
  eco: string; // economie waaruit het gebouwd is
  soort: string; // id van het gebouw in die economie
  x: number; // tegel linksachter
  y: number;
  af: number; // werk dat nog moet (rat-seconden); 0 = klaar
  nodig: Voorraad; // bouwspullen die ratten nog moeten brengen; pas als dit leeg is kan er gebouwd worden
  recept: string | null; // prod: wat hij maakt
  invoer: Voorraad; // prod: gebrachte invoer (door ratten of over een band)
  betaald: boolean; // prod: de invoer voor het huidige stuk is afgeboekt
  klok: number; // prod: 0..1 van het huidige stuk
  ploeg: number; // prod: ratten die er nu werken (zet werk.ts)
  geblokt: string; // prod: waarom hij stilstaat ('' = draait)
  buffer: Goed[]; // wat klaar ligt voor zijn voet (prod) of doorgegeven wordt (splitter, merger)
  uitvoer: number; // om de beurt: bij welke randtegel de volgende keer begonnen wordt
  vlieg: number; // seconden nog in de lucht (gegooid door de machine); 0 = staat
  graaft: boolean; // onDeposit: is nu aan het winnen (voor het beeld)
  uit: Goed | null; // sink: welk goed een band ernaast eruit trekt (instelbaar: klik erop)
}
export interface MBand extends Band {
  eco: string;
  soort: string;
  af: number;
  nodig: Voorraad;
}
export interface IndustrieStaat {
  gebouwen: Gebouw[];
  banden: Map<number, MBand>; // sleutel = tegel(x, y)
  basis: number; // volume van het magazijn waarmee je begon
  volGemeld: boolean;
  volgendeId: number;
  net: { tik: number; palen: Set<number> };
}

export const RICHTINGEN: Record<Richting, [number, number]> = { O: [1, 0], W: [-1, 0], Z: [0, 1], N: [0, -1] };
export const tegel = (x: number, y: number) => y * 1000 + x;
export const leeg = (v: Voorraad) => !Object.values(v).some((n) => (n ?? 0) > 0);

let G: IndustrieGetallen;
let tik = 0;
const STATEN = new WeakMap<SpelStaat, IndustrieStaat>();
export const getallen = () => G;

export function industrie(s: SpelStaat): IndustrieStaat {
  let i = STATEN.get(s);
  if (!i) {
    i = { gebouwen: [], banden: new Map(), basis: actieveEconomie().warehouseStorage, volGemeld: false, volgendeId: 1, net: { tik: -1, palen: new Set() } };
    STATEN.set(s, i);
  }
  return i;
}

// ---- de economie ----
// Wat er in deze wereld te halen, te maken en te bouwen valt (de economie van de wereld waar je nu bent).
export const grondstoffen = (): Goed[] => grondstoffenVan(actieveEconomie());
export const goederen = (): Goed[] => [...actieveEconomie().goederen.keys()];
export const bouwSoorten = (): BouwSoort[] => [...actieveEconomie().gebouwen.values()];
export const bandSoort = (): BouwSoort | undefined => bouwSoorten().find((b) => b.aard === 'belt');
// De soort van iets dat er al staat: uit de economie waarin het gebouwd is.
export const soortVan = (g: { eco: string; soort: string }): BouwSoort => economie(g.eco).gebouwen.get(g.soort)!;
export const receptVan = (g: Gebouw): ReceptSoort | undefined => (g.recept ? economie(g.eco).recepten.get(g.recept) : undefined);
export const receptenVan = (g: Gebouw): ReceptSoort[] => soortVan(g).recipes.map((r) => economie(g.eco).recepten.get(r)!);
const vol = (g: Goed) => goed(g).volume;
const volBuffer = (b: Goed[]) => b.reduce((n, g) => n + vol(g), 0);
// Wat er al gebracht is van de bouwkosten (voor slopen en inpakken).
function gebracht(soort: BouwSoort, nodig: Voorraad): Voorraad {
  const uit: Voorraad = {};
  for (const [g, n] of Object.entries(soort.cost)) uit[g] = (n ?? 0) - (nodig[g] ?? 0);
  return uit;
}
// Hoeveel invoer een gebouw wil hebben liggen: genoeg voor een paar keer.
export const invoerMax = (g: Gebouw, goedId: Goed) => (receptVan(g)?.inputs[goedId] ?? 0) * G.invoerKeer;

// ---- vaste plekken rond de machine ----
export function vast(s: SpelStaat): { erf: Blok; bronnen: Record<string, Blok> } {
  const m = s.kaart.machine, o = s.kaart.opslag;
  return {
    erf: { x: o.x + o.breed, y: o.y, breed: 2, diep: 2 },
    bronnen: {
      rad: { x: m.x - 3, y: m.y + 1, breed: 2, diep: 2 },
      dynamo: { x: m.x - 3, y: m.y - 2, breed: 2, diep: 2 },
      houtbrander: { x: m.x + 1, y: m.y - 3, breed: 2, diep: 2 },
      reactor: { x: m.x + 4, y: m.y - 3, breed: 2, diep: 2 },
    },
  };
}
export const blokVan = (g: { eco: string; soort: string; x: number; y: number }): Blok => {
  const m = soortVan(g).size;
  return { x: g.x, y: g.y, breed: m, diep: m };
};
export const midden = (b: Blok) => ({ x: b.x + b.breed / 2 - 0.5, y: b.y + b.diep / 2 - 0.5 });
const klaar = (g: Gebouw) => !g.af && !g.vlieg;
export const palen = (i: IndustrieStaat) => i.gebouwen.filter((g) => soortVan(g).aard === 'pole');
export const makers = (i: IndustrieStaat) => i.gebouwen.filter((g) => soortVan(g).aard === 'prod');
export const magazijnen = (i: IndustrieStaat) => i.gebouwen.filter((g) => soortVan(g).aard === 'sink');

// ---- de opslag: één voorraad, gemeten in volume ----
// Het magazijn waarmee je begint plus elk afgebouwd magazijn. Elk goed neemt zijn eigen volume in.
export function opslagMax(s: SpelStaat): number {
  const i = industrie(s);
  return i.basis + magazijnen(i).filter(klaar).reduce((n, g) => n + soortVan(g).storage, 0);
}
export const opslagVol = (s: SpelStaat): number => volumeVan(s.voorraad, vol);
// Hoeveel stuks van dit goed er nog bij kunnen.
export const ruimteVoor = (s: SpelStaat, g: Goed): number => Math.floor((opslagMax(s) - opslagVol(s)) / vol(g) + 1e-9);
// Met de hand graven ratten een grondstof maar tot haar deel van de opslag, zodat één veld niet alles vult.
export const handRuimte = (s: SpelStaat, g: Goed): number =>
  Math.min(ruimteVoor(s, g), Math.floor(opslagMax(s) / Math.max(1, actieveEconomie().goederen.size)) - (s.voorraad[g] ?? 0));

// ---- het stroomnet van palen ----
// De machine is de wortel. Een paal hangt eraan als hij binnen zijn `link` van de machine of van een aangesloten paal staat.
export function aangesloten(s: SpelStaat): Set<number> {
  const i = industrie(s);
  if (i.net.tik === tik) return i.net.palen;
  const m = midden(s.kaart.machine);
  const af = palen(i).filter(klaar);
  const in_ = new Set<number>();
  const rij = af.filter((p) => Math.hypot(p.x - m.x, p.y - m.y) <= soortVan(p).link);
  rij.forEach((p) => in_.add(p.id));
  while (rij.length) {
    const p = rij.pop()!;
    for (const q of af)
      if (!in_.has(q.id) && Math.hypot(p.x - q.x, p.y - q.y) <= soortVan(q).link) {
        in_.add(q.id);
        rij.push(q);
      }
  }
  i.net = { tik, palen: in_ };
  return in_;
}
// Krijgt dit blok stroom? Binnen bereik van de machine of van een aangesloten paal.
export function gevoed(s: SpelStaat, b: Blok): boolean {
  const c = midden(b);
  const m = midden(s.kaart.machine);
  if (Math.hypot(c.x - m.x, c.y - m.y) <= G.machineBereik) return true;
  const net = aangesloten(s);
  return palen(industrie(s)).some((p) => net.has(p.id) && Math.hypot(p.x - c.x, p.y - c.y) <= soortVan(p).reach);
}

// Hoeveel kW de industrie vraagt: wat klaar is en stroom kan krijgen.
export function industrieVraag(s: SpelStaat): number {
  const i = industrie(s);
  let kw = 0;
  for (const b of i.banden.values()) if (!b.af) kw += soortVan(b).kW;
  for (const g of makers(i)) if (klaar(g) && (g.recept || soortVan(g).onDeposit) && gevoed(s, blokVan(g))) kw += soortVan(g).kW;
  return Math.round(kw * 10) / 10;
}
const kracht = (s: SpelStaat) => verbruiker(s, 'industrie').krijgt;

// ---- wat staat waar ----
export const gebouwOp = (s: SpelStaat, x: number, y: number) => industrie(s).gebouwen.find((g) => binnenBlok(blokVan(g), x, y));
// Hoort deze tegel bij de opslag? Het magazijn van het begin, het erf ernaast en elk afgebouwd magazijn.
export function inOpslag(s: SpelStaat, x: number, y: number): boolean {
  if (binnenBlok(s.kaart.opslag, x, y) || binnenBlok(vast(s).erf, x, y)) return true;
  const g = gebouwOp(s, x, y);
  return !!g && klaar(g) && soortVan(g).aard === 'sink';
}

function bezet(s: SpelStaat, x: number, y: number): boolean {
  const k = s.kaart;
  if (x < 1 || y < 1 || x >= k.breed - 1 || y >= k.diep - 1) return true;
  if (k.soort[y * k.breed + x] === TEGEL_WATER) return true; // niet bouwen in het water
  const v = vast(s);
  return binnenBlok(k.machine, x, y) || binnenBlok(k.opslag, x, y) || binnenBlok(v.erf, x, y) ||
    Object.values(v.bronnen).some((b) => binnenBlok(b, x, y)) || !!gebouwOp(s, x, y);
}
const grondstofOp = (s: SpelStaat, x: number, y: number) => s.kaart.afzettingen.some((a) => a.x === x && a.y === y && a.rest > 0);
const vrijVoorBlok = (s: SpelStaat, x: number, y: number, w: number) => {
  for (let dy = 0; dy < w; dy++)
    for (let dx = 0; dx < w; dx++)
      if (bezet(s, x + dx, y + dy) || grondstofOp(s, x + dx, y + dy) || industrie(s).banden.has(tegel(x + dx, y + dy))) return false;
  return true;
};

// De tegels met grondstof die een winningsgebouw op (x, y) kan bereiken: alleen wat zijn recepten kunnen winnen.
export function bereikVan(s: SpelStaat, soort: BouwSoort, x: number, y: number) {
  const r = soort.range, w = soort.size - 1;
  return s.kaart.afzettingen.filter((a) => a.rest > 0 && soort.depRes.includes(a.goed) && a.x >= x - r && a.x <= x + w + r && a.y >= y - r && a.y <= y + w + r);
}

export interface Oordeel {
  ok: boolean;
  reden: string;
}
// Neerzetten kan altijd; ratten brengen de spullen zodra ze in de opslag liggen.
const kostOk = (s: SpelStaat, soort: BouwSoort): Oordeel | null =>
  kanBetalen(s.voorraad, soort.cost) ? null : { ok: true, reden: `NOT IN STOCK YET: ${kostTekst(soort.cost, true)}. RATS BRING IT LATER` };

export function kanZetten(s: SpelStaat, soort: BouwSoort, x: number, y: number): Oordeel {
  if (s.onderweg > 0) return { ok: false, reden: 'WAIT FOR THE LANDING' };
  if (soort.aard === 'belt') return { ok: kanBandOp(s, x, y), reden: '' };
  const w = soort.size;
  if (!vrijVoorBlok(s, x, y, w)) return { ok: false, reden: soort.onDeposit ? 'NOT HERE: NEXT TO THE FIELD, NOT ON IT' : 'SOMETHING IS IN THE WAY' };
  if (soort.insideRing)
    for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) if (!binnenRing(s.kaart, x + dx, y + dy)) return { ok: false, reden: 'ONLY INSIDE THE RING' };
  if (soort.onDeposit && !bereikVan(s, soort, x, y).length) return { ok: false, reden: `NO ${soort.depRes.map(naamVan).join(' OR ')} IN RANGE` };
  const duur = kostOk(s, soort);
  if (duur) return duur;
  const blok = { x, y, breed: w, diep: w };
  const stroom = soort.kW > 0 ? (gevoed(s, blok) ? `. ${soort.kW} KW` : '. NO POWER YET: PLACE A POLE') : '';
  if (soort.aard === 'pole') {
    const m = midden(s.kaart.machine);
    const net = aangesloten(s);
    const hangt = Math.hypot(x - m.x, y - m.y) <= soort.link || palen(industrie(s)).some((p) => net.has(p.id) && Math.hypot(p.x - x, p.y - y) <= soort.link);
    return { ok: true, reden: hangt ? `${soort.name} HERE: CONNECTED TO THE GRID` : `${soort.name} HERE, BUT TOO FAR: AT MOST ${soort.link} TILES BETWEEN POLES` };
  }
  if (soort.aard === 'sink') return { ok: true, reden: `${soort.name} HERE: +${soort.storage} STORAGE. CLICK IT LATER TO LET A BELT TAKE GOODS OUT` };
  if (soort.aard === 'trash') return { ok: true, reden: `${soort.name} HERE: DESTROYS WHAT A BELT BRINGS IN` };
  if (soort.aard === 'splitter' || soort.aard === 'merger') return { ok: true, reden: `${soort.name} HERE: BELTS RUN IN, BELTS RUN OUT, IN TURNS` };
  return { ok: true, reden: `${soort.name} HERE${stroom}` };
}

// Zet een bouwplek neer voor een gebouw uit de economie van deze wereld (`wat` = de soort of haar id).
export function zet(s: SpelStaat, wat: BouwSoort | string, x: number, y: number): Gebouw | null {
  const soort = typeof wat === 'string' ? actieveEconomie().gebouwen.get(wat) : wat;
  const e = energie(s);
  if (!soort || soort.aard === 'belt') return null;
  const o = kanZetten(s, soort, x, y);
  if (!o.ok) {
    log(e, o.reden, 'rood');
    return null;
  }
  const i = industrie(s);
  const g: Gebouw = {
    id: i.volgendeId++, eco: actieveEconomie().id, soort: soort.id, x, y, af: soort.work, nodig: { ...soort.cost },
    // één recept: dat draait hij meteen; meer recepten: klik erop en kies
    recept: soort.aard === 'prod' && !soort.onDeposit && soort.recipes.length === 1 ? soort.recipes[0] : null,
    invoer: {}, betaald: false, klok: 0, ploeg: 0, geblokt: '', buffer: [], uitvoer: 0,
    vlieg: soort.onDeposit ? G.vliegSec : 0, graaft: false, uit: null,
  };
  i.gebouwen.push(g);
  if (soort.onDeposit) log(e, `${soort.name} THROWN! RATS BRING ${kostTekst(g.nodig, true)} AND BUILD IT`, 'groen');
  else if (soort.aard === 'prod' && !g.recept) log(e, `${soort.name} SITE PLACED. CLICK IT TO PICK A RECIPE`, 'groen');
  else log(e, `${soort.name} PLACED`, 'groen');
  return g;
}

// Een band leggen langs een pad. Bestaande banden draaien gratis mee; elke nieuwe tegel kost een stuk band.
export function kanBandOp(s: SpelStaat, x: number, y: number): boolean {
  return !bezet(s, x, y) && !grondstofOp(s, x, y);
}
export function legBand(s: SpelStaat, pad: { x: number; y: number; naar: Richting }[]): number {
  const i = industrie(s);
  const soort = bandSoort();
  if (!soort) return 0;
  let nieuw = 0;
  for (const p of pad) {
    if (!kanBandOp(s, p.x, p.y)) continue;
    const oud = i.banden.get(tegel(p.x, p.y));
    if (oud) {
      oud.naar = p.naar;
      continue;
    }
    i.banden.set(tegel(p.x, p.y), { x: p.x, y: p.y, naar: p.naar, voortgang: 0, eco: actieveEconomie().id, soort: soort.id, af: soort.work, nodig: { ...soort.cost } });
    nieuw++;
  }
  // Sluit aan: een band die doodloopt naast het begin van dit stuk, draait er vanzelf naartoe.
  const eerste = pad[0];
  if (eerste && i.banden.has(tegel(eerste.x, eerste.y)))
    for (const [r, [dx, dy]] of Object.entries(RICHTINGEN) as [Richting, [number, number]][]) {
      const buur = i.banden.get(tegel(eerste.x - dx, eerste.y - dy));
      if (!buur || pad.some((p) => p.x === buur.x && p.y === buur.y)) continue;
      const [vx, vy] = RICHTINGEN[buur.naar];
      if (!i.banden.has(tegel(buur.x + vx, buur.y + vy)) && !inOpslag(s, buur.x + vx, buur.y + vy) && !gebouwOp(s, buur.x + vx, buur.y + vy)) buur.naar = r;
    }
  if (nieuw) log(energie(s), `${nieuw} BELT TILES PLACED. RATS ARE LAYING THEM`, 'groen');
  return nieuw;
}

// Slopen: je krijgt de bouwkosten terug (wat erin zat gaat naar de opslag).
function ruimOp(s: SpelStaat, g: Gebouw): void {
  const v = s.voorraad;
  for (const x of g.buffer) v[x] = (v[x] ?? 0) + 1;
  const r = receptVan(g);
  if (g.betaald && r) terug(v, r.inputs);
  terug(v, g.invoer);
  terug(v, gebracht(soortVan(g), g.nodig));
}
function ruimBand(s: SpelStaat, t: MBand): void {
  if (t.goed) s.voorraad[t.goed] = (s.voorraad[t.goed] ?? 0) + 1;
  terug(s.voorraad, gebracht(soortVan(t), t.nodig));
}
export function sloop(s: SpelStaat, x: number, y: number): boolean {
  const i = industrie(s);
  const band = i.banden.get(tegel(x, y));
  if (band) {
    ruimBand(s, band);
    i.banden.delete(tegel(x, y));
    return true;
  }
  const g = gebouwOp(s, x, y);
  if (!g) return false;
  ruimOp(s, g);
  i.gebouwen.splice(i.gebouwen.indexOf(g), 1);
  return true;
}

// ---- gebouwen instellen ----
// Welk goed een band naast dit magazijn eruit trekt (null = niets).
export function zetUit(s: SpelStaat, g: Gebouw, goedId: Goed | null): void {
  g.uit = g.uit === goedId ? null : goedId;
  log(energie(s), g.uit ? `BELTS NEXT TO THIS ${soortVan(g).name} TAKE ${naamVan(g.uit)}` : `THIS ${soortVan(g).name} ONLY STORES`, 'cyaan');
}
export function kiesRecept(s: SpelStaat, g: Gebouw, r: string | null): void {
  if (g.recept === r) return;
  const oud = receptVan(g), nieuw = r ? economie(g.eco).recepten.get(r) : undefined;
  if (r && !nieuw) return;
  if (g.betaald && oud) terug(s.voorraad, oud.inputs);
  // wat er lag en het nieuwe recept niet gebruikt, gaat terug naar de opslag
  for (const [x, n] of Object.entries(g.invoer)) if (!nieuw || !nieuw.inputs[x]) {
    s.voorraad[x] = (s.voorraad[x] ?? 0) + (n ?? 0);
    delete g.invoer[x];
  }
  g.recept = r;
  g.betaald = false;
  g.klok = 0;
  log(energie(s), nieuw ? `${soortVan(g).name}: ${nieuw.name.toUpperCase()} (${kostTekst(nieuw.inputs, true)})` : `${soortVan(g).name} STOPPED`, 'cyaan');
}

// ---- productie ----
function stapMakers(s: SpelStaat, sec: number): void {
  const i = industrie(s);
  const k = kracht(s);
  for (const g of i.gebouwen) {
    const soort = soortVan(g);
    if (soort.aard === 'splitter' || soort.aard === 'merger') {
      if (klaar(g) && g.buffer.length) zetOpBand(i, g);
      continue;
    }
    if (soort.aard !== 'prod') continue;
    g.graaft = false;
    if (g.vlieg > 0) {
      g.vlieg = Math.max(0, g.vlieg - sec);
      continue;
    }
    if (g.af) continue;
    if (g.buffer.length) zetOpBand(i, g);
    // een winningsgebouw draait het recept dat het veld in zijn bereik geeft
    const veld = soort.onDeposit ? bereikVan(s, soort, g.x, g.y) : null;
    const bron = veld?.length ? veld[g.id % veld.length] : null;
    if (soort.onDeposit) {
      if (!bron) {
        g.geblokt = 'THE FIELD IS EMPTY';
        continue;
      }
      g.recept = receptenVan(g).find((r) => (r.outputs[bron.goed] ?? 0) > 0)?.id ?? null;
    }
    const r = receptVan(g);
    if (!r) {
      g.geblokt = 'PICK A RECIPE';
      continue;
    }
    if (volBuffer(g.buffer) + volumeVan(r.outputs, vol) > soort.storage + 1e-9) {
      g.geblokt = 'OUTPUT FULL';
      continue;
    }
    if (!g.betaald) {
      if (!betaal(g.invoer, r.inputs)) {
        g.geblokt = `WAITING FOR ${kostTekst(r.inputs, true)}`;
        continue;
      }
      g.betaald = true;
    }
    if (soort.kW > 0 && (!gevoed(s, blokVan(g)) || k <= 0)) {
      g.geblokt = 'NO POWER';
      continue;
    }
    if (soort.crew > 0 && !g.ploeg) {
      g.geblokt = 'WAITING FOR RATS';
      continue;
    }
    g.geblokt = '';
    g.graaft = !!bron;
    g.klok += (sec * soort.speed * (soort.kW > 0 ? k : 1) * (soort.crew > 0 ? Math.min(1, g.ploeg / soort.crew) : 1)) / r.time;
    if (g.klok < 1) continue;
    g.klok = bron ? g.klok - 1 : 0;
    g.betaald = false;
    for (const [x, n] of Object.entries(r.outputs)) {
      let stuks = n ?? 0;
      if (bron && x === bron.goed) {
        stuks = Math.min(stuks, bron.rest); // het veld raakt op
        bron.rest -= stuks;
      }
      for (let j = 0; j < stuks; j++) g.buffer.push(x);
    }
  }
}

// ---- elke tik ----
function stapIndustrie(s: SpelStaat, sec: number): void {
  const i = industrie(s);
  if (s.onderweg > 0) return; // in het niets staat alles stil
  const v = s.voorraad;

  // Opslag vol: wat ratten er aan grondstof te veel in leggen valt eraf (de grootste hoop eerst). Onderdelen blijven.
  let over = opslagVol(s) - opslagMax(s);
  if (over > 1e-9)
    for (const g of grondstoffen().sort((a, b) => (v[b] ?? 0) * vol(b) - (v[a] ?? 0) * vol(a))) {
      const weg = Math.min(v[g] ?? 0, Math.ceil(over / vol(g) - 1e-9));
      if (weg <= 0) continue;
      v[g] = (v[g] ?? 0) - weg;
      over -= weg * vol(g);
      if (over <= 1e-9) break;
    }
  const vol_ = opslagMax(s) - opslagVol(s) < 1;
  if (vol_ && !i.volGemeld) log(energie(s), `STORAGE FULL: ${Math.round(opslagMax(s))}. BUILD MORE STORAGE OR USE WHAT YOU HAVE`, 'rood');
  i.volGemeld = vol_;

  stapMakers(s, sec);
  uitMagazijnen(s);

  // banden: van voor naar achter, zodat een volle rij in één tik doorschuift
  const k = kracht(s);
  const volgorde = [...i.banden.values()].filter((t) => t.goed && !t.af).sort((a, b) => afstandTotEind(i, a) - afstandTotEind(i, b));
  for (const t of volgorde) {
    const soort = soortVan(t);
    const snel = soort.speed * (soort.kW > 0 ? k : 1) * sec;
    if (snel <= 0) continue;
    t.voortgang += snel;
    if (t.voortgang < 1) continue;
    const [dx, dy] = RICHTINGEN[t.naar];
    const nx = t.x + dx, ny = t.y + dy;
    const volgende = i.banden.get(tegel(nx, ny));
    const g = t.goed as Goed;
    const af = () => {
      t.goed = undefined;
      t.voortgang = 0;
    };
    if (volgende) {
      if (!volgende.af && !volgende.goed) {
        volgende.goed = g;
        volgende.voortgang = Math.min(0.5, t.voortgang - 1);
        af();
      } else t.voortgang = 1;
      continue;
    }
    // de band loopt een gebouw of de opslag in
    const doel = gebouwOp(s, nx, ny);
    const aard = doel && klaar(doel) ? soortVan(doel).aard : null;
    if (doel && aard === 'prod' && !soortVan(doel).onDeposit && (doel.invoer[g] ?? 0) < invoerMax(doel, g)) {
      doel.invoer[g] = (doel.invoer[g] ?? 0) + 1;
      af();
    } else if (aard === 'trash') af();
    else if (doel && (aard === 'splitter' || aard === 'merger') && doel.buffer.length < G.kruispunt) {
      doel.buffer.push(g);
      af();
    } else if (inOpslag(s, nx, ny) && ruimteVoor(s, g) >= 1) {
      v[g] = (v[g] ?? 0) + 1;
      af();
    } else t.voortgang = 1; // loopt dood, of waar hij heen gaat is vol: hij staat stil
  }
}

const eindCache = new WeakMap<Band, { n: number; t: number }>();
function afstandTotEind(i: IndustrieStaat, t: Band): number {
  const c = eindCache.get(t);
  if (c && c.t === tik) return c.n;
  let n = 0, x = t.x, y = t.y, naar = t.naar;
  while (n < 60) {
    const [dx, dy] = RICHTINGEN[naar];
    const v = i.banden.get(tegel(x + dx, y + dy));
    if (!v) break;
    x = v.x;
    y = v.y;
    naar = v.naar;
    n++;
  }
  eindCache.set(t, { n, t: tik });
  return n;
}

// De tegels rondom een blok (voor banden die ertegenaan liggen), met de klok mee.
export const randVan = (b: Blok): [number, number][] => {
  const r: [number, number][] = [];
  const m = b.breed;
  for (let d = 0; d < m; d++) r.push([b.x + d, b.y - 1], [b.x + m, b.y + d], [b.x + m - 1 - d, b.y + m], [b.x - 1, b.y + m - 1 - d]);
  return r;
};
// Welk product bij welke randtegel hoort (zelfde volgorde als randVan). Eén product: elke tegel (null). Meer producten:
// om de beurt, zodat je per product een eigen band kunt leggen.
export function uitgangen(g: Gebouw): (Goed | null)[] {
  const r = receptVan(g), soort = soortVan(g);
  const producten = r && soort.aard === 'prod' && !soort.onDeposit ? Object.keys(r.outputs) : [];
  return randVan(blokVan(g)).map((_, k) => (producten.length > 1 ? producten[k % producten.length] : null));
}
// Loopt deze band van het gebouw weg (begint hij ertegenaan)?
const loopt = (i: IndustrieStaat, blok: Blok, x: number, y: number): MBand | null => {
  const t = i.banden.get(tegel(x, y));
  if (!t || t.af) return null;
  const [dx, dy] = RICHTINGEN[t.naar];
  return binnenBlok(blok, t.x + dx, t.y + dy) ? null : t;
};
// Ligt er een band tegen de voet van dit gebouw die zijn uitvoer meeneemt? Dan hoeven ratten niet te sjouwen.
export function heeftBand(i: IndustrieStaat, g: Gebouw): boolean {
  const blok = blokVan(g);
  return randVan(blok).some(([x, y]) => !!loopt(i, blok, x, y));
}
// Een band naast een magazijn trekt er het ingestelde goed uit (als hij er niet in loopt). Zo haal je voorraad weer op een band.
function uitMagazijnen(s: SpelStaat): void {
  const i = industrie(s);
  const v = s.voorraad;
  for (const p of magazijnen(i)) {
    if (!klaar(p) || !p.uit) continue;
    const blok = blokVan(p);
    for (const [x, y] of randVan(blok)) {
      if ((v[p.uit] ?? 0) < 1) break;
      const t = loopt(i, blok, x, y);
      if (!t || t.goed) continue;
      const [dx, dy] = RICHTINGEN[t.naar];
      if (inOpslag(s, t.x + dx, t.y + dy)) continue; // die loopt de opslag weer in
      t.goed = p.uit;
      t.voortgang = 0;
      v[p.uit] = (v[p.uit] ?? 0) - 1;
    }
  }
}
// Leg één stuk uit de buffer op een band die tegen de voet begint: om de beurt, en alleen het product van die tegel.
function zetOpBand(i: IndustrieStaat, g: Gebouw): void {
  const blok = blokVan(g);
  const rand = randVan(blok), wat = uitgangen(g);
  for (let n = 0; n < rand.length; n++) {
    const k = (g.uitvoer + n) % rand.length;
    const t = loopt(i, blok, rand[k][0], rand[k][1]);
    if (!t || t.goed) continue;
    const j = wat[k] ? g.buffer.indexOf(wat[k]!) : 0;
    if (j < 0) continue;
    t.goed = g.buffer.splice(j, 1)[0];
    t.voortgang = 0;
    g.uitvoer = k + 1;
    return;
  }
}

// De stream: alles buiten de ring blijft achter, dus inpakken. De bouwkosten komen terug.
function opStream(s: SpelStaat): void {
  const i = industrie(s);
  const k = s.kaart;
  let n = 0;
  i.gebouwen = i.gebouwen.filter((g) => {
    const c = midden(blokVan(g));
    if (binnenRing(k, c.x, c.y)) return true;
    ruimOp(s, g);
    n++;
    return false;
  });
  for (const [sleutel, t] of i.banden) {
    if (binnenRing(k, t.x, t.y)) continue;
    ruimBand(s, t);
    i.banden.delete(sleutel);
    n++;
  }
  if (n) log(energie(s), `PACKED UP ${n} THINGS OUTSIDE THE RING. COSTS REFUNDED`, 'cyaan');
}

export function industrieTrucje(getallen: IndustrieGetallen): Trucje {
  G = getallen;
  return {
    naam: 'Industrie',
    opTik: (s, sec) => {
      tik++;
      stapIndustrie(s, sec);
    },
    opStream,
  };
}
