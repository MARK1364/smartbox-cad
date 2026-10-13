/**
 * SmartPanel Web — C1_CNC UI SimulationTab (Pełna wersja z wskaźnikami postępu)
 * 
 * Zakładka symulacji 3D obróbki CNC w czasie rzeczywistym z paskiem postępu % i wskaźnikami operacji.
 */

import React, { useState } from 'react';
import { CAMStateStore, CNCProgramState } from '../../core/cam-state-store.js';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

interface SimulationTabProps {
    program: CNCProgramState;
    simStatusText: string;
    simProgressPercent: number;
    simProgress: { current: number; total: number };
    onStartSimulation: (speed: number) => void;
    onStopSimulation: () => void;
}

export const SimulationTab: React.FC<SimulationTabProps> = ({
    program,
    simStatusText,
    simProgressPercent,
    simProgress,
    onStartSimulation,
    onStopSimulation
}) => {
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [speed, setSpeed] = useState<number>(1.0);
    useLocale();

    const handleTogglePlay = () => {
        if (isPlaying) {
            onStopSimulation();
            setIsPlaying(false);
        } else {
            onStartSimulation(speed);
            setIsPlaying(true);
        }
    };

    return (
        <div className="cnc-subtab-content p-3 space-y-4 text-sm text-gray-200">
            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
                <h4 className="font-semibold text-blue-400">{tx(cncTekst, 'simulation.title', TX_NS)}</h4>

                <div className="flex items-center justify-between bg-gray-900 p-3 rounded border border-gray-800">
                    <button
                        onClick={handleTogglePlay}
                        className={`py-2 px-5 rounded font-semibold text-xs transition ${isPlaying ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                    >
                        {isPlaying ? tx(cncTekst, 'simulation.stop', TX_NS) : tx(cncTekst, 'simulation.start', TX_NS)}
                    </button>

                    <div className="text-right">
                        <span className="text-xs text-gray-400 block">{tx(cncTekst, 'simulation.op_status', TX_NS)}</span>
                        <span className={`text-xs font-bold ${isPlaying ? 'text-green-400 animate-pulse' : 'text-gray-400'}`}>
                            {simStatusText || (isPlaying ? tx(cncTekst, 'simulation.running', TX_NS) : tx(cncTekst, 'simulation.ready', TX_NS))}
                        </span>
                    </div>
                </div>

                {/* Pasek Postępu w % */}
                <div className="space-y-1 bg-gray-900 p-2.5 rounded border border-gray-800 text-xs">
                    <div className="flex justify-between text-gray-400">
                        <span>{tx(cncTekst, 'simulation.progress', TX_NS)}</span>
                        <span className="font-mono text-white">
                            {simProgress.total > 0 ? tx(cncTekst, 'simulation.op_counter', TX_NS, { c: simProgress.current, t: simProgress.total }) : '0 / 0'} ({simProgressPercent.toFixed(0)}%)
                        </span>
                    </div>

                    <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="bg-blue-500 h-2.5 rounded-full transition-all duration-200"
                            style={{ width: `${Math.min(100, Math.max(0, simProgressPercent))}%` }}
                        />
                    </div>
                </div>

                {/* Suwak Prędkości Symulacji */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>{tx(cncTekst, 'simulation.playback_speed', TX_NS)}</span>
                        <span className="font-mono text-white">{speed.toFixed(1)}x</span>
                    </div>
                    <input
                        type="range"
                        min="0.2"
                        max="5.0"
                        step="0.2"
                        value={speed}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setSpeed(val);
                            if (isPlaying) onStartSimulation(val);
                        }}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Przełącznik Pokazywania Ścieżek Narzędzia */}
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-1">
                    <input
                        type="checkbox"
                        checked={CAMStateStore.getInstance().getState().showToolpaths}
                        onChange={(e) => CAMStateStore.getInstance().setShowToolpaths(e.target.checked)}
                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0 cursor-pointer"
                    />
                    <span>🗺️ {tx(cncTekst, 'simulation.show_toolpaths', TX_NS)}</span>
                </label>
            </div>
        </div>
    );
};
