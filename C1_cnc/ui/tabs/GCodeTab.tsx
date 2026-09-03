import React, { useState, useEffect } from 'react';
import { CNCProgramState } from '../../core/cam-state-store.js';
import { CNCEngine } from '../../core/cnc-engine.js';
import { Mach3Postprocessor } from '../../postprocessors/mach3-postprocessor.js';
import { FanucPostprocessor } from '../../postprocessors/fanuc-postprocessor.js';
import { BiessePostprocessor } from '../../postprocessors/biesse-postprocessor.js';
import { WoodWOPPostprocessor } from '../../postprocessors/woodwop-postprocessor.js';
import { SCMPostprocessor } from '../../postprocessors/scm-postprocessor.js';

interface GCodeTabProps {
    program: CNCProgramState;
    onUpdateProgram: (updater: (p: CNCProgramState) => CNCProgramState) => void;
}

export const GCodeTab: React.FC<GCodeTabProps> = ({ program, onUpdateProgram }) => {
    const [gcodeText, setGcodeText] = useState<string>('');
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [showPreview, setShowPreview] = useState<boolean>(true);

    const getExtension = () => {
        if (program.postprocessor === 'WoodWOP') return '.mpr';
        if (program.postprocessor === 'Biesse') return '.cix';
        if (program.postprocessor === 'SCM') return '.xxl';
        return '.nc';
    };

    const getFilename = () => {
        const ext = getExtension();
        const base = program.targetPanelName || program.name || 'program';
        return `${base}_${program.postprocessor || 'Mach3'}${ext}`;
    };

    const generateCode = (): string => {
        const engine = CNCEngine.getInstance();
        const features = program.features || [];

        if (features.length === 0) {
            const msg = '(Brak operacji na liście formatki. Kliknij "Wykryj cechy" w zakładce Operacje)';
            setGcodeText(msg);
            return '';
        }

        // Automatyczne dopasowanie narzędzia domyślnego jeśli jeszcze nie wybrano
        const allTools = engine.toolLibrary.getAllTools();
        const defaultTool = allTools[0] || { id: 'tool_1', name: 'Wiertło 5mm', diameter: 5 };
        
        const preparedFeatures = features.map(f => {
            if (!f.toolId) {
                return { ...f, toolId: defaultTool.id };
            }
            return f;
        });

        const dims = engine.getDimensionsMM(program.targetPanel);
        engine.wcsManager.updateForPanelDimensions(dims.width, dims.height, dims.thickness);

        const project = engine.camProcessor.processProject({
            projectName: program.name || 'Program_001',
            wcsOrigin: engine.wcsManager.getOrigin(),
            wcsName: program.wcsName || 'G55',
            features: preparedFeatures,
            toolAssignments: program.toolAssignments || {},
            postprocessor: program.postprocessor || 'Mach3'
        });

        let post: any;
        const postName = program.postprocessor || 'Mach3';
        if (postName === 'WoodWOP') post = new WoodWOPPostprocessor();
        else if (postName === 'SCM') post = new SCMPostprocessor();
        else if (postName === 'Biesse') post = new BiessePostprocessor();
        else if (postName === 'Fanuc') post = new FanucPostprocessor();
        else post = new Mach3Postprocessor();

        const nc = post.generateNcCode(project);
        setGcodeText(nc);
        return nc;
    };

    // Automatyczne generowanie kodu przy wejściu lub zmianie parametrów
    useEffect(() => {
        generateCode();
    }, [program.postprocessor, program.features, program.wcsName, program.targetPanel]);

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
                const manualPath = prompt('Wpisz ścieżkę folderu docelowego:', program.projectPath || 'C:\\CNC_OUTPUT\\');
                if (manualPath !== null) {
                    onUpdateProgram(p => ({ ...p, projectPath: manualPath }));
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.warn('Wybór katalogu anulowany lub nieobsługiwany', err);
            }
        }
    };

    const handleSaveFile = async () => {
        let content = gcodeText;
        if (!content || content.startsWith('(Brak operacji')) {
            content = generateCode();
        }
        if (!content || content.startsWith('(Brak operacji')) return;

        const filename = getFilename();

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: `Plik Maszynowy (${getExtension()})`,
                        accept: { 'text/plain': [getExtension(), '.nc', '.tap', '.txt'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                setStatusMsg(`✓ Zapisano plik: ${handle.name}`);
                setTimeout(() => setStatusMsg(''), 3500);
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') return;
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
        setStatusMsg(`✓ Zapisano plik: ${filename}`);
        setTimeout(() => setStatusMsg(''), 3500);
    };

    const handleCopyCode = async () => {
        if (!gcodeText || gcodeText.startsWith('(Brak operacji')) return;
        try {
            await navigator.clipboard.writeText(gcodeText);
            setStatusMsg('✓ Skopiowano kod do schowka');
            setTimeout(() => setStatusMsg(''), 2500);
        } catch (err) {
            console.error('Błąd kopiowania:', err);
        }
    };

    return (
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: '#eeeeee', borderBottom: '1px solid #444', paddingBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>💾 Generowanie Kodu NC</span>
                <span style={{ fontSize: '10px', color: '#4f80bd', fontWeight: 600 }}>{program.postprocessor || 'Mach3'}</span>
            </div>

            {/* Informacja o parametrach generowania */}
            <div style={{ background: '#2d2d2d', border: '1px solid #111', borderRadius: '3px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa' }}>Postprocesor (Ustawienia):</span>
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>{program.postprocessor || 'Mach3'} ({getExtension()})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa' }}>Plik wyjściowy:</span>
                    <span style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '10px' }}>{getFilename()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa' }}>Operacje formatki:</span>
                    <span style={{ color: '#eee' }}>{program.features?.length || 0} szt.</span>
                </div>
            </div>

            {/* Folder / Ścieżka Zapisu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11px', color: '#cccccc' }}>Folder / Ścieżka Zapisu:</label>
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
                        placeholder="Wpisz lub wybierz folder..."
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
                        title="Wybierz folder docelowy"
                    >
                        📁 Wybierz
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
                    💾 Zapisz Plik ({getExtension()})
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
                    title="Kopiuj kod do schowka"
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
                    <span>📄 Podgląd Kodu ({gcodeText.split('\n').filter(Boolean).length} linii):</span>
                    <span>{showPreview ? '▲ Ukryj' : '▼ Pokaż'}</span>
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
