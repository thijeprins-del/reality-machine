// Leesbare letters voor het paneel en het bouwmenu. De vlakken zijn pixelart op een kleine maat en worden opgeschaald;
// tekst opschalen wordt blokkerig en onleesbaar (Thije, 5 nov). Daarom: tekst eerst in een rij zetten in paneelmaat
// (4 eenheden per teken, 5 hoog), en na het opschalen scherp tekenen met een echt lettertype op schermresolutie.
export const LETTER = 'ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

export interface Regel { s: string; x: number; y: number; k: string; sz: number; w?: number; gloed?: boolean } // w = hooguit zo breed

export function tekenRegels(c: CanvasRenderingContext2D, regels: Regel[], schaalX: number, schaalY: number): void {
  c.save();
  c.setTransform(schaalX, 0, 0, schaalY, 0, 0);
  c.textBaseline = 'alphabetic';
  c.globalCompositeOperation = 'source-over';
  for (const r of regels) {
    const px = 6.9 * r.sz;
    c.font = `600 ${px}px ${LETTER}`;
    c.fillStyle = r.k;
    // neon: de letters gloeien echt (een zachte waas in hun eigen kleur)
    c.shadowColor = r.gloed ? r.k : 'transparent';
    c.shadowBlur = r.gloed ? 3 * schaalX : 0;
    // monospace is ±0,6 em breed; precies 4 eenheden per teken zodat het in de vakjes past
    const breed = c.measureText(r.s).width;
    const doel = r.w ?? r.s.length * 4 * r.sz;
    if (breed > doel && breed > 0) {
      c.save();
      c.translate(r.x, 0);
      c.scale(doel / breed, 1);
      c.fillText(r.s, 0, r.y + 5 * r.sz);
      c.restore();
    } else c.fillText(r.s, r.x, r.y + 5 * r.sz);
  }
  c.restore();
}
