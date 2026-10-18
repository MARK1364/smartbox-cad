/**
 * flaps-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu KLAPY (prowadniki zawiasów → wieniec górny/dolny / półka).
 *
 * Po migracji MACHINING: kształt NIE jest już własny modułu — to alias kontraktu
 * z machining-intent.ts (tag własności w params: isFlapDrilling).
 *
 * UWAGA serializacyjna: nazwy pól params (template_id / u / v / *_mm / diameter /
 * depth / isFlapDrilling / sourceContainerId / sourcePartId) to klucze serializacji —
 * nie zmieniać. Stare pliki JSON otwierają się 1:1.
 */
import { MachiningHoleFeature, MachiningIntent } from './01_machining-intent.js';

export type FlapsDrillingFeature = MachiningHoleFeature;

export type FlapsDrillingIntent = MachiningIntent<FlapsDrillingFeature>;

export type FlapsDrillingFace = MachiningHoleFeature['face'];
