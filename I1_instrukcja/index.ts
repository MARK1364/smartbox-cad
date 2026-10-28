/**
 * I1_instrukcja - index.ts
 * Instrukcja montażu: samodzielny moduł (podstrona = kopia shella CAD bez modułów
 * kreślących), wywoływany z drzewa PPM → Produkcja → Instrukcja montażu.
 */

export * from './assembly-sequence-engine';
export * from './assembly-scene-adapter';
export * from './assembly-lektor';
export * from './assembly-anim';
export * from './instruction-playback';
export { InstructionPanel } from './InstructionPanel';
