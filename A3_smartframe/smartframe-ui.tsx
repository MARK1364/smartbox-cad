import React, { useState, useEffect, useCallback } from 'react';
import {
    getActiveContainer,
    calcTopHeight,
    applyRealtimeUpdate
} from './smartframe-adapter.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartFrameDragController } from './smartframe-drag-controller.js';
import { korpusDefaultsForTypeMm } from './korpus-defaults.js';
import { UIController } from '../A1_core/ui-controller.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import korpusTekstRaw from './korpus_tekst.json';

const korpusTekst = korpusTekstRaw as unknown as ModuleTexts;
const TX_NS = 'smartframe.korpus';

type CabinetUiType = 'KORPUS3' | 'KORPUS_ROGOWY1' | 'KORPUS_ROGOWY90' | 'KORPUS_SKOSNY_DACH' | 'KORPUS_SKOSNY_LR_UC';
type BlindSide = 'LEFT' | 'RIGHT';

function uiToEngineType(t: CabinetUiType): 'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90' | 'korpus_skosny_dach' | 'korpus_skosny_lr_uc' {
    if (t === 'KORPUS_SKOSNY_LR_UC') return 'korpus_skosny_lr_uc';
    if (t === 'KORPUS_SKOSNY_DACH') return 'korpus_skosny_dach';
    if (t === 'KORPUS_ROGOWY90') return 'korpus_rogowy90';
    if (t === 'KORPUS_ROGOWY1') return 'korpus_rogowy1';
    return 'korpus3';
}

const UI_DEFAULTS_3 = korpusDefaultsForTypeMm('korpus3');
const UI_DEFAULTS_R1 = korpusDefaultsForTypeMm('korpus_rogowy1');
const UI_DEFAULTS_R90 = korpusDefaultsForTypeMm('korpus_rogowy90');
const UI_DEFAULTS_SKLR = korpusDefaultsForTypeMm('korpus_skosny_lr_uc');
const UI_DEFAULTS_SKDACH = korpusDefaultsForTypeMm('korpus_skosny_dach');

interface Props {
    projectModel: any;
}

export function SmartFrameUI({ projectModel }: Props) {
    useLocale();
    const [cabinetType,  setCabinetType]  = useState<CabinetUiType>('KORPUS3');
    const [width,        setWidth]        = useState(UI_DEFAULTS_3.szerokosc_mm);
    const [height,       setHeight]       = useState(UI_DEFAULTS_3.wysokosc_mm);
    const [depth,        setDepth]        = useState(UI_DEFAULTS_3.glebokosc_mm);
    const [zoneCount,    setZoneCount]    = useState<1|2|3>(UI_DEFAULTS_3.liczba_stref);
    const [bottomHeight, setBottomHeight] = useState(UI_DEFAULTS_3.wysokosc_strefy_dolnej_mm);
    const [middleHeight, setMiddleHeight] = useState(UI_DEFAULTS_3.wysokosc_strefy_srodkowej_mm);
    const [backOffset,   setBackOffset]   = useState(3);
    const [blindWidth,   setBlindWidth]   = useState(UI_DEFAULTS_R1.szerokosc_blendy_mm ?? 400);
    const [blindSide,    setBlindSide]    = useState<BlindSide>(UI_DEFAULTS_R1.strona_blendy ?? 'LEFT');
    const [bokLewy,     setBokLewy]     = useState(UI_DEFAULTS_R90.glebokosc_boku_lewego_mm ?? 600);
    const [bokPrawy,    setBokPrawy]    = useState(UI_DEFAULTS_R90.glebokosc_boku_prawego_mm ?? 600);
    const [heightLeft,  setHeightLeft]  = useState(UI_DEFAULTS_SKLR.wysokosc_lewy_mm ?? 1000);
    const [heightRight, setHeightRight] = useState(UI_DEFAULTS_SKLR.wysokosc_prawy_mm ?? 2200);
    const [heightFront, setHeightFront] = useState(UI_DEFAULTS_SKDACH.wysokosc_przod_mm ?? 2200);
    const [heightBack,  setHeightBack]  = useState(UI_DEFAULTS_SKDACH.wysokosc_tyl_mm ?? 1000);
    const [activeKorpusName, setActiveKorpusName] = useState<string | null>(null);

    const isRogowy1 = cabinetType === 'KORPUS_ROGOWY1';
    const isRogowy90 = cabinetType === 'KORPUS_ROGOWY90';
    const isSkosnyDach = cabinetType === 'KORPUS_SKOSNY_DACH';
    const isSkosnyLrUc = cabinetType === 'KORPUS_SKOSNY_LR_UC';
    const isSkosnyOneZone = isSkosnyDach || isSkosnyLrUc;
    const isCorner = isRogowy1 || isRogowy90;
    const isRogowy = isCorner;
    const effectiveZoneCount: 1 | 2 | 3 = (isCorner || isSkosnyOneZone) ? 1 : zoneCount;
    const topHeight = calcTopHeight(height, effectiveZoneCount, bottomHeight, middleHeight);

    const getDragController = (): SmartFrameDragController => {
        if (!ContextManager.instance.smartFrameDragController) {
            ContextManager.instance.smartFrameDragController = new SmartFrameDragController();
        }
        return ContextManager.instance.smartFrameDragController;
    };

    const getSensibleHeights = (zc: 1 | 2 | 3, curH: number, curHB: number, curHM: number) => {
        let bH = curHB;
        let mH = curHM;
        if (zc === 1) {
            bH = curH;
            mH = 0;
        } else if (zc === 2) {
            if (bH >= curH || bH <= 0 || bH === 500) {
                bH = curH > 2000 ? 2000 : (curH >= 400 ? curH - 200 : Math.round(curH / 2));
            }
            mH = 0;
        } else if (zc === 3) {
            if (bH + mH >= curH || bH <= 0 || mH <= 0 || bH >= curH || bH === 2000) {
                bH = 500;
                mH = 1200;
                if (bH + mH >= curH) {
                    bH = Math.round(curH * 0.25);
                    mH = Math.round(curH * 0.55);
                }
            }
        }
        return { bH, mH };
    };

    const handleDragStart = (
        zc: 1 | 2 | 3,
        e: React.DragEvent,
        dragType: CabinetUiType = 'KORPUS3'
    ) => {
        // Nowy korpus = defaults z JSON dla typu, nie gabaryt aktywnego (formularz).
        const engineType = uiToEngineType(dragType);
        const defs = korpusDefaultsForTypeMm(engineType);
        const isDragCorner = dragType === 'KORPUS_ROGOWY1' || dragType === 'KORPUS_ROGOWY90';
        const isDragSkosny = dragType === 'KORPUS_SKOSNY_LR_UC' || dragType === 'KORPUS_SKOSNY_DACH';
        const { bH, mH } = getSensibleHeights(
            (isDragCorner || isDragSkosny) ? 1 : zc,
            defs.wysokosc_mm,
            defs.wysokosc_strefy_dolnej_mm,
            defs.wysokosc_strefy_srodkowej_mm
        );
        const dragCtrl = getDragController();
        dragCtrl.startDrag((isDragCorner || isDragSkosny) ? 1 : zc, {
            szerokosc_mm: defs.szerokosc_mm,
            wysokosc_mm: defs.wysokosc_mm,
            glebokosc_mm: defs.glebokosc_mm,
            wysokosc_strefy_dolnej_mm: (isDragCorner || isDragSkosny) ? defs.wysokosc_mm : bH,
            wysokosc_strefy_srodkowej_mm: (isDragCorner || isDragSkosny) ? 0 : mH,
            cofniecie_plecow_mm: defs.cofniecie_plecow_mm ?? 3,
            typ_korpusu: engineType,
            szerokosc_blendy_mm: defs.szerokosc_blendy_mm,
            strona_blendy: defs.strona_blendy,
            glebokosc_boku_lewego_mm: defs.glebokosc_boku_lewego_mm,
            glebokosc_boku_prawego_mm: defs.glebokosc_boku_prawego_mm,
            wysokosc_lewy_mm: defs.wysokosc_lewy_mm,
            wysokosc_prawy_mm: defs.wysokosc_prawy_mm,
            wysokosc_przod_mm: defs.wysokosc_przod_mm,
            wysokosc_tyl_mm: defs.wysokosc_tyl_mm
        });
        try {
            // Kanoniczny payload drag&drop — spójny z CabinetPlanParams.
            e.dataTransfer.setData('application/cad-korpus', JSON.stringify({
                liczba_stref: (isDragCorner || isDragSkosny) ? 1 : zc,
                typ_korpusu: engineType
            }));
            e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignoruj */ }
    };

    const handleDragEnd = () => {
        const dragCtrl = getDragController();
        dragCtrl.endDrag();
    };

    // â”€â”€ Sync formularza gdy zmienia siÄ™ activeEntity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        if (!projectModel) return;

        const sync = () => {
            const container = getActiveContainer(projectModel);
            if (!container) {
                setActiveKorpusName(null);
                return;
            }

            setActiveKorpusName(container.name || 'Korpus');

            const w = Math.round(nmToMm(container.width));
            const h = Math.round(nmToMm(container.height));
            const d = Math.round(nmToMm(container.depth));
            setWidth(w);
            setHeight(h);
            setDepth(d);

            const p = container.generatorParams || {};
            const t = String(p.type || '').toLowerCase();
            if (t.includes('skosny_lr_uc') || t.includes('skosny-lr-uc') || t.includes('skosny_lr') || t.includes('skosny-lr')) {
                // Stary korpus_skosny_lr (bez UI) â†’ formularz uciÄ™tego L/P.
                setCabinetType('KORPUS_SKOSNY_LR_UC');
                setZoneCount(1);
                if (p.wysokosc_lewy_mm !== undefined) setHeightLeft(Number(p.wysokosc_lewy_mm));
                if (p.wysokosc_prawy_mm !== undefined) setHeightRight(Number(p.wysokosc_prawy_mm));
                setBottomHeight(h);
                setMiddleHeight(0);
            } else if (t.includes('skosny_dach') || t.includes('skosny-dach')) {
                setCabinetType('KORPUS_SKOSNY_DACH');
                setZoneCount(1);
                if (p.wysokosc_przod_mm !== undefined) setHeightFront(Number(p.wysokosc_przod_mm));
                if (p.wysokosc_tyl_mm !== undefined) setHeightBack(Number(p.wysokosc_tyl_mm));
                setBottomHeight(h);
                setMiddleHeight(0);
            } else if (t.includes('rogowy90') || t.includes('rogowy_90')) {
                setCabinetType('KORPUS_ROGOWY90');
                setZoneCount(1);
                if (p.glebokosc_boku_lewego_mm !== undefined) setBokLewy(Number(p.glebokosc_boku_lewego_mm));
                if (p.glebokosc_boku_prawego_mm !== undefined) setBokPrawy(Number(p.glebokosc_boku_prawego_mm));
            } else if (t.includes('rogowy')) {
                setCabinetType('KORPUS_ROGOWY1');
                setZoneCount(1);
                if (p.szerokosc_blendy_mm !== undefined) setBlindWidth(Number(p.szerokosc_blendy_mm));
                if (p.strona_blendy !== undefined) {
                    setBlindSide(p.strona_blendy === 'RIGHT' ? 'RIGHT' : 'LEFT');
                }
            } else {
                setCabinetType('KORPUS3');
                const zc = p.liczba_stref !== undefined ? (Number(p.liczba_stref) as 1|2|3) : 3;
                setZoneCount(zc);
                const bh = p.wysokosc_strefy_dolnej_mm;
                if (zc >= 2 && bh !== undefined && bh < h) {
                    setBottomHeight(bh);
                }
                const mh = p.wysokosc_strefy_srodkowej_mm;
                if (zc === 3 && mh !== undefined && mh > 0) {
                    setMiddleHeight(mh);
                }
            }
            // WyjÄ…tek gizmo: `backOffset` zapisuje A1_core/gizmo-controller.
            const bo = p.cofniecie_plecow_mm ?? p.backOffset;
            if (bo !== undefined) setBackOffset(bo);
        };

        const unsub = projectModel?.onDocumentChanged ? projectModel.onDocumentChanged(sync) : (projectModel?.onChange ? projectModel.onChange(sync) : null);
        sync();

        return () => {
            if (typeof unsub === 'function') unsub();
            else if (projectModel?.offChange) projectModel.offChange(sync);
        };
    }, [projectModel]);

    const triggerRealtime = useCallback((
        szerokosc_mm: number,
        wysokosc_mm: number,
        glebokosc_mm: number,
        liczba_stref: 1 | 2 | 3,
        wysokosc_strefy_dolnej_mm: number,
        wysokosc_strefy_srodkowej_mm: number,
        cofniecie_plecow_mm: number,
        type: CabinetUiType = cabinetType,
        szerokosc_blendy_mm: number = blindWidth,
        strona_blendy: BlindSide = blindSide,
        glebokosc_boku_lewego_mm: number = bokLewy,
        glebokosc_boku_prawego_mm: number = bokPrawy,
        wysokosc_lewy_mm: number = heightLeft,
        wysokosc_prawy_mm: number = heightRight,
        wysokosc_przod_mm: number = heightFront,
        wysokosc_tyl_mm: number = heightBack
    ) => {
        const corner = type === 'KORPUS_ROGOWY1' || type === 'KORPUS_ROGOWY90';
        const skosnyLrUc = type === 'KORPUS_SKOSNY_LR_UC';
        const skosnyDach = type === 'KORPUS_SKOSNY_DACH';
        const skosnyH = skosnyLrUc
            ? Math.max(wysokosc_lewy_mm, wysokosc_prawy_mm, wysokosc_mm)
            : skosnyDach
            ? Math.max(wysokosc_przod_mm, wysokosc_tyl_mm, wysokosc_mm)
            : wysokosc_mm;
        const active = getActiveContainer(projectModel);
        applyRealtimeUpdate(projectModel, {
            szerokosc_mm,
            wysokosc_mm: skosnyH,
            glebokosc_mm,
            liczba_stref: (corner || skosnyLrUc || skosnyDach) ? 1 : liczba_stref,
            wysokosc_strefy_dolnej_mm,
            wysokosc_strefy_srodkowej_mm,
            cofniecie_plecow_mm,
            typ_korpusu: uiToEngineType(type),
            szerokosc_blendy_mm,
            strona_blendy,
            glebokosc_boku_lewego_mm,
            glebokosc_boku_prawego_mm,
            wysokosc_lewy_mm,
            wysokosc_prawy_mm,
            wysokosc_przod_mm,
            wysokosc_tyl_mm
        }, active);
    }, [projectModel, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack]);

    const onWidth  = (v: number) => { setWidth(v);  triggerRealtime(v, height, depth, effectiveZoneCount, bottomHeight, middleHeight, backOffset); };
    const onHeight = (v: number) => {
        setHeight(v);
        if (isSkosnyDach) setHeightFront(v);
        triggerRealtime(width, v, depth, effectiveZoneCount, bottomHeight, middleHeight, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, isSkosnyDach ? v : heightFront, heightBack);
    };
    const onDepth  = (v: number) => { setDepth(v);  triggerRealtime(width, height, v, effectiveZoneCount, bottomHeight, middleHeight, backOffset); };
    const onHB     = (v: number) => { setBottomHeight(v); triggerRealtime(width, height, depth, effectiveZoneCount, v, middleHeight, backOffset); };
    const onHM     = (v: number) => { setMiddleHeight(v); triggerRealtime(width, height, depth, effectiveZoneCount, bottomHeight, v, backOffset); };
    const onHeightLeft  = (v: number) => { setHeightLeft(v); triggerRealtime(width, Math.max(v, height), depth, 1, Math.max(v, height), 0, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, v, height); };
    const onHeightFront = (v: number) => { setHeight(v); setHeightFront(v); triggerRealtime(width, v, depth, 1, v, 0, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, v, heightBack); };
    const onHeightBack  = (v: number) => { setHeightBack(v); triggerRealtime(width, height, depth, 1, height, 0, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, height, v); };

    const handleCardClick = (cardType: CabinetUiType, zc: 1 | 2 | 3 = 1) => {
        const active = getActiveContainer(projectModel);
        if (active) {
            UIController.instance?.setStatus(
                tx(korpusTekst, 'cards.hint_status', TX_NS),
                true
            );
            return;
        }
        // Gdy ĹĽaden korpus nie jest zaznaczony, przeĹ‚Ä…czamy formularz parametrĂłw pod nowy korpus
        setCabinetType(cardType);
        if (cardType === 'KORPUS_SKOSNY_DACH') {
            const defs = korpusDefaultsForTypeMm('korpus_skosny_dach');
            setZoneCount(1);
            setWidth(defs.szerokosc_mm);
            setHeight(defs.wysokosc_mm);
            setDepth(defs.glebokosc_mm);
            setBottomHeight(defs.wysokosc_mm);
            setMiddleHeight(0);
            setBackOffset(defs.cofniecie_plecow_mm ?? 3);
            if (defs.wysokosc_przod_mm !== undefined) setHeightFront(defs.wysokosc_przod_mm);
            if (defs.wysokosc_tyl_mm !== undefined) setHeightBack(defs.wysokosc_tyl_mm);
        } else if (cardType === 'KORPUS_SKOSNY_LR_UC') {
            const defs = korpusDefaultsForTypeMm('korpus_skosny_lr_uc');
            setZoneCount(1);
            setWidth(defs.szerokosc_mm);
            setHeight(defs.wysokosc_mm);
            setDepth(defs.glebokosc_mm);
            setBottomHeight(defs.wysokosc_mm);
            setMiddleHeight(0);
            setBackOffset(defs.cofniecie_plecow_mm ?? 3);
            if (defs.wysokosc_lewy_mm !== undefined) setHeightLeft(defs.wysokosc_lewy_mm);
            if (defs.wysokosc_prawy_mm !== undefined) setHeightRight(defs.wysokosc_prawy_mm);
        } else if (cardType === 'KORPUS_ROGOWY1') {
            const defs = korpusDefaultsForTypeMm('korpus_rogowy1');
            setZoneCount(1);
            setWidth(defs.szerokosc_mm);
            setHeight(defs.wysokosc_mm);
            setDepth(defs.glebokosc_mm);
            setBottomHeight(defs.wysokosc_mm);
            setMiddleHeight(0);
            setBackOffset(defs.cofniecie_plecow_mm ?? 3);
            if (defs.szerokosc_blendy_mm !== undefined) setBlindWidth(defs.szerokosc_blendy_mm);
            if (defs.strona_blendy !== undefined) setBlindSide(defs.strona_blendy);
        } else if (cardType === 'KORPUS_ROGOWY90') {
            const defs = korpusDefaultsForTypeMm('korpus_rogowy90');
            setZoneCount(1);
            setWidth(defs.szerokosc_mm);
            setHeight(defs.wysokosc_mm);
            setDepth(defs.glebokosc_mm);
            setBottomHeight(defs.wysokosc_mm);
            setMiddleHeight(0);
            setBackOffset(defs.cofniecie_plecow_mm ?? 3);
            if (defs.glebokosc_boku_lewego_mm !== undefined) setBokLewy(defs.glebokosc_boku_lewego_mm);
            if (defs.glebokosc_boku_prawego_mm !== undefined) setBokPrawy(defs.glebokosc_boku_prawego_mm);
        } else {
            const defs = korpusDefaultsForTypeMm('korpus3');
            const { bH, mH } = getSensibleHeights(zc, defs.wysokosc_mm, defs.wysokosc_strefy_dolnej_mm, defs.wysokosc_strefy_srodkowej_mm);
            setZoneCount(zc);
            setWidth(defs.szerokosc_mm);
            setHeight(defs.wysokosc_mm);
            setDepth(defs.glebokosc_mm);
            setBottomHeight(bH);
            setMiddleHeight(mH);
            setBackOffset(defs.cofniecie_plecow_mm ?? 3);
        }
    };

    const onBlindWidth = (v: number) => {
        setBlindWidth(v);
        triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY1', v, blindSide, bokLewy, bokPrawy);
    };

    const onBlindSide = (side: BlindSide) => {
        setBlindSide(side);
        triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY1', blindWidth, side, bokLewy, bokPrawy);
    };

    const onBokLewy = (v: number) => {
        setBokLewy(v);
        triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY90', blindWidth, blindSide, v, bokPrawy);
    };

    const onBokPrawy = (v: number) => {
        setBokPrawy(v);
        triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY90', blindWidth, blindSide, bokLewy, v);
    };

    return (
        <div>
            <div className="panel-header">
                <h2>{tx(korpusTekst, 'panel.title', TX_NS)}</h2>
                <p className="subtitle">{tx(korpusTekst, 'panel.subtitle', TX_NS)}</p>
            </div>

            <div className="panel-section" style={{ borderBottom: '1px solid var(--border-color, #333)', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary, #ddd)' }}>
                    {tx(korpusTekst, 'cards.add_title', TX_NS)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <div
                        id="smartframe-card-zone-1"
                        data-rec="smartframe-card-zone-1"
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(1, e, 'KORPUS3')}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick('KORPUS3', 1)}
                        title={tx(korpusTekst, 'cards.zone_1.title', TX_NS)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: !isCorner && zoneCount === 1 ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary, #252528)',
                            border: !isCorner && zoneCount === 1 ? '1px solid #3b82f6' : '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <rect x="2" y="2" width="28" height="38" rx="1" stroke="currentColor" />
                            <rect x="5" y="5" width="22" height="32" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title={tx(korpusTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(korpusTekst, 'cards.zone_1.label', TX_NS)}
                            </span>
                        </div>
                    </div>

                    <div
                        id="smartframe-card-zone-2"
                        data-rec="smartframe-card-zone-2"
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(2, e, 'KORPUS3')}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick('KORPUS3', 2)}
                        title={tx(korpusTekst, 'cards.zone_2.title', TX_NS)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: !isCorner && zoneCount === 2 ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary, #252528)',
                            border: !isCorner && zoneCount === 2 ? '1px solid #3b82f6' : '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <rect x="2" y="2" width="28" height="38" rx="1" stroke="currentColor" />
                            <line x1="2" y1="9" x2="30" y2="9" stroke="currentColor" strokeWidth="2.5" />
                            <rect x="5" y="11" width="22" height="27" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                            <rect x="5" y="4" width="22" height="4" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title={tx(korpusTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(korpusTekst, 'cards.zone_2.label', TX_NS)}
                            </span>
                        </div>
                    </div>

                    <div
                        id="smartframe-card-zone-3"
                        data-rec="smartframe-card-zone-3"
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(3, e, 'KORPUS3')}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick('KORPUS3', 3)}
                        title={tx(korpusTekst, 'cards.zone_3.title', TX_NS)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: !isCorner && zoneCount === 3 ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary, #252528)',
                            border: !isCorner && zoneCount === 3 ? '1px solid #3b82f6' : '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <rect x="2" y="2" width="28" height="38" rx="1" stroke="currentColor" />
                            <line x1="2" y1="27" x2="30" y2="27" stroke="currentColor" strokeWidth="2.5" />
                            <line x1="2" y1="15" x2="30" y2="15" stroke="currentColor" strokeWidth="2.5" />
                            <rect x="5" y="30" width="22" height="7" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                            <rect x="5" y="18" width="22" height="7" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                            <rect x="5" y="5" width="22" height="7" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title={tx(korpusTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(korpusTekst, 'cards.zone_3.label', TX_NS)}
                            </span>
                        </div>
                    </div>

                    <div
                        id="smartframe-card-rogowy1"
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(1, e, 'KORPUS_ROGOWY1')}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick('KORPUS_ROGOWY1', 1)}
                        title={tx(korpusTekst, 'cards.rogowy1.title', TX_NS)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: isRogowy1 ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary, #252528)',
                            border: isRogowy1 ? '1px solid #3b82f6' : '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <rect x="2" y="2" width="28" height="38" rx="1" stroke="currentColor" />
                            <rect x="5" y="5" width="10" height="32" fill="currentColor" fillOpacity="0.25" stroke="none" />
                            <rect x="17" y="5" width="10" height="32" rx="0.5" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title={tx(korpusTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(korpusTekst, 'cards.rogowy1.label', TX_NS)}
                            </span>
                        </div>
                    </div>

                    <div
                        id="smartframe-card-rogowy90"
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(1, e, 'KORPUS_ROGOWY90')}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick('KORPUS_ROGOWY90', 1)}
                        title={tx(korpusTekst, 'cards.rogowy90.title', TX_NS)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: isRogowy90 ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary, #252528)',
                            border: isRogowy90 ? '1px solid #3b82f6' : '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <path d="M4 4 H28 V16 H16 V38 H4 Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
                            <line x1="4" y1="16" x2="16" y2="16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.5" />
                            <line x1="16" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.5" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title={tx(korpusTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(korpusTekst, 'cards.rogowy90.label', TX_NS)}
                            </span>
                        </div>
                    </div>

                    <div
                        id="smartframe-card-skosny-dach"
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(1, e, 'KORPUS_SKOSNY_DACH')}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick('KORPUS_SKOSNY_DACH', 1)}
                        title={tx(korpusTekst, 'cards.skosny_dach.title', TX_NS)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: isSkosnyDach ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary, #252528)',
                            border: isSkosnyDach ? '1px solid #3b82f6' : '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <polygon points="4,6 20,6 28,16 12,16" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" />
                            <polygon points="20,6 28,16 28,33 20,38" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.18" />
                            <rect x="4" y="6" width="16" height="32" rx="0.5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
                            <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title={tx(korpusTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(korpusTekst, 'cards.skosny_dach.label', TX_NS)}
                            </span>
                        </div>
                    </div>

                    <div
                        id="smartframe-card-skosny-lr-uc"
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(1, e, 'KORPUS_SKOSNY_LR_UC')}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick('KORPUS_SKOSNY_LR_UC', 1)}
                        title={tx(korpusTekst, 'cards.skosny_lr_uc.title', TX_NS)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: isSkosnyLrUc ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary, #252528)',
                            border: isSkosnyLrUc ? '1px solid #3b82f6' : '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <polygon points="4,22 28,6 28,38 4,38" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title={tx(korpusTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(korpusTekst, 'cards.skosny_lr_uc.label', TX_NS)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
