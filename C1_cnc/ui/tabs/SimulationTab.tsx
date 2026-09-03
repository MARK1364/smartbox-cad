/**
 * SmartPanel Web — C1_CNC UI SimulationTab (Pełna wersja z wskaźnikami postępu)
 * 
 * Zakładka symulacji 3D obróbki CNC w czasie rzeczywistym z paskiem postępu % i wskaźnikami operacji.
 */

import React, { useState } from 'react';
import { CNCProgramState } from '../../core/cam-state-store.js';

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
                <h4 className="font-semibold text-blue-400">Symulator 3D Ruchu Narzędzia w Babylon.js</h4>

                <div className="flex items-center justify-between bg-gray-900 p-3 rounded border border-gray-800">
                    <button
                        onClick={handleTogglePlay}
                        className={`py-2 px-5 rounded font-semibold text-xs transition ${isPlaying ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                    >
                        {isPlaying ? '⏸️ Zatrzymaj' : '▶️ Uruchom Symulację 3D'}
                    </button>

                    <div className="text-right">
                        <span className="text-xs text-gray-400 block">Status Operacji:</span>
                        <span className={`text-xs font-bold ${isPlaying ? 'text-green-400 animate-pulse' : 'text-gray-400'}`}>
                            {simStatusText || (isPlaying ? 'TRWA SYMULACJA' : 'GOTOWY')}
                        </span>
                    </div>
                </div>

                {/* Pasek Postępu w % */}
                <div className="space-y-1 bg-gray-900 p-2.5 rounded border border-gray-800 text-xs">
                    <div className="flex justify-between text-gray-400">
                        <span>Postęp Symulacji:</span>
                        <span className="font-mono text-white">
                            {simProgress.total > 0 ? `Operacja ${simProgress.current} z ${simProgress.total}` : '0 / 0'} ({simProgressPercent.toFixed(0)}%)
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
                        <span>Prędkość Odtwarzania:</span>
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
            </div>
        </div>
    );
};
