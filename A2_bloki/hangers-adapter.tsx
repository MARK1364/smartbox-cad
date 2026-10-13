/**
 * A2_bloki/hangers-adapter.tsx
 *
 * Moduł ZAWIESZKI (blok_hangers / HANGERS).
 * Panel UI (HangersSubModule) obsługujący wybór szablonu, zestawu oraz parametrów z JSON-a.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { ContainerModel } from '../A1_core/container-model.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { listByType, getHardware } from '../B1_biblioteka/index.js';
import { extractHangerSets, resolveActiveHangerSet, type HangersPlanParams } from './hangers-types.js';

export { buildHangersPlan } from './module-plans.js';

export function HangersSubModule({
    container,
    triggerUpdate,
}: {
    container: ContainerModel;
    triggerUpdate: (params: Partial<HangersPlanParams>) => void;
}) {
    const p = (container?.generatorParams || {}) as any;

    const availableHangers = useMemo(() => {
        try {
            return listByType('HANGER');
        } catch {
            return [];
        }
    }, []);

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
        p.szablon_id || p.hardwareId || (availableHangers[0]?.id ?? 'TT2')
    );
    const [selectedSetId, setSelectedSetId] = useState<string>(p.zestaw_id || '');
    const [offsetSide, setOffsetSide] = useState<string | number>(p.odsuniecie_bok_mm ?? 0);
    const [offsetBack, setOffsetBack] = useState<string | number>(p.odsuniecie_tyl_mm ?? 0);
    const [offsetTop, setOffsetTop] = useState<string | number>(p.odsuniecie_gora_mm ?? 0);
    const [userParams, setUserParams] = useState<Record<string, any>>(p.parametry_zestawu || p.paramValues || {});

    // Załaduj definicję wybranego okucia
    const activeDefinition = useMemo(() => {
        const hw = getHardware(selectedTemplateId);
        return (hw as any)?.definition || hw;
    }, [selectedTemplateId]);

    // Dostępne zestawy w wybranym pliku
    const availableSets = useMemo(() => {
        return extractHangerSets(activeDefinition, selectedTemplateId);
    }, [activeDefinition, selectedTemplateId]);

    // Aktywny zestaw
    const activeSet = useMemo(() => {
        return resolveActiveHangerSet(activeDefinition, selectedSetId, selectedTemplateId);
    }, [activeDefinition, selectedSetId, selectedTemplateId]);

    useEffect(() => {
        setSelectedTemplateId(p.szablon_id || p.hardwareId || (availableHangers[0]?.id ?? 'TT2'));
        setSelectedSetId(p.zestaw_id || '');
        setOffsetSide(p.odsuniecie_bok_mm ?? 0);
        setOffsetBack(p.odsuniecie_tyl_mm ?? 0);
        setOffsetTop(p.odsuniecie_gora_mm ?? 0);
        setUserParams(p.parametry_zestawu || p.paramValues || {});
    }, [container?.id]);

    const handleParamChange = (key: string, value: any) => {
        const next = { ...userParams, [key]: value };
        setUserParams(next);
        triggerUpdate({
            parametry_zestawu: next,
            szablon_id: selectedTemplateId,
            zestaw_id: selectedSetId,
        });
    };

    return (
        <div
            className="submodule-box"
            style={{
                background: '#222225',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #2d2d30',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}
        >
            {/* Wybór modelu/szablonu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Model / Szablon:</span>
                <select
                    id="sb-hanger-template-select"
                    value={selectedTemplateId}
                    style={{
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#f4f4f5',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        fontSize: '12px',
                    }}
                    onChange={(e) => {
                        const newTpl = e.target.value;
                        setSelectedTemplateId(newTpl);
                        setSelectedSetId('');
                        triggerUpdate({
                            szablon_id: newTpl,
                            zestaw_id: '',
                        });
                    }}
                >
                    {availableHangers.map((h) => (
                        <option key={h.id} value={h.id}>
                            {h.name || h.id}
                        </option>
                    ))}
                    {!availableHangers.some((h) => h.id === selectedTemplateId) && (
                        <option value={selectedTemplateId}>{selectedTemplateId}</option>
                    )}
                </select>
            </div>

            {/* Wybór zestawu, jeśli plik ma więcej niż 1 zestaw */}
            {availableSets.length > 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Zestaw okuć:</span>
                    <select
                        id="sb-hanger-set-select"
                        value={activeSet?.id || ''}
                        style={{
                            background: '#18181b',
                            border: '1px solid #3f3f46',
                            color: '#38bdf8',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '12px',
                        }}
                        onChange={(e) => {
                            const newSet = e.target.value;
                            setSelectedSetId(newSet);
                            triggerUpdate({
                                zestaw_id: newSet,
                                szablon_id: selectedTemplateId,
                            });
                        }}
                    >
                        {availableSets.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Informacja o zestawie */}
            {activeSet && (
                <div style={{ fontSize: '11px', color: '#9ca3af', padding: '2px 0' }}>
                    Liczba elementów: {activeSet.parts?.length ?? 0} | Otworów: {activeSet.cuts?.length ?? 0}
                </div>
            )}

            {/* Dynamiczne parametry zdefiniowane w aktywnym zestawie (np. zamroz_1) */}
            {activeSet && Array.isArray(activeSet.parameters) && activeSet.parameters.length > 0 && (
                <div style={{ borderTop: '1px solid #2d2d30', paddingTop: '6px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '11px', fontWeight: 600 }}>Opcje zestawu:</span>
                    {activeSet.parameters.map((param: any) => {
                        const val = userParams[param.key] !== undefined ? userParams[param.key] : param.default;
                        if (param.type === 'check') {
                            return (
                                <div key={param.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        type="checkbox"
                                        id={`sb-hanger-param-${param.key}`}
                                        checked={Boolean(val)}
                                        onChange={(e) => handleParamChange(param.key, e.target.checked)}
                                    />
                                    <label htmlFor={`sb-hanger-param-${param.key}`} style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>
                                        {param.label || param.key}
                                    </label>
                                </div>
                            );
                        }
                        if (param.type === 'number') {
                            return (
                                <div key={param.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{param.label || param.key}</span>
                                    <SmartNumericInput
                                        id={`sb-hanger-param-${param.key}`}
                                        value={val ?? param.default_mm ?? 0}
                                        min={param.min_mm ?? 0}
                                        max={param.max_mm ?? 500}
                                        unit="mm"
                                        style={{ width: '80px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                                        onChange={(newVal) => handleParamChange(param.key, Number(newVal))}
                                    />
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            )}

            {/* Korekty odsunięcia montażowego */}
            <div style={{ borderTop: '1px solid #2d2d30', paddingTop: '6px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '11px', fontWeight: 600 }}>Korekta pozycji [mm]:</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Odsunięcie od boku:</span>
                    <SmartNumericInput
                        id="sb-hanger-offset-side"
                        value={offsetSide}
                        min={-50}
                        max={100}
                        unit="mm"
                        style={{ width: '80px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setOffsetSide(val);
                            triggerUpdate({ odsuniecie_bok_mm: Number(val) });
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Odsunięcie od góry:</span>
                    <SmartNumericInput
                        id="sb-hanger-offset-top"
                        value={offsetTop}
                        min={-50}
                        max={100}
                        unit="mm"
                        style={{ width: '80px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setOffsetTop(val);
                            triggerUpdate({ odsuniecie_gora_mm: Number(val) });
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Odsunięcie od tyłu:</span>
                    <SmartNumericInput
                        id="sb-hanger-offset-back"
                        value={offsetBack}
                        min={-50}
                        max={100}
                        unit="mm"
                        style={{ width: '80px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setOffsetBack(val);
                            triggerUpdate({ odsuniecie_tyl_mm: Number(val) });
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
