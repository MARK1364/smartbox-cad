/**
 * SmartPanel Web — Arc2D Geometria Analityczna Łuków i Zaokrągleń (Fillet)
 * 
 * SSOT dla obliczeń łuków kołowych, wyznaczania zaokrągleń narożników (fillet)
 * oraz dyskretyzacji łuków z kontrolowaną dokładnością strzałki ugięcia (sagitta).
 */

export interface Arc2D {
    start: [number, number];
    end: [number, number];
    center: [number, number];
    radius: number;
    direction: 'CW' | 'CCW';
    startAngle: number;
    endAngle: number;
    angularSpan: number;
}

export interface CornerFilletResult {
    tangentIn: [number, number];
    tangentOut: [number, number];
    arc: Arc2D;
}

/**
 * Oblicza zaokrąglenie narożnika (fillet) o zadanym promieniu R między trzema punktami:
 * P_prev -> P_curr (narożnik) -> P_next.
 * Zwraca punkty styczności na obu ramionach oraz analityczny łuk kołowy.
 * Jeśli promień jest zbyt duży w stosunku do długości ramion, promień jest bezpiecznie ograniczany.
 */
export function computeCornerFillet(
    pPrev: [number, number],
    pCurr: [number, number],
    pNext: [number, number],
    radius: number
): CornerFilletResult | null {
    if (radius <= 1e-4) return null;

    const v1x = pPrev[0] - pCurr[0];
    const v1y = pPrev[1] - pCurr[1];
    const len1 = Math.hypot(v1x, v1y);

    const v2x = pNext[0] - pCurr[0];
    const v2y = pNext[1] - pCurr[1];
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 1e-4 || len2 < 1e-4) return null;

    const u1x = v1x / len1;
    const u1y = v1y / len1;

    const u2x = v2x / len2;
    const u2y = v2y / len2;

    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
    const cross = u1x * u2y - u1y * u2x;

    // Współliniowe lub zawrót (brak zdefiniowanego narożnika)
    if (Math.abs(cross) < 1e-5 || Math.abs(dot) > 0.9999) return null;

    const theta = Math.acos(dot); // kąt wewnętrzny między ramionami (0..PI)
    const halfAngle = theta / 2;
    const tanHalf = Math.tan(halfAngle);
    if (tanHalf < 1e-5) return null;

    // Odległość punktu styczności od wierzchołka narożnika
    let d = radius / tanHalf;
    let actualRadius = radius;

    // Bezpieczne ograniczenie odległości do długości ramion
    const maxD = Math.min(len1, len2) * 0.999;
    if (d > maxD) {
        d = maxD;
        actualRadius = d * tanHalf;
    }

    const tIn: [number, number] = [
        pCurr[0] + u1x * d,
        pCurr[1] + u1y * d
    ];

    const tOut: [number, number] = [
        pCurr[0] + u2x * d,
        pCurr[1] + u2y * d
    ];

    // Wektor dwusiecznej kąta skierowany od narożnika do wnętrza
    const bx = u1x + u2x;
    const by = u1y + u2y;
    const bLen = Math.hypot(bx, by);
    if (bLen < 1e-5) return null;

    const ubx = bx / bLen;
    const uby = by / bLen;

    // Odległość środka koła od wierzchołka narożnika
    const h = actualRadius / Math.sin(halfAngle);
    const center: [number, number] = [
        pCurr[0] + ubx * h,
        pCurr[1] + uby * h
    ];

    // Wyznaczenie kątów startu i końca
    const startAngle = Math.atan2(tIn[1] - center[1], tIn[0] - center[0]);
    const endAngle = Math.atan2(tOut[1] - center[1], tOut[0] - center[0]);

    // Kierunek łuku idąc od tIn do tOut:
    // Wektor wejściowy z P_prev do P_curr: (-u1x, -u1y). Wektor wyjściowy: (u2x, u2y).
    // Wektor napływu to -u1, wektor wypływu to u2. (-u1) x u2 = -cross.
    // Jeśli turn = -cross > 0 (czyli cross < 0), kontur skręca w lewo (CCW).
    // Jeśli turn = -cross < 0 (czyli cross > 0), kontur skręca w prawo (CW).
    const direction: 'CW' | 'CCW' = cross > 0 ? 'CW' : 'CCW';

    let angularSpan = 0;
    if (direction === 'CCW') {
        angularSpan = endAngle - startAngle;
        if (angularSpan < 0) angularSpan += 2 * Math.PI;
    } else {
        angularSpan = startAngle - endAngle;
        if (angularSpan < 0) angularSpan += 2 * Math.PI;
    }

    return {
        tangentIn: tIn,
        tangentOut: tOut,
        arc: {
            start: tIn,
            end: tOut,
            center,
            radius: actualRadius,
            direction,
            startAngle,
            endAngle,
            angularSpan
        }
    };
}

/**
 * Dyskretyzuje łuk analityczny do punktów 2D z kontrolowaną dokładnością strzałki ugięcia (sagitta).
 * @param arc Obiekt łuku analitycznego
 * @param maxSagittaMaksymalna dopuszczalna strzałka ugięcia w mm (domyślnie 0.05 mm dla jakości CAD/CAM)
 * @returns Tablica punktów pośrednich włącznie z punktem początkowym i końcowym.
 */
export function discretizeArc2D(arc: Arc2D, maxSagitta = 0.05): Array<[number, number]> {
    const { center, radius, direction, startAngle, angularSpan } = arc;
    if (radius <= 1e-4 || angularSpan <= 1e-4) {
        return [arc.start, arc.end];
    }

    // Strzałka ugięcia: s = R * (1 - cos(delta / 2))
    // delta = 2 * acos(1 - s / R)
    const ratio = Math.max(-1, Math.min(1, 1 - Math.min(maxSagitta, radius * 0.5) / radius));
    const maxDeltaAngle = Math.max(0.02, 2 * Math.acos(ratio));
    const steps = Math.max(4, Math.ceil(angularSpan / maxDeltaAngle));

    const result: Array<[number, number]> = [];
    const stepSign = direction === 'CCW' ? 1 : -1;
    const dTheta = angularSpan / steps;

    for (let i = 0; i <= steps; i++) {
        if (i === 0) {
            result.push([arc.start[0], arc.start[1]]);
            continue;
        }
        if (i === steps) {
            result.push([arc.end[0], arc.end[1]]);
            continue;
        }

        const theta = startAngle + stepSign * i * dTheta;
        const x = center[0] + radius * Math.cos(theta);
        const y = center[1] + radius * Math.sin(theta);
        result.push([x, y]);
    }

    return result;
}

export type Contour2DSegment =
    | { type: 'LINE'; start: [number, number]; end: [number, number] }
    | { type: 'ARC'; arc: Arc2D };

export interface PolygonVertexWithFillet {
    u: number;
    v: number;
    fillet_mm?: number;
}

/**
 * Przekształca zamknięty poligon w ciąg analitycznych segmentów (LINE i ARC)
 * z uwzględnieniem zaokrągleń narożników.
 */
export function buildPolygonSegmentsWithFillets(
    vertices: Array<[number, number] | PolygonVertexWithFillet>,
    defaultFilletMm = 0
): Contour2DSegment[] {
    const n = vertices.length;
    if (n < 3) return [];

    const pts: Array<{ u: number; v: number; fillet: number }> = vertices.map(v => {
        if (Array.isArray(v)) {
            return { u: v[0], v: v[1], fillet: defaultFilletMm };
        }
        return { u: v.u, v: v.v, fillet: v.fillet_mm ?? defaultFilletMm };
    });

    const fillets: Array<CornerFilletResult | null> = [];

    for (let i = 0; i < n; i++) {
        const pPrev = pts[(i - 1 + n) % n];
        const pCurr = pts[i];
        const pNext = pts[(i + 1) % n];

        if (pCurr.fillet > 0.05) {
            const f = computeCornerFillet(
                [pPrev.u, pPrev.v],
                [pCurr.u, pCurr.v],
                [pNext.u, pNext.v],
                pCurr.fillet
            );
            fillets.push(f);
        } else {
            fillets.push(null);
        }
    }

    const segments: Contour2DSegment[] = [];

    for (let i = 0; i < n; i++) {
        const currFillet = fillets[i];
        const nextIdx = (i + 1) % n;
        const nextFillet = fillets[nextIdx];

        // Początek odcinka prostego: wyjście z obecnego narożnika
        const lineStart: [number, number] = currFillet
            ? currFillet.tangentOut
            : [pts[i].u, pts[i].v];

        // Koniec odcinka prostego: wejście do następnego narożnika
        const lineEnd: [number, number] = nextFillet
            ? nextFillet.tangentIn
            : [pts[nextIdx].u, pts[nextIdx].v];

        const lineLen = Math.hypot(lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1]);
        if (lineLen > 1e-4) {
            segments.push({
                type: 'LINE',
                start: lineStart,
                end: lineEnd
            });
        }

        // Jeśli następny narożnik ma zaokrąglenie, dodaj jego łuk
        if (nextFillet) {
            segments.push({
                type: 'ARC',
                arc: nextFillet.arc
            });
        }
    }

    return segments;
}

/**
 * Dyskretyzuje cały profil z segmentami łukowymi do jednolitego wielokąta 2D (dla earcut i triangulacji 3D).
 */
export function discretizePolygonWithFillets(
    vertices: Array<[number, number] | PolygonVertexWithFillet>,
    defaultFilletMm = 0,
    maxSagitta = 0.05
): Array<[number, number]> {
    const segments = buildPolygonSegmentsWithFillets(vertices, defaultFilletMm);
    if (segments.length === 0) return [];

    const result: Array<[number, number]> = [];

    for (const seg of segments) {
        if (seg.type === 'LINE') {
            result.push(seg.start);
        } else if (seg.type === 'ARC') {
            const arcPts = discretizeArc2D(seg.arc, maxSagitta);
            // Pomijamy ostatni punkt łuku, bo będzie początkiem następnego segmentu LINE
            for (let i = 0; i < arcPts.length - 1; i++) {
                result.push(arcPts[i]);
            }
        }
    }

    return result;
}
