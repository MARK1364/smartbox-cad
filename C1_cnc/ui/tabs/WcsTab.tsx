/**
 * SmartPanel Web — C1_CNC UI WcsTab (Pełna wersja z wyborem w 3D i korektą offsetów)
 * 
 * Zakładka wyboru i edycji Bazy Obróbczej WCS (G54/G55), klikania naroża w 3D oraz manualnych offsetów.
 */

import React, { useState } from 'react';
import { CNCProgramState } from '../../core/cam-state-store.js';

interface WcsTabProps {
    program: CNCProgramState;
    panelDimensions: { width: number; height: number; thickness: number };
    isPickingWcsCorner: boolean;
    onTogglePickingWcsCorner: () => void;
    onUpdateProgram: (updater: (p: CNCProgramState) => CNCProgramState) => void;
    onViewNormal: () => void;
    onToggleIsolation: () => void;
}

export const WcsTab: React.FC<WcsTabProps> = ({
    program,
    panelDimensions,
    isPickingWcsCorner,
    onTogglePickingWcsCorner,
    onUpdateProgram,
    onViewNormal,
    onToggleIsolation
}) => {
    const [showOffsetsEdit, setShowOffsetsEdit] = useState<boolean>(false);

    return (
        <div className="cnc-subtab-content p-3 space-y-4 text-sm text-gray-200">
            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-blue-400">Baza Obróbcza WCS</h4>
                    <span className="bg-blue-900 text-blue-200 text-xs px-2 py-0.5 rounded font-mono">{program.wcsName}</span>
                </div>

                <div>
                    <label className="block text-xs text-gray-400 mb-1">Układ Współrzędnych (WCS):</label>
                    <select
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                        value={program.wcsName}
                        onChange={(e) => onUpdateProgram(p => ({ ...p, wcsName: e.target.value }))}
                    >
                        <option value="G54">G54 (Baza Główna 1)</option>
                        <option value="G55">G55 (Baza Domyślna 2)</option>
                        <option value="G56">G56 (Baza 3)</option>
                        <option value="G57">G57 (Baza 4)</option>
                    </select>
                </div>


                <button
                    onClick={onTogglePickingWcsCorner}
                    className={`w-full py-2 px-3 rounded font-semibold text-xs transition ${isPickingWcsCorner ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                >
                    {isPickingWcsCorner ? '🎯 Kliknij Naroże na obiekcie 3D...' : '🎯 Wybierz Naroże w Widoku 3D'}
                </button>
            </div>

            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-300 text-xs">Wymiary Formatki</h4>
                    <button
                        onClick={() => setShowOffsetsEdit(!showOffsetsEdit)}
                        className="text-xs text-blue-400 hover:underline"
                    >
                        {showOffsetsEdit ? 'Ukryj Korekty' : '⚙️ Ręczna Korekta Offsetu'}
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <div className="text-gray-400">Szerokość (X)</div>
                        <div className="font-mono text-sm text-green-400">{panelDimensions.width} mm</div>
                    </div>
                    <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <div className="text-gray-400">Wysokość (Y)</div>
                        <div className="font-mono text-sm text-green-400">{panelDimensions.height} mm</div>
                    </div>
                    <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <div className="text-gray-400">Grubość (Z)</div>
                        <div className="font-mono text-sm text-green-400">{panelDimensions.thickness} mm</div>
                    </div>
                </div>

                {showOffsetsEdit && (
                    <div className="bg-gray-900 p-2.5 rounded border border-gray-800 space-y-2 text-xs pt-2">
                        <span className="text-gray-300 font-medium block">Ręczne przesunięcie punktu zerowego (mm):</span>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <span className="text-gray-400">X:</span>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white font-mono"
                                    value={program.wcsOffsetX || 0}
                                    onChange={(e) => onUpdateProgram(p => ({ ...p, wcsOffsetX: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div>
                                <span className="text-gray-400">Y:</span>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white font-mono"
                                    value={program.wcsOffsetY || 0}
                                    onChange={(e) => onUpdateProgram(p => ({ ...p, wcsOffsetY: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div>
                                <span className="text-gray-400">Z:</span>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white font-mono"
                                    value={program.wcsOffsetZ || 0}
                                    onChange={(e) => onUpdateProgram(p => ({ ...p, wcsOffsetZ: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                        <span className="text-gray-300 font-medium block pt-2">Ręczna rotacja układu (stopnie):</span>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <span className="text-gray-400">Rot X:</span>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white font-mono"
                                    value={program.wcsRotX || 0}
                                    onChange={(e) => onUpdateProgram(p => ({ ...p, wcsRotX: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div>
                                <span className="text-gray-400">Rot Y:</span>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white font-mono"
                                    value={program.wcsRotY || 0}
                                    onChange={(e) => onUpdateProgram(p => ({ ...p, wcsRotY: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div>
                                <span className="text-gray-400">Rot Z:</span>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white font-mono"
                                    value={program.wcsRotZ || 0}
                                    onChange={(e) => onUpdateProgram(p => ({ ...p, wcsRotZ: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onViewNormal}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-3 rounded text-xs transition"
                >
                    👁️ Widok Prostopadły
                </button>
                <button
                    onClick={onToggleIsolation}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded text-xs transition"
                >
                    🔍 Izolacja 3D
                </button>
            </div>
        </div>
    );
};
