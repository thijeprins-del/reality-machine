// Ingang voor de wereldgalerij: bundelt de generator en de klimaatgegevens voor één los HTML-bestand.
import { genereerRun, genereerDimensie } from '../../../src/land/genereer';
import { ARCHETYPES } from '../../../src/land/archetypes';
import { DIMENSIES } from '../../../src/data/dimensies';
(globalThis as unknown as Record<string, unknown>).LAND = { genereerRun, genereerDimensie, ARCHETYPES, DIMENSIES };
