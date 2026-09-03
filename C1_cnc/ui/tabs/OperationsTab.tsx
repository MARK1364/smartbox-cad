/**
 * SmartPanel Web — C1_CNC UI OperationsTab (Pełna wersja z wyborem profilu w 3D i edytorem cech)
 * 
 * Zakładka drzewa operacji technologicznych, selekcji konturu z 3D oraz modala edycji cech.
 */

import React, { useState } from 'react';
import { CNCProgramState } from '../../core/cam-state-store.js';
import { ToolLibrary } from '../../processor/tool-library.js';
import { DrillingStrategy } from '../../strategies/drilling-strategy.js';
import { ProfilingStrategy } from '../../strategies/profiling-strategy.js';
import { PocketingStrategy } from '../../strategies/pocketing-strategy.js';
import { CAMFeature, ContourFeature, HoleFeature, GrooveFeature } from '../../dto/cam-dto.js';

interface OperationsTabProps {
    program: CNCProgramState;
    toolLibrary: ToolLibrary;
    isSelectingProfile: boolean;
    onToggleSelectingProfile: () => void;
    onUpdateProgram: (updater: (p: CNCProgramState) => CNCProgramState) => void;
    onGenerateCLData: () => void;
}

export const OperationsTab: React.FC<OperationsTabProps> = ({
    program,
    toolLibrary,
    isSelectingProfile,
    onToggleSelectingProfile,
    onUpdateProgram,
    onGenerateCLData
}) => {
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>('profiling_25d');
    const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
    const [tempFeatureEdit, setTempFeatureEdit] = useState<any>(null);

    const tools = toolLibrary.getAllTools();
    const strategies = [new DrillingStrategy(), new ProfilingStrategy(), new PocketingStrategy()];

    const handleToolAssign = (featureId: string, toolId: string) => {
        onUpdateProgram(p => ({
            ...p,
            toolAssignments: { ...p.toolAssignments, [featureId]: toolId },
            features: p.features.map(f => f.featureId === featureId ? { ...f, toolId } : f)
        }));
    };

    const handleOpenEditModal = (idx: number) => {
        const feat = program.features[idx];
        setEditingFeatureIndex(idx);
        setTempFeatureEdit(JSON.parse(JSON.stringify(feat)));
    };

    const handleSaveEditModal = () => {
        if (editingFeatureIndex === null || !tempFeatureEdit) return;
        onUpdateProgram(p => {
            const updated = [...p.features];
            updated[editingFeatureIndex] = tempFeatureEdit;
            return { ...p, features: updated };
        });
        setEditingFeatureIndex(null);
        setTempFeatureEdit(null);
    };

    const handleDeleteFeature = (idx: number) => {
        onUpdateProgram(p => ({
            ...p,
            features: p.features.filter((_, i) => i !== idx)
        }));
    };

    return (
        <div className="cnc-subtab-content p-3 space-y-4 text-sm text-gray-200">
            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-green-400">Drzewo Cech i Strategie CAM</h4>
                    <span className="text-xs bg-gray-900 text-gray-300 px-2 py-0.5 rounded">
                        Liczba Cech: {program.features.length}
                    </span>
                </div>

                {/* Przycisk aktywacji wyboru krawędzi profilu w 3D */}
                <button
                    onClick={onToggleSelectingProfile}
                    className={`w-full py-2 px-3 rounded font-semibold text-xs transition ${isSelectingProfile ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                >
                    {isSelectingProfile ? '✏️ Klikaj Krawędzie w 3D (Budowanie Profilu)...' : '✏️ Zaznacz Profil Krawędzi w 3D'}
                </button>

                {program.features.length === 0 ? (
                    <div className="text-xs text-gray-400 p-3 text-center border border-dashed border-gray-700 rounded">
                        Brak cech na formatce. Dodaj otwory lub zaznacz profil w 3D.
                    </div>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {program.features.map((feat, idx) => {
                            const isHole = 'diameter' in feat;
                            const isGroove = 'startPoint' in feat;
                            const hole = isHole ? (feat as HoleFeature) : null;
                            const count = hole?.holeCount || (hole?.positions ? hole.positions.length : 1);

                            const featType = isHole 
                                ? (count > 1 ? `Wiercenie (${count}x)` : 'Wiercenie') 
                                : (isGroove ? 'Wpust' : 'Kontur');
                            const assignedToolId = feat.toolId || program.toolAssignments[feat.featureId] || '';

                            return (
                                <div key={feat.featureId || idx} className="bg-gray-900 p-2.5 rounded border border-gray-700 text-xs space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-blue-300">
                                            #{idx + 1} [{featType}] {feat.name || feat.featureId}
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleOpenEditModal(idx)}
                                                className="bg-blue-900 hover:bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded text-xs"
                                            >
                                                ✏️ Edytuj
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFeature(idx)}
                                                className="bg-red-900 hover:bg-red-800 text-red-200 px-1.5 py-0.5 rounded text-xs"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="text-gray-400 text-xs">Narzędzie:</span>
                                        <select
                                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white"
                                            value={assignedToolId}
                                            onChange={(e) => handleToolAssign(feat.featureId, e.target.value)}
                                        >
                                            <option value="">-- Wybierz Narzędzie --</option>
                                            {tools.map(t => (
                                                <option key={t.id} value={t.id}>
                                                    [{t.id}] {t.name} (FI {t.diameter}mm)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
                <h4 className="font-semibold text-purple-400">Wybór Strategii Skrawania</h4>
                <select
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                    value={selectedStrategyId}
                    onChange={(e) => setSelectedStrategyId(e.target.value)}
                >
                    {strategies.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>

                <button
                    onClick={onGenerateCLData}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-3 rounded text-xs transition"
                >
                    ⚡ Przelicz Ścieżki CLData dla Strategii
                </button>
            </div>

            {/* Modal edycji właściwości operacji */}
            {editingFeatureIndex !== null && tempFeatureEdit && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 text-white p-4 rounded-lg w-96 space-y-3 shadow-2xl">
                        <h4 className="font-bold text-sm text-blue-400 border-b border-gray-800 pb-2">
                            Edycja Parametrów Cechy #{editingFeatureIndex + 1}
                        </h4>

                        <div className="space-y-2 text-xs">
                            <div>
                                <label className="block text-gray-400 mb-1">Głębokość obróbki (Z mm):</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                    value={tempFeatureEdit.depth || 18}
                                    onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, depth: parseFloat(e.target.value) || 0 })}
                                />
                            </div>

                            {'diameter' in tempFeatureEdit && (
                                <div>
                                    <label className="block text-gray-400 mb-1">Średnica otworu (FI mm):</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                        value={tempFeatureEdit.diameter || 8}
                                        onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, diameter: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            {('points' in tempFeatureEdit || 'startPoint' in tempFeatureEdit) && (
                                <>
                                    <div className="mb-2">
                                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="form-checkbox text-blue-500 bg-gray-800 border-gray-700 rounded"
                                                checked={tempFeatureEdit.reverseDirection || false}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, reverseDirection: e.target.checked })}
                                            />
                                            Odwróć kierunek obróbki
                                        </label>
                                    </div>

                                    {'points' in tempFeatureEdit && (
                                        <div>
                                            <label className="block text-gray-400 mb-1">Kompensacja Frezu (G41 / G42):</label>
                                            <select
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                                                value={tempFeatureEdit.compensation || 'Center'}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, compensation: e.target.value })}
                                            >
                                                <option value="Center">Brak (Środek frezu)</option>
                                                <option value="Left">G41 (Lewa strona konturu)</option>
                                                <option value="Right">G42 (Prawa strona konturu)</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div>
                                            <label className="block text-gray-400 mb-1">Lead-In (mm):</label>
                                            <input
                                                type="number"
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                                value={tempFeatureEdit.leadIn ?? 5}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, leadIn: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Lead-Out (mm):</label>
                                            <input
                                                type="number"
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                                value={tempFeatureEdit.leadOut ?? 5}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, leadOut: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-800">
                            <button
                                onClick={handleSaveEditModal}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-1.5 px-3 rounded text-xs"
                            >
                                Zapisz
                            </button>
                            <button
                                onClick={() => { setEditingFeatureIndex(null); setTempFeatureEdit(null); }}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-1.5 px-3 rounded text-xs"
                            >
                                Anuluj
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
