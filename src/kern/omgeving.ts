// Welke versie draait er: '' = RELEASE, 'dev' = DEV. Ingesteld met GAME_ENV bij het bouwen.
export const OMGEVING = __GAME_ENV__;

export function versieTekst(): string {
  const commit = __COMMIT__ ? ` (${__COMMIT__})` : '';
  const env = OMGEVING ? `-${OMGEVING}` : '';
  return `build ${__BUILD__}${env}${commit}`;
}

// DEV en RELEASE delen één browseropslag (zelfde domein); DEV krijgt daarom een voorvoegsel.
export function opslagSleutel(naam: string): string {
  return OMGEVING ? `${OMGEVING}:${naam}` : naam;
}
