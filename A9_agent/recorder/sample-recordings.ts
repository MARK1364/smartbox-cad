/**
 * sample-recordings.ts
 * Wzorcowe, ultra-płynne nagranie sesji CAD (nagranie_szafki_nagranie.json).
 */

import { RecordedSession } from './recorder-types.js';
import sessionJson from '../../nagranie_szafki_nagranie.json';

export const SAMPLE_CABINET_SESSION: RecordedSession = sessionJson as RecordedSession;
