/**
 * drawers-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu SZUFLADY (corpus_holes → BOK_L / BOK_P).
 *
 * Po migracji MACHINING: kształt NIE jest już własny modułu — to alias kontraktu
 * z machining-intent.ts (tag własności w params: isDrawerDrilling).
 *
 * UWAGA serializacyjna: nazwy pól params to klucze serializacji —
 * nie zmieniać. Stare pliki JSON otwierają się 1:1.
 */
import { MachiningHoleFeature, MachiningIntent } from './01_machining-intent.js';

export type DrawersDrillingFeature = MachiningHoleFeature;

export type DrawersDrillingIntent = MachiningIntent<DrawersDrillingFeature>;

export type DrawersDrillingFace = MachiningHoleFeature['face'];

