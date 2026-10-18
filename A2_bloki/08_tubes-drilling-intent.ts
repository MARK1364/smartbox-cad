/**
 * tubes-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu DRĄŻEK (uchwyty rozety fi25 oraz podpórki półki nad drążkiem → BOK_L / BOK_P).
 *
 * Po migracji MACHINING: kształt NIE jest już własny modułu — to alias kontraktu
 * z machining-intent.ts (tag własności w params: isTubeDrilling).
 *
 * UWAGA serializacyjna: nazwy pól params to klucze serializacji —
 * nie zmieniać. Stare pliki JSON otwierają się 1:1.
 */
import { MachiningHoleFeature, MachiningIntent } from './01_machining-intent.js';

export type TubesDrillingFeature = MachiningHoleFeature;

export type TubesDrillingIntent = MachiningIntent<TubesDrillingFeature>;

export type TubesDrillingFace = MachiningHoleFeature['face'];

