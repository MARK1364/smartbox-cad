import React, { useState } from 'react';
import { DxfMetadataSummary } from '../C1_cnc/inputs/dxf-importer';

export interface DxfImportSettings {
    thicknessMm: number;
    drillDepthMm: number;
    workpieceName: string;
}

interface DxfImportModalProps {
    isOpen: boolean;
    fileName: string;
    summary: DxfMetadataSummary;
    onConfirm: (settings: DxfImportSettings) => void;
    onCancel: () => void;
}

const PRESET_THICKNESSES = [
    { label: '3 mm (HDF)', val: 3 },
    { label: '10 mm', val: 10 },
    { label: '12 mm (MDF)', val: 12 },
    { label: '16 mm', val: 16 },
    { label: '18 mm (Std)', val: 18 },
    { label: '28 mm (Blat)', val: 28 },
    { label: '36 mm', val: 36 }
];

export const DxfImportModal: React.FC<DxfImportModalProps> = ({
    isOpen,
    fileName,
    summary,
    onConfirm,
    onCancel
}) => {
    const suggested = summary.suggestedThicknessMm;
    const [thickness, setThickness] = useState<number | ''>(
        suggested != null && suggested > 0 ? suggested : ''
    );
    const [drillDepth, setDrillDepth] = useState<number>(13);
    const [isDrillThrough, setIsDrillThrough] = useState<boolean>(false);
    const [workpieceName, setWorkpieceName] = useState<string>(() => {
        return fileName.replace(/\.dxf$/i, '') || 'Formatka_DXF';
    });
    const [formError, setFormError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        const finalThickness = typeof thickness === 'number' ? thickness : Number(thickness);
        if (!Number.isFinite(finalThickness) || finalThickness <= 0) {
            setFormError('Wybierz grubość płyty (zabronione ciche domyślne 18 mm).');
            return;
        }
        const finalDrillDepth = isDrillThrough
            ? finalThickness
            : Math.max(1, Math.min(finalThickness, Number(drillDepth) || 13));
        setFormError(null);
        onConfirm({
            thicknessMm: finalThickness,
            drillDepthMm: finalDrillDepth,
            workpieceName: workpieceName.trim() || 'Formatka_DXF'
        });
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.72)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    backgroundColor: '#181b21',
                    border: '1px solid #2d3748',
                    borderRadius: 10,
                    width: '90%',
                    maxWidth: 540,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                    color: '#e2e8f0',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #2d3748',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'linear-gradient(to right, #1f2937, #111827)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>📐</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                                Import DXF — Przygotówka CAM
                            </h3>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{fileName}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: 18,
                            cursor: 'pointer',
                            padding: '4px 8px'
                        }}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleConfirm} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Podgląd wykrytych gabarytów 2D */}
                    <div
                        style={{
                            background: '#0f172a',
                            border: '1px solid #1e293b',
                            borderRadius: 8,
                            padding: '12px 16px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 12,
                            textAlign: 'center'
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Szerokość (X)</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>{summary.widthMm} mm</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Wysokość (Y)</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>{summary.heightMm} mm</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Wykryte obróbki</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginTop: 3 }}>
                                {summary.holesCount} otworów {summary.groovesCount > 0 ? `, ${summary.groovesCount} wpustów` : ''}
                            </div>
                        </div>
                    </div>

                    {/* Grubość formatki (Z) */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                                Grubość materiału / płyty (Z):
                            </label>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>
                                {thickness === '' ? '—' : `${thickness} mm`}
                            </span>
                        </div>

                        {/* Presety grubości */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {PRESET_THICKNESSES.map(p => (
                                <button
                                    key={p.val}
                                    type="button"
                                    onClick={() => setThickness(p.val)}
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: 12,
                                        fontWeight: thickness === p.val ? 700 : 500,
                                        backgroundColor: thickness === p.val ? '#7c3aed' : '#1e293b',
                                        color: thickness === p.val ? '#ffffff' : '#cbd5e1',
                                        border: `1px solid ${thickness === p.val ? '#9333ea' : '#334155'}`,
                                        borderRadius: 5,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="number"
                                min={1}
                                max={200}
                                step={0.5}
                                value={thickness}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setThickness(Number.isFinite(v) && v > 0 ? v : '');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: 6,
                                    color: '#ffffff',
                                    fontSize: 14,
                                    outline: 'none'
                                }}
                                required
                            />
                            <span style={{ fontSize: 13, color: '#94a3b8' }}>mm</span>
                        </div>
                        {formError && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>{formError}</div>
                        )}
                    </div>

                    {/* Domyślna głębokość nawiertów */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                                Domyślna głębokość nawiertów:
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isDrillThrough}
                                    onChange={(e) => setIsDrillThrough(e.target.checked)}
                                />
                                <span>Wiercenie na wylot ({thickness === '' ? '…' : `${thickness} mm`})</span>
                            </label>
                        </div>

                        {!isDrillThrough && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    type="number"
                                    min={1}
                                    max={thickness}
                                    step={0.5}
                                    value={drillDepth}
                                    onChange={(e) => setDrillDepth(parseFloat(e.target.value) || 1)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: 6,
                                        color: '#ffffff',
                                        fontSize: 14,
                                        outline: 'none'
                                    }}
                                />
                                <span style={{ fontSize: 13, color: '#94a3b8' }}>mm</span>
                            </div>
                        )}
                    </div>

                    {/* Nazwa formatki */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                            Nazwa formatki w CAM:
                        </label>
                        <input
                            type="text"
                            value={workpieceName}
                            onChange={(e) => setWorkpieceName(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '8px 12px',
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: 6,
                                color: '#ffffff',
                                fontSize: 13,
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Przyciski */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#334155',
                                color: '#e2e8f0',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '8px 20px',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
                            }}
                        >
                            <span>Załaduj formatkę do CAM (3D)</span>
                            <span>→</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
