// Welke versie draait er: '' = RELEASE, 'dev' = DEV. Ingesteld met GAME_ENV bij het bouwen.
export const OMGEVING = __GAME_ENV__;

// Versie uit het bestand VERSIE (bv. v100t), zichtbaar op het startscherm en tijdens het spel.
export const VERSIE = __VERSIE__;

export function versieTekst(): string {
  const commit = __COMMIT__ ? ` (${__COMMIT__})` : '';
  const env = OMGEVING ? ` ${OMGEVING}` : '';
  return `${VERSIE}${env} · build ${__BUILD__}${commit}`;
}

// DEV en RELEASE delen één browseropslag (zelfde domein); DEV krijgt daarom een voorvoegsel.
export function opslagSleutel(naam: string): string {
  return OMGEVING ? `${OMGEVING}:${naam}` : naam;
}
