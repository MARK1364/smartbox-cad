/**
 * 19_sliding-doors-adapter.tsx — moduł DRZWI PRZESUWNE (blok_sliding_doors)
 *
 * Panel UI (SlidingDoorsSubModule) + mapowanie parametrów na silnik
 * (buildSlidingDoorsPlan).
 *
 * Standard Sevroll:
 * - Dwa tory (górny i dolny podwójny)
 * - Profile rączek aluminiowych po bokach na pełnej wysokości skrzydła
 * - Mijanie się skrzydeł w osi Y
 * - Domyślna liczba skrzydeł wyliczana z szerokości wnęki
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import slidingDoorsTekstRaw from './19_sliding-doors_tekst.json';
import type { ContainerModel } from '../A1_core/container-model.js';
import type { SlidingDoorsPlanParams, SlidingRollerType } from './01_bloki-module-types.js';

export { buildSlidingDoorsPlan } from './01_module-plans.js';

const slidingTekst = slidingDoorsTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.sliding_doors';

function normalizeRollerType(val: string | undefined): SlidingRollerType {
    const s = String(val ?? 'BOTTOM').toUpperCase();
    if (s === 'TOP') return 'TOP';
    if (s === 'BOTH') return 'BOTH';
    return 'BOTTOM';
}

const inputStyle: React.CSSProperties = {
    width: '70px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right',
    fontSize: '12px'
};

const labelStyle: React.CSSProperties = {
    color: '#d4d4d8',
    fontSize: '12px'
};

const sectionStyle: React.CSSProperties = {
    background: '#1c1c1f',
    border: '1px solid #2d2d30',
    borderRadius: '4px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
};

const sectionTitleStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#93c5fd'
};

const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

export function SlidingDoorsSubModule({
    container,
    triggerUpdate
}: {
    container: ContainerModel;
    triggerUpdate: (params: Partial<SlidingDoorsPlanParams>) => void;
}) {
    useLocale();
    const p = container?.generatorParams || {};

    const [leafCount, setLeafCount] = useState<number>(Number(p.liczba_skrzydel ?? 2));
    const [frontThick, setFrontThick] = useState<number>(Number(p.grubosc_frontu_mm ?? 18));
    const [overlapMm, setOverlapMm] = useState<number>(Number(p.zakladka_mm ?? 30));

    const [ovTop, setOvTop] = useState<number>(Number(p.nalozenie_gora_mm ?? 0));
    const [ovBottom, setOvBottom] = useState<number>(Number(p.nalozenie_dol_mm ?? 0));
    const [ovLeft, setOvLeft] = useState<number>(Number(p.nalozenie_lewe_mm ?? 0));
    const [ovRight, setOvRight] = useState<number>(Number(p.nalozenie_prawe_mm ?? 0));

    const [rollerType, setRollerType] = useState<SlidingRollerType>(() => normalizeRollerType(p.typ_rolki));
    const [rollerId, setRollerId] = useState<string>(String(p.roller_id ?? 'SEVROLL_GEMINI_ROLLER'));
    const [handleId, setHandleId] = useState<string>(String(p.handle_id ?? 'SEVROLL_ALFA_HANDLE'));

    const [topTrackH, setTopTrackH] = useState<number>(Number(p.tor_gorny_wysokosc_mm ?? 40));
    const [topTrackD, setTopTrackD] = useState<number>(Number(p.tor_gorny_glebokosc_mm ?? 75));
    const [topTrackSetback, setTopTrackSetback] = useState<number>(Number(p.tor_gorny_cofniecie_mm ?? 0));

    const [bottomTrackH, setBottomTrackH] = useState<number>(Number(p.tor_dolny_wysokosc_mm ?? p.prowadnica_dolna_wysokosc_mm ?? 10));
    const [bottomTrackD, setBottomTrackD] = useState<number>(Number(p.tor_dolny_glebokosc_mm ?? p.prowadnica_dolna_glebokosc_mm ?? 60));
    const [bottomTrackSetback, setBottomTrackSetback] = useState<number>(Number(p.tor_dolny_cofniecie_mm ?? p.prowadnica_dolna_cofniecie_mm ?? 0));

    const [trackSpacing, setTrackSpacing] = useState<number>(Number(p.rozstaw_torow_mm ?? 35));
    const [handleW, setHandleW] = useState<number>(Number(p.szerokosc_raczki_mm ?? 25));
    const [handleT, setHandleT] = useState<number>(Number(p.grubosc_raczki_mm ?? 28));

    const [showRollers, setShowRollers] = useState<boolean>(p.pokaz_rolki !== false);
    const [showHandles, setShowHandles] = useState<boolean>(p.pokaz_raczki !== false);

    // Synchronizacja przy zmianie aktywnego kontenera
    useEffect(() => {
        const gp = container?.generatorParams || {};
        setLeafCount(Number(gp.liczba_skrzydel ?? 2));
        setFrontThick(Number(gp.grubosc_frontu_mm ?? 18));
        setOverlapMm(Number(gp.zakladka_mm ?? 30));
        setOvTop(Number(gp.nalozenie_gora_mm ?? 0));
        setOvBottom(Number(gp.nalozenie_dol_mm ?? 0));
        setOvLeft(Number(gp.nalozenie_lewe_mm ?? 0));
        setOvRight(Number(gp.nalozenie_prawe_mm ?? 0));
        setRollerType(normalizeRollerType(gp.typ_rolki));
        setRollerId(String(gp.roller_id ?? 'SEVROLL_GEMINI_ROLLER'));
        setHandleId(String(gp.handle_id ?? 'SEVROLL_ALFA_HANDLE'));
        setTopTrackH(Number(gp.tor_gorny_wysokosc_mm ?? 40));
        setTopTrackD(Number(gp.tor_gorny_glebokosc_mm ?? 75));
        setTopTrackSetback(Number(gp.tor_gorny_cofniecie_mm ?? 0));
        setBottomTrackH(Number(gp.tor_dolny_wysokosc_mm ?? gp.prowadnica_dolna_wysokosc_mm ?? 10));
        setBottomTrackD(Number(gp.tor_dolny_glebokosc_mm ?? gp.prowadnica_dolna_glebokosc_mm ?? 60));
        setBottomTrackSetback(Number(gp.tor_dolny_cofniecie_mm ?? gp.prowadnica_dolna_cofniecie_mm ?? 0));
        setTrackSpacing(Number(gp.rozstaw_torow_mm ?? 35));
        setHandleW(Number(gp.szerokosc_raczki_mm ?? 25));
        setHandleT(Number(gp.grubosc_raczki_mm ?? 28));
        setShowRollers(gp.pokaz_rolki !== false);
        setShowHandles(gp.pokaz_raczki !== false);
    }, [container?.id]);

    const rollerTypes: SlidingRollerType[] = ['BOTTOM', 'TOP', 'BOTH'];

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Skrzydła */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>{tx(slidingTekst, 'leaves.title', TX_NS)}</div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'leaf_count.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={leafCount}
                        step={1} decimals={0}
                        unit="szt"
                        style={inputStyle}
                        onChange={(val) => {
                            const clamped = Math.min(6, Math.max(1, Math.round(val)));
                            setLeafCount(clamped);
                            triggerUpdate({ liczba_skrzydel: clamped });
                        }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'leaf_thickness.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={frontThick}
                        step={0.1} decimals={1}
                        unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setFrontThick(val); triggerUpdate({ grubosc_frontu_mm: val }); }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'overlap_mm.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={overlapMm}
                        step={1} decimals={0}
                        unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setOverlapMm(val); triggerUpdate({ zakladka_mm: val }); }}
                    />
                </div>
            </div>

            {/* Profile rączek aluminiowych */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>{tx(slidingTekst, 'handles.title', TX_NS)}</div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'handle_width.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={handleW} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setHandleW(val); triggerUpdate({ szerokosc_raczki_mm: val }); }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'handle_thickness.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={handleT} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setHandleT(val); triggerUpdate({ grubosc_raczki_mm: val }); }}
                    />
                </div>
            </div>

            {/* Nałożenia */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>{tx(slidingTekst, 'overlaps.title', TX_NS)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={rowStyle}>
                        <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(slidingTekst, 'ov_top.label', TX_NS)}</span>
                        <SmartNumericInput
                            value={ovTop} step={0.1} decimals={1} unit="mm"
                            style={{ ...inputStyle, width: '50px', fontSize: '11px' }}
                            onChange={(val) => { setOvTop(val); triggerUpdate({ nalozenie_gora_mm: val }); }}
                        />
                    </div>
                    <div style={rowStyle}>
                        <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(slidingTekst, 'ov_bottom.label', TX_NS)}</span>
                        <SmartNumericInput
                            value={ovBottom} step={0.1} decimals={1} unit="mm"
                            style={{ ...inputStyle, width: '50px', fontSize: '11px' }}
                            onChange={(val) => { setOvBottom(val); triggerUpdate({ nalozenie_dol_mm: val }); }}
                        />
                    </div>
                    <div style={rowStyle}>
                        <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(slidingTekst, 'ov_left.label', TX_NS)}</span>
                        <SmartNumericInput
                            value={ovLeft} step={0.1} decimals={1} unit="mm"
                            style={{ ...inputStyle, width: '50px', fontSize: '11px' }}
                            onChange={(val) => { setOvLeft(val); triggerUpdate({ nalozenie_lewe_mm: val }); }}
                        />
                    </div>
                    <div style={rowStyle}>
                        <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(slidingTekst, 'ov_right.label', TX_NS)}</span>
                        <SmartNumericInput
                            value={ovRight} step={0.1} decimals={1} unit="mm"
                            style={{ ...inputStyle, width: '50px', fontSize: '11px' }}
                            onChange={(val) => { setOvRight(val); triggerUpdate({ nalozenie_prawe_mm: val }); }}
                        />
                    </div>
                </div>
            </div>

            {/* Tory jezdne */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>{tx(slidingTekst, 'track.title', TX_NS)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={labelStyle}>{tx(slidingTekst, 'roller_type.label', TX_NS)}</span>
                    <div style={{ display: 'flex', width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                        {rollerTypes.map((rt, idx) => (
                            <button
                                key={rt}
                                style={{
                                    flex: 1,
                                    padding: '5px 0',
                                    background: rollerType === rt ? '#3b82f6' : '#27272a',
                                    color: '#fff',
                                    border: 'none',
                                    borderLeft: idx > 0 ? '1px solid #3f3f46' : 'none',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: rollerType === rt ? 'bold' : 'normal'
                                }}
                                onClick={() => { setRollerType(rt); triggerUpdate({ typ_rolki: rt }); }}
                            >
                                {tx(slidingTekst, `roller_type.${rt}`, TX_NS)}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'track_spacing.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={trackSpacing} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setTrackSpacing(val); triggerUpdate({ rozstaw_torow_mm: val }); }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'track_top_height.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={topTrackH} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setTopTrackH(val); triggerUpdate({ tor_gorny_wysokosc_mm: val }); }}
                    />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'track_top_depth.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={topTrackD} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setTopTrackD(val); triggerUpdate({ tor_gorny_glebokosc_mm: val }); }}
                    />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'track_top_setback.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={topTrackSetback} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setTopTrackSetback(val); triggerUpdate({ tor_gorny_cofniecie_mm: val }); }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'track_bottom_height.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={bottomTrackH} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setBottomTrackH(val); triggerUpdate({ tor_dolny_wysokosc_mm: val }); }}
                    />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'track_bottom_depth.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={bottomTrackD} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setBottomTrackD(val); triggerUpdate({ tor_dolny_glebokosc_mm: val }); }}
                    />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'track_bottom_setback.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={bottomTrackSetback} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => { setBottomTrackSetback(val); triggerUpdate({ tor_dolny_cofniecie_mm: val }); }}
                    />
                </div>
            </div>

            {/* Okucia i widoczność */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>{tx(slidingTekst, 'hardware.title', TX_NS)}</div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'roller_id.label', TX_NS)}</span>
                    <input
                        type="text"
                        value={rollerId}
                        style={{ ...inputStyle, width: '140px', textAlign: 'left' }}
                        onChange={(e) => { setRollerId(e.target.value); triggerUpdate({ roller_id: e.target.value }); }}
                    />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'handle_id.label', TX_NS)}</span>
                    <input
                        type="text"
                        value={handleId}
                        style={{ ...inputStyle, width: '140px', textAlign: 'left' }}
                        onChange={(e) => { setHandleId(e.target.value); triggerUpdate({ handle_id: e.target.value }); }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'show_handles.label', TX_NS)}</span>
                    <input
                        type="checkbox"
                        checked={showHandles}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        onChange={(e) => { setShowHandles(e.target.checked); triggerUpdate({ pokaz_raczki: e.target.checked }); }}
                    />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(slidingTekst, 'show_rollers.label', TX_NS)}</span>
                    <input
                        type="checkbox"
                        checked={showRollers}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        onChange={(e) => { setShowRollers(e.target.checked); triggerUpdate({ pokaz_rolki: e.target.checked }); }}
                    />
                </div>
            </div>
        </div>
    );
}
