/**
 * Testy styku płaszczyzn — najważniejsza cecha C2/A6.
 *
 * Wieniec–bok (prostopadłe, bez szczeliny) → złącze.
 * Półka–bok ze szczeliną 0.5 mm → BRAK złącza.
 * Wieniec–wieniec (równoległe) → BRAK złącza.
 *
 * Uruchom: npx vitest run C2_connectors  (z katalogu web/)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../../A1_core/project-domain.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import {
    connectorPartsArePerpendicular,
    pickEligibleFace,
    rayAabb,
    scanEligibleConnectorFaces,
} from '../contact-scanner.js';
import { CONTACT_BACKOFF_MM, CONTACT_TOLERANCE_MM } from '../connectors-types.js';
import { buildGroupFromContact } from '../connector-picker.js';
import { ConnectorStore } from '../connector-store.js';

function placePanel(
    doc: ProjectDocument,
    opts: {
        name: string;
        role: string;
        width: number;
        height: number;
        thickness: number;
        x: number;
        y: number;
        z: number;
        rxDeg?: number;
        ryDeg?: number;
        rzDeg?: number;
    },
): CADNode {
    const panel = doc.createPanel({
        width: mmToNm(opts.width),
        height: mmToNm(opts.height),
        thickness: mmToNm(opts.thickness),
        name: opts.name,
        role: opts.role,
    });
    const node = doc.findNode(panel.id)!;
    node.setLocalTransform(
        new Vec3(mmToNm(opts.x), mmToNm(opts.y), mmToNm(opts.z)),
        Quat.fromEulerXYZ(
            ((opts.rxDeg || 0) * Math.PI) / 180,
            ((opts.ryDeg || 0) * Math.PI) / 180,
            ((opts.rzDeg || 0) * Math.PI) / 180,
        ),
    );
    return node;
}

function pairIds(faces: ReturnType<typeof scanEligibleConnectorFaces>) {
    return faces.map((f) => `${f.panelId}|${f.otherPanelId}|${f.faceName}`);
}

function touches(faces: ReturnType<typeof scanEligibleConnectorFaces>, a: CADNode, b: CADNode): boolean {
    return faces.some(
        (f) =>
            (f.panelId === a.id && f.otherPanelId === b.id) ||
            (f.panelId === b.id && f.otherPanelId === a.id),
    );
}

describe('rayAabb', () => {
    const boxMin = new Vec3(-10, -10, -10);
    const boxMax = new Vec3(10, 10, 10);

    it('trafia ścianę w zasięgu 1.05 mm (styk)', () => {
        const origin = new Vec3(-11, 0, 0);
        const dir = new Vec3(1, 0, 0);
        const hit = rayAabb(origin, dir, boxMin, boxMax, CONTACT_BACKOFF_MM + CONTACT_TOLERANCE_MM);
        expect(hit).not.toBeNull();
        expect(hit!.t).toBeCloseTo(1, 5);
        expect(hit!.normal.x).toBeCloseTo(-1, 5);
    });

    it('nie trafia przy szczelinie 0.5 mm', () => {
        const origin = new Vec3(-11.5, 0, 0);
        const dir = new Vec3(1, 0, 0);
        const hit = rayAabb(origin, dir, boxMin, boxMax, CONTACT_BACKOFF_MM + CONTACT_TOLERANCE_MM);
        expect(hit).toBeNull();
    });
});

describe('Korpus: bok + wieniec + półka ze szczeliną', () => {
    let doc: ProjectDocument;
    let left: CADNode;
    let right: CADNode;
    let top: CADNode;
    let shelf: CADNode;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'C2 contact' });
        left = placePanel(doc, {
            name: 'Bok L',
            role: 'LEFT_SIDE_PANEL',
            width: 500,
            height: 720,
            thickness: 18,
            x: -291,
            y: 0,
            z: 360,
            rzDeg: -90,
        });
        right = placePanel(doc, {
            name: 'Bok P',
            role: 'RIGHT_SIDE_PANEL',
            width: 500,
            height: 720,
            thickness: 18,
            x: 291,
            y: 0,
            z: 360,
            rzDeg: 90,
        });
        top = placePanel(doc, {
            name: 'Wieniec G',
            role: 'TOP_PANEL',
            width: 564,
            height: 500,
            thickness: 18,
            x: 0,
            y: 0,
            z: 711,
            rxDeg: -90,
        });
        shelf = placePanel(doc, {
            name: 'Półka',
            role: 'SHELF_PANEL',
            width: 563,
            height: 500,
            thickness: 18,
            x: 0,
            y: 0,
            z: 400,
            rxDeg: -90,
        });
    });

    it('bok i wieniec są prostopadłe, dwa boki równoległe', () => {
        expect(connectorPartsArePerpendicular(left, top)).toBe(true);
        expect(connectorPartsArePerpendicular(right, top)).toBe(true);
        expect(connectorPartsArePerpendicular(left, right)).toBe(false);
    });

    it('wykrywa styk wieniec–bok (obiektu muszą się stykać)', () => {
        const faces = scanEligibleConnectorFaces(doc);
        expect(touches(faces, left, top), pairIds(faces).join('\n')).toBe(true);
        expect(touches(faces, right, top), pairIds(faces).join('\n')).toBe(true);
    });

    it('nie daje połączenia półka–bok przy szczelinie 0.5 mm', () => {
        const faces = scanEligibleConnectorFaces(doc);
        expect(touches(faces, shelf, left), pairIds(faces).join('\n')).toBe(false);
        expect(touches(faces, shelf, right), pairIds(faces).join('\n')).toBe(false);
    });

    it('na styku wieniec–bok silnik stawia kołki/konfirmaty', () => {
        const faces = scanEligibleConnectorFaces(doc);
        const joint = faces.find((f) => f.panelId === left.id && f.otherPanelId === top.id)
            ?? faces.find((f) => f.panelId === top.id && f.otherPanelId === left.id);
        expect(joint).toBeTruthy();
        ConnectorStore.instance.clear();
        const group = buildGroupFromContact(doc, joint!, 'standard_od_lewej');
        expect(group).toBeTruthy();
        expect(group!.connectors.length).toBeGreaterThan(0);
        expect(group!.connectors[0].type).toBe('kolki_d8x35');
    });
});

describe('Wieniec na wieniec (płyty równoległe)', () => {
    it('odrzuca styk dwóch wieńców mimo kontaktu płaszczyzn', () => {
        const doc = new ProjectDocument({ name: 'parallel crowns' });
        const a = placePanel(doc, {
            name: 'Wieniec D',
            role: 'BOTTOM_PANEL',
            width: 564,
            height: 500,
            thickness: 18,
            x: 0,
            y: 0,
            z: 9,
            rxDeg: -90,
        });
        const b = placePanel(doc, {
            name: 'Wieniec G',
            role: 'TOP_PANEL',
            width: 564,
            height: 500,
            thickness: 18,
            x: 0,
            y: 0,
            z: 27,
            rxDeg: -90,
        });
        expect(connectorPartsArePerpendicular(a, b)).toBe(false);
        const faces = scanEligibleConnectorFaces(doc);
        expect(touches(faces, a, b), pairIds(faces).join('\n')).toBe(false);
    });
});

describe('pickEligibleFace — precyzyjne zaznaczanie płaszczyzn styku', () => {
    it('trafia płaszczyznę styku, gdy promień celuje wewnątrz wielokąta styku', () => {
        const doc = new ProjectDocument({ name: 'C2 pick test' });
        const left = placePanel(doc, {
            name: 'Bok L',
            role: 'LEFT_SIDE_PANEL',
            width: 500,
            height: 720,
            thickness: 18,
            x: -291,
            y: 0,
            z: 360,
            rzDeg: -90,
        });
        const top = placePanel(doc, {
            name: 'Wieniec G',
            role: 'TOP_PANEL',
            width: 564,
            height: 500,
            thickness: 18,
            x: 0,
            y: 0,
            z: 711,
            rxDeg: -90,
        });

        const faces = scanEligibleConnectorFaces(doc);
        expect(faces.length).toBeGreaterThan(0);

        // Styk znajduje się w płaszczyźnie pionowej x = -282, y = -250..+250, z = 702..720 (pasek 18mm na 500mm)
        // Celujemy promieniem wzdłuż osi X w środek paska styku
        const rayOriginInside = new Vec3(-500, 0, 711);
        const rayDir = new Vec3(1, 0, 0);

        const hit = pickEligibleFace(faces, rayOriginInside, rayDir);
        expect(hit).not.toBeNull();
    });

    it('nie trafia (brak hovera), gdy promień celuje poza obrysem paska styku (np. 15mm powyżej)', () => {
        const doc = new ProjectDocument({ name: 'C2 pick precision' });
        placePanel(doc, {
            name: 'Bok L',
            role: 'LEFT_SIDE_PANEL',
            width: 500,
            height: 720,
            thickness: 18,
            x: -291,
            y: 0,
            z: 360,
            rzDeg: -90,
        });
        placePanel(doc, {
            name: 'Wieniec G',
            role: 'TOP_PANEL',
            width: 564,
            height: 500,
            thickness: 18,
            x: 0,
            y: 0,
            z: 711,
            rxDeg: -90,
        });

        const faces = scanEligibleConnectorFaces(doc);
        expect(faces.length).toBeGreaterThan(0);

        // Celujemy powyżej paska styku (z = 740 zamiast z = 711; góra formatki kończy się na z = 720)
        const rayOriginOutside = new Vec3(-500, 0, 740);
        const rayDir = new Vec3(1, 0, 0);

        const hit = pickEligibleFace(faces, rayOriginOutside, rayDir);
        expect(hit).toBeNull();
    });
});

