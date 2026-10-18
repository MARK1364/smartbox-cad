/**
 * shelves-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu PÓŁKI (otwory → BOK_L / BOK_P / PLECY).
 *
 * Po migracji MACHINING: kształt NIE jest już własny modułu — to alias kontraktu
 * z machining-intent.ts (tag własności w params: isShelfDrilling).
 *
 * UWAGA serializacyjna: nazwy pól params to klucze serializacji —
 * nie zmieniać. Stare pliki JSON otwierają się 1:1.
 */
import { MachiningHoleFeature, MachiningIntent } from './01_machining-intent.js';

export type ShelvesDrillingFeature = MachiningHoleFeature;

export type ShelvesDrillingIntent = MachiningIntent<ShelvesDrillingFeature>;

export type ShelvesDrillingFace = MachiningHoleFeature['face'];

