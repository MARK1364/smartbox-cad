import React, { useState, useEffect } from 'react';
import { CAMStateStore, CNCProgramState } from '../../core/cam-state-store.js';
import { CNCEngine } from '../../core/cnc-engine.js';
import { CAMSyncService } from '../../core/cam-sync-service.js';
import { Mach3Postprocessor } from '../../postprocessors/mach3-postprocessor.js';
import { FanucPostprocessor } from '../../postprocessors/fanuc-postprocessor.js';
import { BiessePostprocessor } from '../../postprocessors/biesse-postprocessor.js';
import { WoodWOPPostprocessor } from '../../postprocessors/woodwop-postprocessor.js';
import { SCMPostprocessor } from '../../postprocessors/scm-postprocessor.js';

import { checkExportGate, consumeTrialExport } from '../../../src/saas/saas-gate.js';
import { watermarkGCode } from '../../../src/saas/watermark.js';
import { SaaSUpgradeBus } from '../../../src/saas/saas-upgrade-bus.js';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

export const SUPPORTED_POSTPROCESSORS = ['Mach3', 'Fanuc', 'WoodWOP', 'Biesse', 'SCM'] as const;

export function resolvePostprocessor(postprocessorName?: string | null) {
    const raw = (postprocessorName === undefined || postprocessorName === null || String(postprocessorName).trim() === '')
        ? 'Mach3'
        : String(postprocessorName).trim();
    if (raw === 'WoodWOP') return new WoodWOPPostprocessor();
    if (raw === 'SCM') return new SCMPostprocessor();
    if (raw === 'Biesse') return new BiessePostprocessor();
    if (raw === 'Fanuc') return new FanucPostprocessor();
    if (raw === 'Mach3') return new Mach3Postprocessor();
    throw new Error(`[C1_cnc/GCodeTab] Nieobsługiwany postprocesor "${postprocessorName}". Dostępne: ${SUPPORTED_POSTPROCESSORS.join(', ')}.`);
}

export function sanitizeFileName(name: string): string {
    const cleaned = (name || '')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned || 'program';
}

interface GCodeTabProps {
    program: CNCProgramState;
    onUpdateProgram: (updater: (p: CNCProgramState) => CNCProgramState) => void;
}

export const GCodeTab: React.FC<GCodeTabProps> = ({ program, onUpdateProgram }) => {
    const [gcodeText, setGcodeText] = useState<string>('');
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [showPreview, setShowPreview] = useState<boolean>(true);
    useLocale();

    const getExtension = () => {
        if (program.postprocessor === 'WoodWOP') return '.mpr';
        if (program.postprocessor === 'Biesse') return '.cix';
        if (program.postprocessor === 'SCM') return '.xxl';
        return '.nc';
    };

    const getFilename = () => {
        const ext = getExtension();
        const base = sanitizeFileName(program.targetPanelLabel || program.id || 'program');
        return `${base}_${program.postprocessor || 'Mach3'}${ext}`;
    };

    const generateCode = (): string => {
        const engine = CNCEngine.getInstance();
        const store = CAMStateStore.getInstance();
        const features = program.features || [];

        if (features.length === 0) {
            const msg = tx(cncTekst, 'gcode.empty_notice', TX_NS);
            setGcodeText(msg);
            return '';
        }

        const preparedFeatures = features.map(f => {
            const assignedId = f.toolId || program.toolAssignments?.[f.featureId] || null;
            return assignedId && f.toolId !== assignedId ? { ...f, toolId: assignedId } : f;
        });

        // Sprawdź czy są operacje bez przypisanego narzędzia (spójnie z symulacją — bez cichego przypisywania pierwszego frezu)
        const missingToolFeats = preparedFeatures.filter(
            f => !f.toolId || !engine.toolLibrary.getTool(f.toolId)
        );
        if (missingToolFeats.length > 0) {
            const msg = tx(cncTekst, 'warnings.no_tool_code', TX_NS, { n: missingToolFeats.length });
            setGcodeText('');
            setStatusMsg(msg);
            store.setWarningMessage(msg);
            return '';
        }

        store.setWarningMessage(null);

        const dims = engine.getDimensionsMM(program.targetPanel);
        const wcs = CAMSyncService.getInstance().createWcsForPanelAndProgram(program.targetPanel, program);
        engine.wcsManager.copyFrom(wcs);

        const clProgram = engine.camProcessor.buildCLProgram({
            projectName: program.name || tx(cncTekst, 'gcode.default_project_name', TX_NS),
            wcsOrigin: wcs.getOrigin(),
            wcsName: wcs.getWcsName(),
            features: preparedFeatures,
            toolAssignments: program.toolAssignments || {},
            postprocessor: program.postprocessor || 'Mach3',
            strategyId: program.strategyId,
            strategyParams: program.strategyParams,
            workpieceDimensions: dims
        });

        const post = resolvePostprocessor(program.postprocessor);

        const nc = post.generateNcCode(clProgram);
        setGcodeText(nc);
        return nc;
    };

    // Automatyczne generowanie kodu przy wejściu lub zmianie parametrów programu, strategii, narzędzi lub WCS
    useEffect(() => {
        generateCode();
    }, [
        program.id,
        program.name,
        program.projectName,
        program.postprocessor,
        program.features,
        program.toolAssignments,
        program.strategyId,
        program.strategyParams,
        program.wcsName,
        program.cornerIndex,
        program.wcsOffsetX,
        program.wcsOffsetY,
        program.wcsOffsetZ,
        program.wcsRotX,
        program.wcsRotY,
        program.wcsRotZ,
        program.targetPanel
    ]);

    const handlePickDirectory = async () => {
        try {
            if ('showDirectoryPicker' in window) {
                const dirHandle = await (window as any).showDirectoryPicker();
                if (dirHandle && dirHandle.name) {
                    onUpdateProgram(p => ({ ...p, projectPath: dirHandle.name }));
                    setStatusMsg(`Wybrano folder: ${dirHandle.name}`);
                    setTimeout(() => setStatusMsg(''), 3000);
                }
            } else {
                const manualPath = prompt(tx(cncTekst, 'gcode.dir_prompt', TX_NS), program.projectPath || 'C:\\CNC_OUTPUT\\');
                if (manualPath !== null) {
                    onUpdateProgram(p => ({ ...p, projectPath: manualPath }));
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.warn(tx(cncTekst, 'gcode.dir_cancelled', TX_NS), err);
            }
        }
    };

    const handleSaveFile = async () => {
        // Strict: pustkę wykrywamy po danych (lista cech), nie po tekście komunikatu.
        if ((program.features || []).length === 0) {
            generateCode();
            return;
        }

        const gate = checkExportGate();
        if (!gate.allowed) {
            SaaSUpgradeBus.requestUpgrade(tx(cncTekst, 'gcode.title', TX_NS));
            return;
        }

        let content = generateCode();
        if (!content) return;
        if (gate.watermark) {
            content = watermarkGCode(content, program.postprocessor || 'Mach3', gate.watermarkText);
        }
        if (gate.reason === 'trial') consumeTrialExport();

        const filename = getFilename();

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: tx(cncTekst, 'gcode.machine_file', TX_NS, { ext: getExtension() }),
                        accept: { 'text/plain': [getExtension(), '.nc', '.tap', '.txt'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                setStatusMsg(tx(cncTekst, 'gcode.saved', TX_NS, { name: handle.name }));
                setTimeout(() => setStatusMsg(''), 3500);
                return;
            } catch (err: any) {
                if (err?.name === 'AbortError') return;
            }
        }

        // Fallback: pobranie pliku przez przeglądarkę
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setStatusMsg(tx(cncTekst, 'gcode.saved', TX_NS, { name: filename }));
        setTimeout(() => setStatusMsg(''), 3500);
    };

    const handleCopyCode = async () => {
        // Strict: jak wyżej — decyzja po danych, nie po tekście.
        if ((program.features || []).length === 0) return;

        let content = generateCode();
        if (!content) return;

        const gate = checkExportGate();
        if (!gate.allowed) {
            SaaSUpgradeBus.requestUpgrade(tx(cncTekst, 'gcode.title', TX_NS));
            return;
        }
        if (gate.watermark) {
            content = watermarkGCode(content, program.postprocessor || 'Mach3', gate.watermarkText);
        }
        if (gate.reason === 'trial') consumeTrialExport();

        try {
            await navigator.clipboard.writeText(content);
            setStatusMsg(tx(cncTekst, 'gcode.copied', TX_NS));
            setTimeout(() => setStatusMsg(''), 2500);
        } catch (err) {
            console.error(tx(cncTekst, 'gcode.copy_error', TX_NS), err);
        }
    };

    return (
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: '#eeeeee', borderBottom: '1px solid #444', paddingBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{tx(cncTekst, 'gcode.title', TX_NS)}</span>
                <span style={{ fontSize: '10px', color: '#4f80bd', fontWeight: 600 }}>{program.postprocessor || 'Mach3'}</span>
            </div>

            {/* Informacja o parametrach generowania */}
            <div style={{ background: '#2d2d2d', border: '1px solid #111', borderRadius: '3px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa' }}>{tx(cncTekst, 'gcode.postprocessor', TX_NS)}</span>
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>{program.postprocessor || 'Mach3'} ({getExtension()})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa' }}>{tx(cncTekst, 'gcode.output_file', TX_NS)}</span>
                    <span style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '10px' }}>{getFilename()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa' }}>{tx(cncTekst, 'gcode.panel_operations', TX_NS)}</span>
                    <span style={{ color: '#eee' }}>{program.features?.length || 0}</span>
                </div>
            </div>

            {/* Folder / Ścieżka Zapisu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11px', color: '#cccccc' }}>{tx(cncTekst, 'gcode.save_folder', TX_NS)}</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                        type="text"
                        style={{
                            flex: 1,
                            background: '#222',
                            border: '1px solid #111',
                            color: '#eee',
                            padding: '4px 6px',
                            fontSize: '11px',
                            borderRadius: '2px',
                            outline: 'none',
                            fontFamily: 'monospace'
                        }}
                        placeholder={tx(cncTekst, 'gcode.folder_placeholder', TX_NS)}
                        value={program.projectPath || ''}
                        onChange={(e) => onUpdateProgram(p => ({ ...p, projectPath: e.target.value }))}
                    />
                    <button
                        onClick={handlePickDirectory}
                        style={{
                            background: '#444',
                            border: '1px solid #222',
                            borderRadius: '3px',
                            padding: '4px 8px',
                            color: '#eee',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                        }}
                        title={tx(cncTekst, 'gcode.pick_folder_title', TX_NS)}
                    >
                        {tx(cncTekst, 'gcode.pick_folder', TX_NS)}
                    </button>
                </div>
            </div>

            {/* Przyciski Akcji */}
            <div style={{ display: 'flex', gap: '4px' }}>
                <button
                    onClick={handleSaveFile}
                    style={{
                        flex: 1,
                        background: '#16a34a',
                        color: '#fff',
                        border: '1px solid #15803d',
                        borderRadius: '3px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    {tx(cncTekst, 'gcode.save_file', TX_NS, { ext: getExtension() })}
                </button>
                <button
                    onClick={handleCopyCode}
                    style={{
                        background: '#444',
                        border: '1px solid #222',
                        borderRadius: '3px',
                        padding: '6px 8px',
                        color: '#eee',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                    title={tx(cncTekst, 'gcode.copy_code', TX_NS)}
                >
                    📋 Kopiuj
                </button>
            </div>

            {/* Komunikat Statusu */}
            {statusMsg && (
                <div style={{
                    fontSize: '11px',
                    color: '#4ade80',
                    background: '#0f2918',
                    border: '1px solid #166534',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    textAlign: 'center',
                    fontWeight: 500
                }}>
                    {statusMsg}
                </div>
            )}

            {/* Podgląd Kodu Maszynowego */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                <div 
                    onClick={() => setShowPreview(!showPreview)} 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '10px', color: '#aaa' }}
                >
<span>{tx(cncTekst, 'gcode.preview', TX_NS, { n: gcodeText.split('\n').filter(Boolean).length })}</span>
                <span>{showPreview ? `▲ ${tx(cncTekst, 'gcode.hide', TX_NS)}` : `▼ ${tx(cncTekst, 'gcode.show', TX_NS)}`}</span>
                </div>
                {showPreview && (
                    <textarea
                        readOnly
                        value={gcodeText}
                        style={{
                            width: '100%',
                            height: '130px',
                            background: '#1a1a1a',
                            border: '1px solid #111',
                            color: '#86efac',
                            padding: '6px',
                            fontSize: '10px',
                            fontFamily: 'Consolas, Monaco, monospace',
                            borderRadius: '2px',
                            resize: 'vertical',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                )}
            </div>
        </div>
    );
};
