// Geluid, gemaakt in code met Web Audio (geen bestanden, geen AI-audio). Niveaus staan in src/data/geluid.ts.
// `werkGeluid(staat)` kijkt elk beeld wat er veranderd is en speelt het bijbehorende geluid.
import { GELUID } from '../data/geluid';
import type { SpelStaat } from './spel';

type Naam = keyof typeof GELUID.niveau;
const OPSLAG = 'rm-geluid';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let brom: { gain: GainNode; filter: BiquadFilterNode } | null = null;
let volume = GELUID.begin;
let stil = false;

try {
  const o = JSON.parse(localStorage.getItem(OPSLAG) ?? 'null');
  if (o) { volume = typeof o.volume === 'number' ? o.volume : volume; stil = !!o.stil; }
} catch { /* opslag mag ontbreken */ }

const bewaar = () => { try { localStorage.setItem(OPSLAG, JSON.stringify({ volume, stil })); } catch { /* idem */ } };
const eind = () => (stil ? 0 : volume * volume); // kwadratisch: de regelaar voelt dan gelijkmatiger

export const geluidStaat = () => ({ volume, stil });
export function zetVolume(v: number): void { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = eind(); bewaar(); }
export function zetStil(s: boolean): void { stil = s; if (master) master.gain.value = eind(); bewaar(); }

// Browsers starten geluid pas na een klik of toets.
export function startGeluid(): void {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = eind();
  master.connect(ctx.destination);
  // lage brom: twee ongelijke zaagtanden door een laagdoorlaatfilter
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 160;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  for (const f of [43, 43.7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(filter);
    o.start();
  }
  filter.connect(gain).connect(master);
  brom = { gain, filter };
}

// ---- bouwstenen ----
function toon(naam: Naam, van: number, tot: number, duur: number, type: OscillatorType = 'square', start = 0, piek = 1): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(van, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, tot), t + duur);
  const top = GELUID.niveau[naam] * piek * 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(top, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + duur + 0.05);
}
function ruis(naam: Naam, duur: number, van: number, tot: number, start = 0, piek = 1): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; // alleen beeld/geluid: Math.random mag
  const b = ctx.createBufferSource();
  b.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(van, t);
  f.frequency.exponentialRampToValueAtTime(tot, t + duur);
  const g = ctx.createGain();
  const top = GELUID.niveau[naam] * piek * 0.5;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(top, t + duur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  b.connect(f).connect(g).connect(master);
  b.start(t);
}

// ---- de geluiden ----
export const speel: Record<Exclude<Naam, 'brom'>, () => void> = {
  knop: () => toon('knop', 880, 660, 0.06, 'square'),
  opdracht: () => { toon('opdracht', 520, 700, 0.07, 'triangle'); toon('opdracht', 700, 900, 0.07, 'triangle', 0.06); },
  stream: () => { toon('stream', 80, 900, 1.4, 'sawtooth'); ruis('stream', 1.6, 300, 4000); },
  landing: () => { toon('landing', 110, 38, 0.7, 'sine'); ruis('landing', 0.5, 800, 120); },
  klaar: () => { toon('klaar', 660, 660, 0.25, 'sine'); toon('klaar', 990, 990, 0.4, 'sine', 0.15); },
  alarm: () => { for (let i = 0; i < 3; i++) { toon('alarm', 520, 520, 0.16, 'square', i * 0.4); toon('alarm', 390, 390, 0.16, 'square', i * 0.4 + 0.2); } },
  treffer: () => { toon('treffer', 180, 60, 0.18, 'square'); ruis('treffer', 0.2, 2500, 400); },
  overvaller_weg: () => toon('overvaller_weg', 500, 120, 0.15, 'triangle'),
  gewonnen: () => [523, 659, 784, 1047].forEach((f, i) => toon('gewonnen', f, f, 0.5, 'triangle', i * 0.14)),
  verloren: () => [330, 262, 196, 131].forEach((f, i) => toon('verloren', f, f * 0.98, 0.6, 'sawtooth', i * 0.25)),
};

// ---- van spelstaat naar geluid ----
let vorig: { dim: number; onderweg: boolean; raiders: number; heel: number; klaar: boolean; uit: boolean } | null = null;
let laatsteTreffer = 0;

export function werkGeluid(s: SpelStaat, klaar: boolean): void {
  if (!ctx) return;
  const nu = {
    dim: s.dimensie,
    onderweg: s.onderweg > 0,
    raiders: s.land.raiders.length,
    heel: s.machine.heelheid,
    klaar,
    uit: !!s.uitkomst,
  };
  if (vorig) {
    const v = vorig;
    if (nu.dim !== v.dim) speel.stream();
    else if (v.onderweg && !nu.onderweg) speel.landing();
    if (nu.raiders > v.raiders && nu.dim === v.dim) { if (nu.raiders - v.raiders >= 1 && v.raiders === 0) speel.alarm(); }
    else if (nu.raiders < v.raiders && nu.dim === v.dim) speel.overvaller_weg();
    if (nu.heel < v.heel - 0.01 && !nu.onderweg && ctx.currentTime - laatsteTreffer > GELUID.treffer_pauze) { laatsteTreffer = ctx.currentTime; speel.treffer(); }
    if (nu.klaar && !v.klaar && !nu.onderweg) speel.klaar();
    if (nu.uit && !v.uit) (s.uitkomst!.gewonnen ? speel.gewonnen : speel.verloren)();
  }
  vorig = nu;
  // de brom wordt luider en dreigender met Wrath
  if (brom) {
    const w = Math.min(1, s.land.wrath / 100);
    const doel = nu.onderweg || nu.uit ? 0 : GELUID.niveau.brom * (0.4 + 0.6 * w);
    brom.gain.gain.setTargetAtTime(doel, ctx.currentTime, 0.3);
    brom.filter.frequency.setTargetAtTime(120 + 260 * w, ctx.currentTime, 0.3);
  }
}

// Knop rechtsboven: M zet het geluid aan of uit, de regelaar zet het volume. Beide worden onthouden.
export function maakGeluidKnop(): void {
  const wrap = document.createElement('div');
  wrap.id = 'geluid';
  wrap.style.cssText = 'position:fixed;top:8px;right:8px;z-index:6;display:flex;gap:6px;align-items:center;font:14px monospace;padding:4px 8px;background:#15171a;color:#c8ccd2;border:1px solid #3a3f46';
  const b = document.createElement('button');
  b.style.cssText = 'font:inherit;background:none;border:0;color:#9dff2e;cursor:pointer;padding:0';
  const r = document.createElement('input');
  r.type = 'range'; r.min = '0'; r.max = '100'; r.style.cssText = 'width:80px;accent-color:#9dff2e';
  const ververs = () => { b.textContent = stil || volume === 0 ? 'SOUND OFF' : 'SOUND'; b.style.color = stil ? '#ff9a1f' : '#9dff2e'; r.value = String(Math.round(volume * 100)); };
  b.title = 'Sound on/off (M)';
  b.onclick = () => { startGeluid(); zetStil(!stil); ververs(); if (!stil) speel.knop(); };
  r.oninput = () => { startGeluid(); zetVolume(Number(r.value) / 100); if (stil && volume > 0) zetStil(false); ververs(); };
  r.onchange = () => speel.knop();
  window.addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') { startGeluid(); zetStil(!stil); ververs(); } });
  ververs();
  wrap.append(b, r);
  document.body.append(wrap);
  // eerste klik of toets in het spel start het geluid; knoppen klikken
  window.addEventListener('pointerdown', (e) => {
    startGeluid();
    if ((e.target as HTMLElement | null)?.closest?.('button') && (e.target as HTMLElement).closest('#geluid') === null) speel.knop();
  }, true);
  window.addEventListener('keydown', startGeluid, { once: true });
}
