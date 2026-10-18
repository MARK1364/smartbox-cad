/**
 * skosne-doors-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu DRZWI SKOŚNE (prowadniki zawiasu → BOK_L / BOK_P).
 *
 * Po migracji MACHINING: kształt NIE jest już własny modułu — to alias kontraktu
 * z machining-intent.ts (tag własności w params: isDoorDrilling).
 *
 * UWAGA serializacyjna: nazwy pól params to klucze serializacji —
 * nie zmieniać. Stare pliki JSON otwierają się 1:1.
 */
import { MachiningHoleFeature, MachiningIntent } from './01_machining-intent.js';

export type SkosneDoorsDrillingFeature = MachiningHoleFeature;

export type SkosneDoorsDrillingIntent = MachiningIntent<SkosneDoorsDrillingFeature>;

export type SkosneDoorsDrillingFace = MachiningHoleFeature['face'];