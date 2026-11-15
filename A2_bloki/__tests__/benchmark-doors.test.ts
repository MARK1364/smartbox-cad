import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_doors_plan_wasm } from '../../src/wasm/doors/wasm_doors.js';
import { calculateDoorsPlan, normalizeDoorsParams } from '../05_doors-engine.js';
import { getModuleRules } from '../../A1_core/rules-vault.js';

describe('Benchmark: TS vs WASM Doors Engine', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/doors/wasm_doors_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('runs benchmark comparing TypeScript vs Rust WASM over 10 000 iterations', () => {
    const dims = {
      width_mm: 600,
      height_mm: 720,
      depth_mm: 560
    };

    const rawParams = {
      rodzaj_drzwi: 'LEFT',
      grubosc_frontu_mm: 18,
      szczelina_mm: 4,
      nalozenie_gora_mm: 14,
      nalozenie_dol_mm: 15,
      nalozenie_lewe_mm: 16,
      nalozenie_prawe_mm: 16,
      domyslny_zawias_id: 'BLUM_71B3550',
      aktywne_zawiasy: [
        { index: 1, pozycja_lokalna_z_mm: 120 },
        { index: 6, pozycja_lokalna_z_mm: 600 }
      ]
    };

    const normalized = normalizeDoorsParams(rawParams as any, dims);

    // Warm-up JIT & WASM
    for (let i = 0; i < 500; i++) {
      calculateDoorsPlan(dims, normalized);
      calculate_doors_plan_wasm(dims, normalized);
    }

    const ITERATIONS = 10_000;

    // 1. Benchmark TypeScript
    const startTS = performance.now();
    let resTS: any = null;
    for (let i = 0; i < ITERATIONS; i++) {
      resTS = calculateDoorsPlan(dims, normalized);
    }
    const durationTS = performance.now() - startTS;

    // 2. Benchmark Rust WASM
    const startWASM = performance.now();
    let resWASM: any = null;
    for (let i = 0; i < ITERATIONS; i++) {
      resWASM = calculate_doors_plan_wasm(dims, normalized);
    }
    const durationWASM = performance.now() - startWASM;

    const avgTS = (durationTS / ITERATIONS) * 1000; // mikrosekundy
    const avgWASM = (durationWASM / ITERATIONS) * 1000; // mikrosekundy

    console.log(`\n================ BENCHMARK RESULTS (10 000 iteracji) ================`);
    console.log(`TypeScript Engine : ${durationTS.toFixed(2)} ms łącznie | śr. ${avgTS.toFixed(2)} µs na kalkulację`);
    console.log(`Rust WASM Engine  : ${durationWASM.toFixed(2)} ms łącznie | śr. ${avgWASM.toFixed(2)} µs na kalkulację`);
    console.log(`Wymiary panelu TS : X=${resTS.parts[0].dim.x} mm, Y=${resTS.parts[0].dim.y} mm, Z=${resTS.parts[0].dim.z} mm`);
    console.log(`Wymiary w WASM    : Width=${resWASM.parts[0].width} mm, Depth=${resWASM.parts[0].depth} mm, Height=${resWASM.parts[0].height} mm`);
    console.log(`Otwory pod puszkę : TS=${resTS.parts[0].features.length} otworów vs WASM=${resWASM.features.length} otworów`);
    console.log(`=====================================================================\n`);

    // Sprawdzenie matematycznej zgodności wyników
    expect(resWASM.parts.length).toBe(resTS.parts.length);
    expect(resWASM.parts[0].width).toBe(resTS.parts[0].dim.x); // 632 mm
    expect(resWASM.parts[0].height).toBe(resTS.parts[0].dim.z); // 749 mm
    expect(resWASM.parts[0].depth).toBe(resTS.parts[0].dim.y); // 18 mm
    expect(resWASM.features.length).toBe(resTS.parts[0].features.length); // 6 otworów (2 puszki + 4 wkręty)
    expect(resWASM.hardware.length).toBe(resTS.hardware.length); // 2 okucia zawiasów
  });
});
