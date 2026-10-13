/**
 * Tworzy korpus SmartFrame (jedna komenda, undo usuwa węzeł).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import type { KorpusCreateParams } from '../../A1_core/cabinet-port.js';
import { runEngineAndApply } from '../smartframe-adapter.js';

export class CreateKorpusCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly params: KorpusCreateParams;

    private createdId: string | null = null;

    constructor(params: KorpusCreateParams) {
        this.params = params;
        this.id = `cmd_create_korpus_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Utwórz Korpus';
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        const existingCount = typeof document.getContainers === 'function' ? document.getContainers().length : 0;
        const p = this.params;
        const wMm = p.szerokosc_mm;
        const hMm = p.wysokosc_mm;
        const dMm = p.glebokosc_mm;
        const ctype = p.typ_korpusu || 'korpus3';
        const isRogowy1 = ctype === 'korpus_rogowy1';
        const isRogowy90 = ctype === 'korpus_rogowy90';
        const isSkosny = ctype === 'korpus_skosny' || ctype === 'korpus_skosny_dach' || ctype === 'korpus_skosny_lr' || ctype === 'korpus_skosny_lr_uc';
        const isSkosnyLr = ctype === 'korpus_skosny_lr' || ctype === 'korpus_skosny_lr_uc';
        const isCorner = isRogowy1 || isRogowy90;
        const zoneCount = (isCorner || isSkosny) ? 1 : (p.liczba_stref ?? 1);
        const hLeft = p.wysokosc_lewy_mm ?? 1000;
        const hRight = p.wysokosc_prawy_mm ?? 2200;
        const hFront = p.wysokosc_przod_mm ?? 1000;
        const hBack = p.wysokosc_tyl_mm ?? 2200;
        const bHeight = p.wysokosc_strefy_dolnej_mm;
        const mHeight = p.wysokosc_strefy_srodkowej_mm ?? 0;
        const bOffset = p.cofniecie_plecow_mm ?? 3;

        const skosH = isSkosnyLr
            ? Math.max(hLeft, hRight)
            : isSkosny ? Math.max(hFront, hBack) : hMm;
        const nc = new ContainerModel({
            width: mmToNm(wMm),
            height: mmToNm(skosH),
            depth: mmToNm(dMm),
            name: `Korpus ${existingCount + 1}`
        });
        const typeStr = ctype === 'korpus_skosny_lr_uc' ? 'korpus_skosny_lr_uc'
            : isSkosnyLr ? 'korpus_skosny_lr'
            : ctype === 'korpus_skosny_dach' ? 'korpus_skosny_dach'
            : isSkosny ? 'korpus_skosny'
            : isRogowy90 ? 'korpus_rogowy90'
            : isRogowy1 ? 'korpus_rogowy1'
            : 'korpus3_2';
        // Kanoniczny generatorParams — bez aliasów. Osobny obiekt offsets (bez współdzielenia referencji).
        nc.generatorParams = {
            type: typeStr,
            typ_korpusu: ctype,
            szerokosc_mm: wMm,
            wysokosc_mm: isSkosny ? skosH : hMm,
            glebokosc_mm: dMm,
            liczba_stref: zoneCount,
            wysokosc_strefy_dolnej_mm: (isCorner || isSkosny) ? skosH : (bHeight ?? hMm),
            wysokosc_strefy_srodkowej_mm: (isCorner || isSkosny) ? 0 : mHeight,
            cofniecie_plecow_mm: bOffset,
            offsets: { ...(p.offsets || {}) },
            ...(isSkosny && !isSkosnyLr
                ? { wysokosc_przod_mm: hFront, wysokosc_tyl_mm: hBack }
                : {}),
            ...(isSkosnyLr
                ? { wysokosc_lewy_mm: hLeft, wysokosc_prawy_mm: hRight }
                : {}),
            ...(isRogowy1
                ? { szerokosc_blendy_mm: p.szerokosc_blendy_mm ?? 400, strona_blendy: p.strona_blendy ?? 'LEFT' }
                : {}),
            ...(isRogowy90
                ? {
                    glebokosc_boku_lewego_mm: p.glebokosc_boku_lewego_mm ?? 600,
                    glebokosc_boku_prawego_mm: p.glebokosc_boku_prawego_mm ?? 600
                }
                : {})
        };

        const ncNode = CADNode.create(NodeType.ASSEMBLY, nc.name, nc.id);
        ncNode.domainData = nc;
        if (p.position) {
            ncNode.setLocalTransform(
                new Vec3(
                    mmToNm(p.position.x),
                    mmToNm(p.position.y),
                    mmToNm(p.position.z || 0)
                ),
                Quat.IDENTITY
            );
        }
        document.addNode(document.rootNode.id, ncNode);
        this.createdId = nc.id;
        this.affectedNodeIds.splice(0, this.affectedNodeIds.length, nc.id);

        runEngineAndApply(
            nc,
            wMm,
            skosH,
            dMm,
            zoneCount,
            (isCorner || isSkosny) ? skosH : (bHeight ?? hMm),
            (isCorner || isSkosny) ? 0 : mHeight,
            bOffset,
            { ...(p.offsets || {}) }
        );

        document.setActiveEntity(nc);
        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }

    undo(document: ProjectDocument): void {
        if (this.createdId) document.removeNode(this.createdId);
        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }
}
