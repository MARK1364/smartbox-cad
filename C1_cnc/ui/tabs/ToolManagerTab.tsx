/**
 * SmartPanel Web — C1_CNC UI ToolManagerTab
 * 
 * Zakładka zarządzania magazynem i biblioteką narzędzi skrawających.
 */

import React, { useState } from 'react';
import { ToolLibrary } from '../../processor/tool-library.js';
import { Tool } from '../../dto/cam-dto.js';

interface ToolManagerTabProps {
    toolLibrary: ToolLibrary;
    onUpdateLibrary: () => void;
}

export const ToolManagerTab: React.FC<ToolManagerTabProps> = ({ toolLibrary, onUpdateLibrary }) => {
    const [tools, setTools] = useState<Tool[]>(toolLibrary.getAllTools());
    const [selectedToolId, setSelectedToolId] = useState<string>(tools[0]?.id || '');

    const selectedTool = tools.find(t => t.id === selectedToolId);

    const handleParameterChange = (key: string, val: number) => {
        if (!selectedTool) return;
        selectedTool.parameters[key] = val;
        setTools([...tools]);
        onUpdateLibrary();
    };

    return (
        <div className="cnc-subtab-content p-3 space-y-4 text-sm text-gray-200">
            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
                <h4 className="font-semibold text-yellow-400">Biblioteka Narzędzi CNC</h4>

                <div>
                    <label className="block text-xs text-gray-400 mb-1">Wybierz Narzędzie z Magazynu:</label>
                    <select
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"
                        value={selectedToolId}
                        onChange={(e) => setSelectedToolId(e.target.value)}
                    >
                        {tools.map(t => (
                            <option key={t.id} value={t.id}>
                                [{t.id}] {t.name} — FI {t.diameter}mm ({t.type})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedTool && (
                    <div className="bg-gray-900 p-3 rounded border border-gray-800 space-y-2 text-xs">
                        <div className="flex justify-between border-b border-gray-800 pb-1">
                            <span className="text-gray-400">Identyfikator:</span>
                            <span className="font-mono text-white">{selectedTool.id}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-800 pb-1">
                            <span className="text-gray-400">Średnica (FI):</span>
                            <span className="font-mono text-green-400">{selectedTool.diameter} mm</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-800 pb-1">
                            <span className="text-gray-400">Typ narzędzia:</span>
                            <span className="font-mono text-blue-400">{selectedTool.type}</span>
                        </div>

                        <div className="pt-2 space-y-2">
                            <label className="block font-medium text-gray-300">Parametry Skrawania:</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-gray-400 text-xs">Posuw (F mm/min):</span>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                        value={selectedTool.parameters.feedRate || 1200}
                                        onChange={(e) => handleParameterChange('feedRate', parseFloat(e.target.value) || 1200)}
                                    />
                                </div>
                                <div>
                                    <span className="text-gray-400 text-xs">Obroty (S RPM):</span>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                        value={selectedTool.parameters.spindleRpm || 18000}
                                        onChange={(e) => handleParameterChange('spindleRpm', parseFloat(e.target.value) || 18000)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
