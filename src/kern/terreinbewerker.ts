// Terreinbewerker (F2): een klein testgereedschap om terrein met de hand te maken en te zien hoe het eruitziet.
// Geen onderdeel van het spel. Zolang het paneel open staat, staat de klok van de dimensie stil, anders springt je proefkaart weg.
// Twee vormen: BLOK tilt hele tegels los van hun buren (er komt een wand), HEUVEL neemt de buren mee (er komt een helling).
import { HOOGTE_MAX, HOOGTE_MIN } from '../data/dimensies';
import type { Graphics } from 'pixi.js';
import { naarScherm } from './iso';
import { herberekenTerrein, opSchijf, type Kaart } from './kaart';
import type { SpelStaat } from './spel';
import { hoeken, hoogteOp, verzetHoeken } from './terrein';

type Gereedschap = 'omhoog' | 'omlaag' | 'vlak';
type Vorm = 'blok' | 'heuvel';
const FORMAAT = 'tegelhoeken'; // per tegel vier hoeken: achter, rechts, voor, links

export class TerreinBewerker {
  private paneel = document.createElement('div');
  private gereedschap: Gereedschap = 'omhoog';
  private vorm: Vorm = 'blok';
  private kwast = 1;
  private open = false;
  private streek = new Set<number>(); // tegels (blok) of roosterhoeken (heuvel) die deze streek al geraakt heeft: slepen telt maar één keer
  private vlakHoogte = 0; // de hoogte waarop deze streek vlak maakt: die van de eerste tegel
  private knoppen = new Map<string, HTMLButtonElement>();

  constructor(
    private staat: () => SpelStaat,
    private gewijzigd: () => void,
    private voorbeeld: Graphics,
  ) {
    this.paneel.id = 'terreinpaneel';
    this.paneel.style.display = 'none';
    this.paneel.innerHTML = '<b>TERREIN</b>';
    const rij = (titel: string, knoppen: [string, string, () => void][]) => {
      const r = document.createElement('div');
      r.className = 'rij';
      if (titel) r.append(titel);
      for (const [sleutel, tekst, doe] of knoppen) {
        const k = document.createElement('button');
        k.textContent = tekst;
        k.onclick = () => {
          doe();
          k.blur(); // anders drukt de spatiebalk hem nog eens in
          this.toonKeuze();
        };
        this.knoppen.set(sleutel, k);
        r.append(k);
      }
      this.paneel.append(r);
    };
    rij('', [
      ['omhoog', 'OMHOOG', () => (this.gereedschap = 'omhoog')],
      ['omlaag', 'OMLAAG', () => (this.gereedschap = 'omlaag')],
      ['vlak', 'VLAK', () => (this.gereedschap = 'vlak')],
    ]);
    rij('VORM ', [
      ['blok', 'BLOK', () => (this.vorm = 'blok')],
      ['heuvel', 'HEUVEL', () => (this.vorm = 'heuvel')],
    ]);
    rij('KWAST ', [1, 2, 3].map((n) => [`kwast${n}`, String(n), () => (this.kwast = n)] as [string, string, () => void]));
    rij('', [['leeg', 'MAAK LEEG', () => this.maakLeeg()], ['bewaar', 'EXPORTEER', () => this.exporteer()]]);
    const uitleg = document.createElement('p');
    uitleg.textContent = 'links = kwast (slepen mag) · blok = wand eromheen, heuvel = helling eromheen · shift+slepen = muizen kiezen · rechts = muizen sturen · F1 = hoogtes';
    this.paneel.append(uitleg);
    document.body.append(this.paneel);
    this.toonKeuze();
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'F2') return;
      e.preventDefault();
      this.open = !this.open;
      this.paneel.style.display = this.open ? 'block' : 'none';
      this.staat().klokStil = this.open;
      if (!this.open) this.voorbeeld.clear();
    });
  }

  private toonKeuze(): void {
    for (const [sleutel, k] of this.knoppen) k.classList.toggle('aan', sleutel === this.gereedschap || sleutel === this.vorm || sleutel === `kwast${this.kwast}`);
  }

  // Alles vlak op hoogte 0 en geen grondstoffen meer: een schone lei om vormen op te proberen.
  private maakLeeg(): void {
    const k = this.staat().kaart;
    k.hoogte.fill(0);
    for (const a of k.afzettingen) a.rest = 0;
    herberekenTerrein(k);
    this.gewijzigd();
  }

  // Het terrein als JSON, om een vreemde situatie precies door te geven. Eén regel per rij tegels; elke tegel is
  // [achter, rechts, voor, links].
  alsJson(): string {
    const s = this.staat(), k = s.kaart;
    const rijen = Array.from({ length: k.diep }, (_, y) =>
      '    [' + Array.from({ length: k.breed }, (_, x) => `[${Array.from(k.hoogte.subarray((y * k.breed + x) * 4, (y * k.breed + x) * 4 + 4)).join(',')}]`).join(',') + ']');
    const velden = k.afzettingen.filter((a) => a.rest > 0).map((a) => ({ goed: a.goed, x: a.x, y: a.y }));
    return `{
  "formaat": "${FORMAAT}",
  "seed": ${s.seed},
  "dimensie": ${s.dimensie},
  "breed": ${k.breed},
  "diep": ${k.diep},
  "afzettingen": ${JSON.stringify(velden)},
  "hoogte": [
${rijen.join(',\n')}
  ]
}
`;
  }

  // Terug inladen: de hoogtes en welke grondstoffen er liggen. De kaart moet even groot zijn (kies die maat met ?kaart=256x64).
  laadJson(json: string): void {
    const d = JSON.parse(json), k = this.staat().kaart;
    if (d.formaat !== FORMAAT) throw new Error('dit bestand is van voor de wanden op tegelranden (één hoogte per roosterhoek) en past niet meer');
    if (d.breed !== k.breed || d.diep !== k.diep) throw new Error(`deze kaart is ${d.breed}x${d.diep}, de wereld nu ${k.breed}x${k.diep}: gebruik ?kaart=${d.breed}x${d.diep}`);
    (d.hoogte as number[][][]).forEach((rij, y) => rij.forEach((tegel, x) => k.hoogte.set(tegel, (y * k.breed + x) * 4)));
    const velden = new Set((d.afzettingen as { x: number; y: number }[]).map((a) => a.y * k.breed + a.x));
    for (const a of k.afzettingen) if (!velden.has(a.y * k.breed + a.x)) a.rest = 0;
    herberekenTerrein(k);
    this.gewijzigd();
  }

  private exporteer(): void {
    const s = this.staat();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([this.alsJson()], { type: 'application/json' }));
    link.download = `terrein-seed${s.seed}-dimensie${s.dimensie}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  get actief(): boolean {
    return this.open && this.staat().onderweg <= 0;
  }

  // De tegels onder de kwast. Kwast 1 is één tegel, 2 is 2x2, 3 is 3x3 met de muis in het midden.
  private tegelsOnder(k: Kaart, kol: number, rij: number): [number, number][] {
    const x0 = kol - Math.floor((this.kwast - 1) / 2), y0 = rij - Math.floor((this.kwast - 1) / 2);
    const uit: [number, number][] = [];
    for (let y = y0; y < y0 + this.kwast; y++)
      for (let x = x0; x < x0 + this.kwast; x++) if (x >= 0 && y >= 0 && x < k.breed && y < k.diep) uit.push([x, y]);
    return uit;
  }

  neer(kol: number, rij: number): void {
    this.streek.clear();
    this.vlakHoogte = Math.round(hoogteOp(this.staat().kaart, kol, rij));
    this.verf(kol, rij);
  }

  sleep(kol: number, rij: number): void {
    this.verf(kol, rij);
    this.zweef(kol, rij);
  }

  private verf(kol: number, rij: number): void {
    const k = this.staat().kaart, b = k.breed;
    // je schijf blijft vast: dat land reist mee
    const vast = (tegel: number) => opSchijf(k, tegel % b, Math.floor(tegel / b));
    const nieuw = (z: number) => Math.max(HOOGTE_MIN, Math.min(HOOGTE_MAX, this.gereedschap === 'vlak' ? this.vlakHoogte : z + (this.gereedschap === 'omhoog' ? 1 : -1)));
    const doelen = new Map<number, number>();
    if (this.vorm === 'blok') {
      // hele tegels, los van hun buren
      for (const [x, y] of this.tegelsOnder(k, kol, rij)) {
        const tegel = y * b + x;
        if (this.streek.has(tegel) || vast(tegel)) continue;
        this.streek.add(tegel);
        for (let hoek = 0; hoek < 4; hoek++) doelen.set(tegel * 4 + hoek, nieuw(k.hoogte[tegel * 4 + hoek]));
      }
    } else {
      // de roosterhoeken van die tegels, in alle tegels die eraan liggen
      const punten = new Set<number>();
      for (const [x, y] of this.tegelsOnder(k, kol, rij)) for (const [i, j] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) punten.add(j * (b + 1) + i);
      for (const punt of punten) {
        if (this.streek.has(punt)) continue;
        this.streek.add(punt);
        const i = punt % (b + 1), j = Math.floor(punt / (b + 1));
        for (const [x, y, hoek] of [[i, j, 0], [i - 1, j, 1], [i - 1, j - 1, 2], [i, j - 1, 3]]) {
          if (x < 0 || y < 0 || x >= b || y >= k.diep) continue;
          doelen.set((y * b + x) * 4 + hoek, nieuw(k.hoogte[(y * b + x) * 4 + hoek]));
        }
      }
    }
    if (doelen.size && verzetHoeken(k, doelen, this.vorm === 'heuvel', vast)) {
      herberekenTerrein(k);
      this.gewijzigd();
    }
  }

  // Waar de kwast nu terechtkomt: de omtrek van elke tegel eronder, op zijn eigen hoogte. null = de muis staat niet op de kaart.
  zweef(kol: number | null, rij: number | null): void {
    const g = this.voorbeeld;
    g.clear();
    if (!this.actief || kol === null || rij === null) return;
    const k = this.staat().kaart;
    for (const [x, y] of this.tegelsOnder(k, kol, rij)) {
      const c = hoeken(k, x, y);
      const punten = [[x - 0.5, y - 0.5, c.a], [x + 0.5, y - 0.5, c.r], [x + 0.5, y + 0.5, c.v], [x - 0.5, y + 0.5, c.l]].flatMap(([i, j, z]) => {
        const p = naarScherm(i, j, z);
        return [p.x, p.y];
      });
      g.poly(punten, true);
    }
    g.stroke({ width: 2, color: 0x9dff2e, alpha: 0.9 });
  }
}
