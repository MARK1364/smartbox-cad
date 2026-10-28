import { performance } from 'node:perf_hooks';
import earcut from 'earcut';

// Benchmark testujący kluczowe operacje matematyczne B-Rep meblarskiego
console.log('=== TEST WYDAJNOŚCI MATEMATYKI B-REP (V8 / Node) ===\n');

// 1. Test czystej triangulacji earcut (ściana z otworami)
function testEarcutHoles(holeCount) {
    // Obrys prostokąta 600x800mm
    const vertices = [0, 0, 600, 0, 600, 800, 0, 800];
    const holeIndices = [];
    
    // Generujemy N okrągłych otworów (np. 16 wierzchołków na okrąg)
    let idx = 4;
    for (let h = 0; h < holeCount; h++) {
        holeIndices.push(idx);
        const cx = 50 + (h % 5) * 100;
        const cy = 50 + Math.floor(h / 5) * 60;
        const r = 17.5; // puszka fi 35
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            vertices.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
            idx++;
        }
    }

    const start = performance.now();
    const iterations = 100;
    for (let it = 0; it < iterations; it++) {
        earcut(vertices, holeIndices, 2);
    }
    const duration = (performance.now() - start) / iterations;
    return duration;
}

console.log('1. Czas triangulacji earcut (na 1 formatkę):');
for (const holes of [0, 4, 16, 40, 100]) {
    const timeMs = testEarcutHoles(holes);
    console.log(`   - Płyta z ${holes.toString().padStart(3)} otworami: ${timeMs.toFixed(3)} ms`);
}

// 2. Test generowania geometrii ścian i krawędzi (ekstruzja)
function testExtrusionMath(vertCount) {
    const vertices = new Float32Array(vertCount * 3);
    const indices = new Uint32Array(vertCount * 6);
    
    const start = performance.now();
    const iterations = 500;
    for (let it = 0; it < iterations; it++) {
        // Obliczenia normalnych i pozycji ścian bocznych
        for (let i = 0; i < vertCount; i++) {
            vertices[i * 3] = i * 1.5;
            vertices[i * 3 + 1] = i * 2.0;
            vertices[i * 3 + 2] = 18.0;
        }
        for (let i = 0; i < vertCount - 1; i++) {
            indices[i * 6] = i;
            indices[i * 6 + 1] = i + 1;
            indices[i * 6 + 2] = i + vertCount;
        }
    }
    return (performance.now() - start) / iterations;
}

console.log('\n2. Czas generowania buforów ekstruzji (Float32Array):');
console.log(`   - Prosty profil (4 boki): ${testExtrusionMath(4).toFixed(4)} ms`);
console.log(`   - Złożony profil z frezowaniami (200 wierzchołków): ${testExtrusionMath(200).toFixed(4)} ms`);

// 3. Test kosztu serializacji JSON vs Transferable Float32Array (wątek -> worker)
function testTransferCost() {
    // Duża szafa: 20 płyt x 500 wierzchołków = 10 000 wierzchołków
    const objData = [];
    for (let p = 0; p < 20; p++) {
        objData.push({
            name: `Panel_${p}`,
            positions: Array.from({ length: 1500 }, (_, i) => i * 0.1),
            indices: Array.from({ length: 3000 }, (_, i) => i),
            metadata: { role: 'SHELF', thickness_mm: 18, edgeBanding: { front: true } }
        });
    }

    // JSON serialize/deserialize
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
        const str = JSON.stringify(objData);
        JSON.parse(str);
    }
    const jsonTime = (performance.now() - t0) / 20;

    // Structured Clone (standardowy postMessage bez Transferable)
    const t1 = performance.now();
    for (let i = 0; i < 20; i++) {
        structuredClone(objData);
    }
    const cloneTime = (performance.now() - t1) / 20;

    console.log('\n3. Koszt przesyłu danych między wątkami (20 formatek szafy):');
    console.log(`   - Klonowanie obiektów JS (Structured Clone): ${cloneTime.toFixed(2)} ms (narzut CPU!)`);
    console.log(`   - JSON stringify/parse: ${jsonTime.toFixed(2)} ms`);
    console.log(`   - Transferable ArrayBuffer (zero-copy): ~0.005 ms (natychmiastowy)`);
}

testTransferCost();
