import { Mat4 } from '../A1_core/cad-math/mat4.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { GrooveIntent, GrooveFeatureLCS } from './groove-intent.js';

export interface PanelState {
    id: string;
    role: string;
    dim_nm: { x: number; y: number; z: number };
    localMatrix: Mat4; // Matrix from Panel LCS to Container Space
    zonePrefix?: string;
}

interface AABB {
    min: Vec3;
    max: Vec3;
}

const EPS = 50000; // 0.05 mm in nm

function getLocalAABB(dim_nm: {x: number, y: number, z: number}): AABB {
    return {
        min: new Vec3(-dim_nm.x / 2, -dim_nm.y / 2, -dim_nm.z / 2),
        max: new Vec3(dim_nm.x / 2, dim_nm.y / 2, dim_nm.z / 2)
    };
}

function getCorners(aabb: AABB): Vec3[] {
    return [
        new Vec3(aabb.min.x, aabb.min.y, aabb.min.z),
        new Vec3(aabb.max.x, aabb.min.y, aabb.min.z),
        new Vec3(aabb.min.x, aabb.max.y, aabb.min.z),
        new Vec3(aabb.max.x, aabb.max.y, aabb.min.z),
        new Vec3(aabb.min.x, aabb.min.y, aabb.max.z),
        new Vec3(aabb.max.x, aabb.min.y, aabb.max.z),
        new Vec3(aabb.min.x, aabb.max.y, aabb.max.z),
        new Vec3(aabb.max.x, aabb.max.y, aabb.max.z),
    ];
}

function computeAABB(points: Vec3[]): AABB {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (p.z > maxZ) maxZ = p.z;
    }
    
    return {
        min: new Vec3(minX, minY, minZ),
        max: new Vec3(maxX, maxY, maxZ)
    };
}

function intersectAABB(a: AABB, b: AABB): AABB | null {
    const minX = Math.max(a.min.x, b.min.x);
    const minY = Math.max(a.min.y, b.min.y);
    const minZ = Math.max(a.min.z, b.min.z);
    
    const maxX = Math.min(a.max.x, b.max.x);
    const maxY = Math.min(a.max.y, b.max.y);
    const maxZ = Math.min(a.max.z, b.max.z);
    
    if (maxX - minX < EPS || maxY - minY < EPS || maxZ - minZ < EPS) {
        return null; // Brak realnego przecięcia
    }
    
    return { min: new Vec3(minX, minY, minZ), max: new Vec3(maxX, maxY, maxZ) };
}

/**
 * Główny czysty builder intencji wpustów pod plecy.
 * Opiera się w 100% na matematyce macierzowej i LCS, ignorując całkowicie role formatek
 * przy liczeniu samej geometrii (role służą tu tylko do odnalezienia pleców).
 */
export function buildBackGrooves(panels: PanelState[]): GrooveIntent[] {
    const intents: GrooveIntent[] = [];
    const backPanels = panels.filter(p => p.role === 'BACK_PANEL');

    if (backPanels.length === 0) return intents;

    const allowedRoles = [
        'LEFT_SIDE_PANEL', 'RIGHT_SIDE_PANEL', 'SIDE_LEFT', 'SIDE_RIGHT',
        'TOP_PANEL', 'BOTTOM_PANEL', 'SHELF_PANEL', 'HORIZONTAL_DIVIDER', 'VERTICAL_DIVIDER', 'DIVIDER', 'SIDE_PANEL'
    ];

    for (const backPanel of backPanels) {
        const backPos = backPanel.localMatrix.decompose().translation;
        const backDim = backPanel.dim_nm; // { x: Width, y: Height, z: Thickness }
        const penetrationDepth_nm = 11_000_000; // 11mm

        for (const target of panels) {
            if (target.role === 'BACK_PANEL') continue;
            if (!allowedRoles.includes(target.role)) continue;

            const targetZone = target.zonePrefix || '';
            const backZone = backPanel.zonePrefix || '';
            if (targetZone !== '' && targetZone !== backZone) continue;

            const targetPos = target.localMatrix.decompose().translation;
            const isSideOrDivider = target.role.includes('SIDE') || target.role.includes('BOK') || target.role.includes('DIVIDER') && !target.role.includes('HORIZONTAL');

            let u_nm = 0;
            let v_nm = 0;
            let width_nm = 0;
            let length_nm = 0;
            let face: '+Z' | '-Z' = '+Z'; // Domyślnie rowek od wewnętrznej strony (Zależy od tego, który to bok, ale z reguły to '+Z' bo środek korpusu)

            if (isSideOrDivider) {
                // target.dim_nm = { x: Depth, y: Height, z: Thickness }
                width_nm = backDim.z;  // Szerokość wpustu = Grubość pleców (3mm)
                length_nm = backDim.y; // Długość wpustu = Wysokość pleców (np. 2200mm)
                
                // V: Pozycja startowa od dolnej krawędzi boczka (wzdłuż osi Y boczka)
                const targetBottom = targetPos.z - target.dim_nm.y / 2;
                const backBottom = backPos.z - backDim.y / 2;
                v_nm = backBottom - targetBottom;

                // U: Pozycja od krawędzi (zależnie czy to lewy czy prawy bok, u=0 jest z tyłu lub z przodu)
                const isLeft = target.role.includes('LEFT') || targetPos.x < backPos.x;
                
                if (isLeft) {
                    // Dla lewego boczka (+Z do wewnątrz), u=0 jest Z TYŁU szafki.
                    // Obliczamy odległość od tyłu boczka do tyłu pleców.
                    const targetBack = targetPos.y + target.dim_nm.x / 2;
                    const backBack = backPos.y + backDim.z / 2;
                    u_nm = targetBack - backBack;
                } else {
                    // Dla prawego boczka (+Z do wewnątrz), u=0 jest Z PRZODU szafki.
                    // Obliczamy odległość od przodu boczka do przodu pleców.
                    const targetFront = targetPos.y - target.dim_nm.x / 2;
                    const backFront = backPos.y - backDim.z / 2;
                    u_nm = backFront - targetFront;
                }

                // Oba boczki mają teraz Z skierowane do wewnątrz (będąc swoim lustrzanym odbiciem).
                // Dlatego zawsze frezujemy na wewnętrznej ścianie +Z.
                face = '+Z';
                
            } else {
                // Dla wieńców/półek:
                // target.dim_nm = { x: Width, y: Depth, z: Thickness }
                width_nm = backDim.x;  // Długość wpustu = Szerokość pleców (np. 1000mm)
                length_nm = backDim.z; // Szerokość wpustu = Grubość pleców (3mm)

                const isBottom = target.role.includes('BOTTOM') || targetPos.z < backPos.z;

                // U: Pozycja od lewej krawędzi wieńca (wzdłuż osi X wieńca)
                // Obie formatki mają oś X skierowaną tak samo (RotX zachowuje kierunek X), więc u=0 zawsze leży po LEWEJ
                const targetLeft = targetPos.x - target.dim_nm.x / 2;
                const backLeft = backPos.x - backDim.x / 2;
                u_nm = backLeft - targetLeft;

                // V: Pozycja wgłębna (od tyłu dla dolnego, od przodu dla górnego)
                if (isBottom) {
                    // Dla wieńca dolnego, v=0 znajduje się Z TYŁU szafki
                    const targetBack = targetPos.y + target.dim_nm.y / 2;
                    const backBack = backPos.y + backDim.z / 2;
                    v_nm = targetBack - backBack;
                } else {
                    // Dla wieńca górnego (obróconego o 180 st. wokół X), v=0 znajduje się Z PRZODU szafki
                    const targetFront = targetPos.y - target.dim_nm.y / 2;
                    const backFront = backPos.y - backDim.z / 2;
                    v_nm = backFront - targetFront;
                }
                
                // Oba wieńce (lustrzane odbicia wokół X) mają teraz Z skierowane do wewnątrz korpusu.
                // Dlatego zawsze frezujemy na wewnętrznej ścianie +Z.
                face = '+Z';
            }

            // Twarde zabezpieczenie matematyczne: Przecięcie 2D (Subtractive Domain Clipping)
            // Wycięcie ujemne na ścianie nie może wychodzić poza obszar [0, targetFaceWidth] x [0, targetFaceHeight]
            const targetFaceWidth = target.dim_nm.x;
            const targetFaceHeight = target.dim_nm.y;

            const uStart = Math.max(0, u_nm);
            const uEnd = Math.min(targetFaceWidth, u_nm + width_nm);
            const vStart = Math.max(0, v_nm);
            const vEnd = Math.min(targetFaceHeight, v_nm + length_nm);

            // Jeśli po obcięciu wpust nie trafia w formatkę (brak części wspólnej)
            if (uEnd - uStart <= 0 || vEnd - vStart <= 0) continue;

            u_nm = uStart;
            width_nm = uEnd - uStart;
            v_nm = vStart;
            length_nm = vEnd - vStart;

            intents.push({
                targetNodeId: target.id,
                feature: {
                    type: 'groove',
                    face,
                    params: {
                        u_nm,
                        v_nm,
                        width_nm,
                        length_nm,
                        depth_nm: penetrationDepth_nm
                    }
                }
            });
        }
    }

    return intents;
}
