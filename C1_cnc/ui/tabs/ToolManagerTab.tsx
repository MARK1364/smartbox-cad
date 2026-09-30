/**
 * SmartPanel Web — C1_CNC UI ToolManagerTab
 * 
 * Zakładka zarządzania magazynem i biblioteką narzędzi skrawających.
 */

import React, { useState } from 'react';
import { ToolLibrary } from '../../processor/tool-library.js';
import { Tool } from '../../dto/cam-dto.js';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

interface ToolManagerTabProps {
    toolLibrary: ToolLibrary;
    onUpdateLibrary: () => void;
}

export const ToolManagerTab: React.FC<ToolManagerTabProps> = ({ toolLibrary, onUpdateLibrary }) => {
    const [tools, setTools] = useState<Tool[]>(toolLibrary.getAllTools());
    const [selectedToolId, setSelectedToolId] = useState<string>(tools[0]?.id || '');
    useLocale();

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
                <h4 className="font-semibold text-yellow-400">{tx(cncTekst, 'tools.title', TX_NS)}</h4>

                <div>
                    <label className="block text-xs text-gray-400 mb-1">{tx(cncTekst, 'tools.pick_from_store', TX_NS)}</label>
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
                            <span className="text-gray-400">{tx(cncTekst, 'tools.id', TX_NS)}</span>
                            <span className="font-mono text-white">{selectedTool.id}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-800 pb-1">
                            <span className="text-gray-400">{tx(cncTekst, 'tools.diameter', TX_NS)}</span>
                            <span className="font-mono text-green-400">{selectedTool.diameter} mm</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-800 pb-1">
                            <span className="text-gray-400">{tx(cncTekst, 'tools.type', TX_NS)}</span>
                            <span className="font-mono text-blue-400">{selectedTool.type}</span>
                        </div>

                        <div className="pt-2 space-y-2">
                            <label className="block font-medium text-gray-300">{tx(cncTekst, 'tools.cut_params', TX_NS)}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-gray-400 text-xs">{tx(cncTekst, 'tools.feed', TX_NS)}</span>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                        value={selectedTool.parameters.feedRate || 1200}
                                        onChange={(e) => handleParameterChange('feedRate', parseFloat(e.target.value) || 1200)}
                                    />
                                </div>
                                <div>
                                    <span className="text-gray-400 text-xs">{tx(cncTekst, 'tools.rpm', TX_NS)}</span>
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
