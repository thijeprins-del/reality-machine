// Geluid: alle niveaus op één plek. Te hard of te zacht? Pas hier een getal aan (0 = stil, 1 = vol).
// Alles wordt in code gesynthetiseerd met Web Audio; er zijn geen geluidsbestanden.
export const GELUID = {
  begin: 0.5, // beginvolume van de masterregelaar (de speler kan het zelf zetten, dat wordt onthouden)
  // Per soort geluid een eigen niveau, zodat je ze los kunt bijstellen:
  niveau: {
    knop: 0.35, // klik op een knop
    opdracht: 0.3, // je stuurt ratten ergens heen
    stream: 0.8, // de sprong naar de volgende dimensie
    landing: 0.7, // aankomst in de nieuwe wereld
    klaar: 0.5, // de machine is opgeladen en heel genoeg voor de stream
    alarm: 0.6, // een overval komt eraan
    treffer: 0.5, // een overvaller raakt de machine
    overvaller_weg: 0.4, // een overvaller is verslagen
    gewonnen: 0.8,
    verloren: 0.8,
    brom: 0.25, // de lage achtergrondbrom; wordt luider met Wrath
  },
  treffer_pauze: 0.35, // minimaal aantal seconden tussen twee treffergeluiden
};
