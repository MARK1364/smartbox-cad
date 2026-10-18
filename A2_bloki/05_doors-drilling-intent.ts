/**
 * doors-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu DRZWI (prowadniki zawiasów → BOK_L / BOK_P).
 *
 * Po migracji MACHINING: kształt NIE jest już własny modułu — to alias kontraktu
 * z machining-intent.ts (tag własności w params: isDoorDrilling).
 *
 * UWAGA serializacyjna: nazwy pól params (template_id / u / v / *_mm / diameter /
 * depth / isDoorDrilling / sourceContainerId / sourcePartId) to klucze serializacji —
 * nie zmieniać. Stare pliki JSON otwierają się 1:1.
 */
import { MachiningHoleFeature, MachiningIntent } from './01_machining-intent.js';

export type DoorsDrillingFeature = MachiningHoleFeature;

export type DoorsDrillingIntent = MachiningIntent<DoorsDrillingFeature>;

export type DoorsDrillingFace = MachiningHoleFeature['face'];
