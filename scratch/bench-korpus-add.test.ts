import { describe, it } from 'vitest';
import { ProjectDocument } from '../A1_core/project-document.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { CommandHistory } from '../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../A3_smartframe/commands/create-korpus-command.js';
import { planCabinet } from '../A3_smartframe/smartframe-engine.js';

describe('BENCH dodawanie korpusu', () => {
    it('mierzy czas N-tego korpusu', () => {
        const doc = new ProjectDocument();
        (ContextManager.instance as any).document = doc;
        (ContextManager.instance as any).commandHistory = new CommandHistory(doc);
        // minimalny stub żeby adapter nie wywalał się na panelViews
        (ContextManager.instance as any).panelViews = new Map();
        (ContextManager.instance as any).containerViews = new Map();
        (ContextManager.instance as any).hardwareViews = new Map();

        const N = 15;
        const times: number[] = [];

        // rozgrzewka - 1 plan żeby załadować JSONy
        planCabinet({ szerokosc_mm: 600, wysokosc_mm: 720, glebokosc_mm: 560, liczba_stref: 1 } as any);

        for (let i = 0; i < N; i++) {
            const cmd = new CreateKorpusCommand({
                szerokosc_mm: 600,
                wysokosc_mm: 720,
                glebokosc_mm: 560,
                liczba_stref: 1,
                wysokosc_strefy_dolnej_mm: 720,
                wysokosc_strefy_srodkowej_mm: 0,
                cofniecie_plecow_mm: 3,
                position: { x: i * 700, y: 0, z: 0 },
                typ_korpusu: 'korpus3',
            } as any);
            const t0 = performance.now();
            cmd.execute(doc);
            const t1 = performance.now();
            times.push(t1 - t0);
            const panels = doc.getPanels().length;
            const nodes = (doc as any)._nodeIndex?.size ?? -1;
            console.log(`korpus #${i + 1}: ${(t1 - t0).toFixed(1)}ms | panele=${panels} nodes=${nodes}`);
        }

        const first = times.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const last = times.slice(-3).reduce((a, b) => a + b, 0) / 3;
        console.log(`BENCH-WYNIK first3_avg=${first.toFixed(1)}ms last3_avg=${last.toFixed(1)}ms ratio=${(last / Math.max(first, 0.01)).toFixed(2)}x`);

        // dodatkowo: sam planCabinet bez dokumentu (czysty silnik)
        const p0 = performance.now();
        for (let i = 0; i < 20; i++) planCabinet({ szerokosc_mm: 600, wysokosc_mm: 720, glebokosc_mm: 560, liczba_stref: 1 } as any);
        const p1 = performance.now();
        console.log(`BENCH-WYNIK sam planCabinet 20x: ${(p1 - p0).toFixed(1)}ms => ${((p1 - p0) / 20).toFixed(2)}ms/szt`);
    }, 120000);
});
