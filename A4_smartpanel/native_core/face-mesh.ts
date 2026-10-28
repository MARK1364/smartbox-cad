/**
 * Prymitywy siatki lica (B-rep face mesh) — wspólne dla czapek, otworów i cech obszarowych.
 * Wydzielone z cap-machining.ts (Punkt C) bez zmian matematyki.
 */
export type FaceMeshData = { positions: number[]; indices: number[] };

export function emptyMesh(): FaceMeshData {
    return { positions: [], indices: [] };
}

export function appendQuad(mesh: FaceMeshData, pA: number[], pB: number[], pC: number[], pD: number[]) {
    const idx = mesh.positions.length / 3;
    mesh.positions.push(...pA, ...pB, ...pC, ...pD);
    mesh.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
}

export function appendTriangle(mesh: FaceMeshData, pA: number[], pB: number[], pC: number[]) {
    const idx = mesh.positions.length / 3;
    mesh.positions.push(...pA, ...pB, ...pC);
    mesh.indices.push(idx, idx + 1, idx + 2);
}
