/**
 * Punkt wejścia podstrony report.html
 *
 * Dane: snapshot z sesji (CAD / JSON). SSOT żyje w ProjectDocument w CAD —
 * „Odśwież” / focus karty ponownie ekstrahuje z CAD.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GlobalReportsEngineWeb } from '../R1_reports/global-reports-engine';
import { HtmlReportsGeneratorWeb } from '../R1_reports/html-reports-generator';
import { ModuleSourceBar } from './module-data/ModuleSourceBar';
import {
    readModuleSession,
    writeModuleSession,
    requestModuleRefresh,
    MODULE_SESSION_KEYS,
    MODULE_SESSION_UPDATED_MSG,
    CAD_BRIDGE_CHANNEL,
    installModulePageLifecycle,
} from './module-data/session';
import type { ReportModulePayload } from './module-data/types';

installModulePageLifecycle('report');

function buildReportHtml(payload: ReportModulePayload): string {
    const engine = new GlobalReportsEngineWeb();
    const generator = new HtmlReportsGeneratorWeb(engine);
    const pricedPanels = payload.panels.map((p) => engine.calculatePartPricing(p));
    const pricedAccessories = (payload.accessories || []).map((a) =>
        engine.calculateAccessoryPricing(a)
    );
    const summary = engine.calculateGlobalSummary(pricedPanels, pricedAccessories);
    const title =
        payload.scope?.type === 'PROJECT' || !payload.scope?.name
            ? payload.meta?.originLabel || 'Projekt CAD'
            : `Wycena: ${payload.scope.name}`;
    return generator.generateFullProjectReport(title, summary, pricedPanels, pricedAccessories);
}

function parseReportJson(text: string, fileName: string): ReportModulePayload {
    const data = JSON.parse(text);
    const next: ReportModulePayload = data.panels
        ? {
              meta: {
                  module: 'report',
                  sourceId: 'json',
                  loadedAt: new Date().toISOString(),
                  originLabel: `JSON · ${fileName}`,
              },
              scope: data.scope || { type: 'PROJECT', id: 'ALL', name: fileName },
              panels: data.panels,
              accessories: data.accessories || [],
              furnitures: data.furnitures || [],
              containers: data.containers || [],
          }
        : data;
    if (!next.panels) throw new Error('JSON musi zawierać tablicę panels');
    return next;
}

function ReportStandaloneApp() {
    const [payload, setPayload] = useState<ReportModulePayload | null>(
        () => readModuleSession<ReportModulePayload>('report')
    );
    const [error, setError] = useState<string | null>(
        payload ? null : 'Brak danych. Otwórz raport z drzewa CAD (PPM) albo wczytaj JSON.'
    );
    const [refreshHint, setRefreshHint] = useState<string | null>(null);

    const reloadFromSession = useCallback(() => {
        const next = readModuleSession<ReportModulePayload>('report');
        if (next?.panels) {
            setPayload(next);
            setError(null);
            setRefreshHint(
                next.meta?.loadedAt
                    ? `Odświeżono ${new Date(next.meta.loadedAt).toLocaleTimeString('pl-PL')}`
                    : 'Odświeżono'
            );
        }
    }, []);

    const askCadRefresh = useCallback(() => {
        const scope = payload?.scope;
        if (!scope) {
            setRefreshHint('Brak zakresu — otwórz raport ponownie z CAD.');
            return;
        }
        setRefreshHint('Pobieram z CAD…');
        requestModuleRefresh('report', scope);
        // Awaryjnie: jeśli CAD nie odpowie, storage i tak może dojść; po chwili sprawdź sesję
        window.setTimeout(() => reloadFromSession(), 400);
    }, [payload?.scope, reloadFromSession]);

    // CAD zapisał świeżą sesję (BroadcastChannel) albo inna karta zmieniła localStorage
    useEffect(() => {
        const onStorage = (ev: StorageEvent) => {
            if (ev.key === MODULE_SESSION_KEYS.report && ev.newValue) {
                reloadFromSession();
            }
        };
        window.addEventListener('storage', onStorage);

        let channel: BroadcastChannel | null = null;
        try {
            channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
            channel.onmessage = (ev) => {
                const data = ev.data;
                if (data?.type === MODULE_SESSION_UPDATED_MSG && data.module === 'report') {
                    reloadFromSession();
                }
            };
        } catch { /* ignore */ }

        return () => {
            window.removeEventListener('storage', onStorage);
            try {
                channel?.close();
            } catch { /* ignore */ }
        };
    }, [reloadFromSession]);

    // Powrót na kartę raportu po zmianie w CAD → automatyczne odświeżenie z SSOT
    useEffect(() => {
        const onFocus = () => {
            if (payload?.meta?.sourceId !== 'cad' && payload?.meta?.sourceId !== 'session') return;
            if (!payload?.scope) return;
            requestModuleRefresh('report', payload.scope);
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [payload?.meta?.sourceId, payload?.scope]);

    const html = useMemo(() => {
        if (!payload?.panels) return null;
        try {
            return buildReportHtml(payload);
        } catch {
            return null;
        }
    }, [payload]);

    const handleJson = (text: string, fileName: string) => {
        try {
            const next = parseReportJson(text, fileName);
            writeModuleSession('report', next);
            setPayload(next);
            setError(null);
            setRefreshHint(null);
        } catch (e: any) {
            setError(e?.message || 'Niepoprawny JSON raportu');
        }
    };

    const canRefreshCad =
        !!payload?.scope &&
        (payload.meta?.sourceId === 'cad' || payload.meta?.sourceId === 'session');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ModuleSourceBar
                module="report"
                title="Raport"
                originLabel={payload?.meta.originLabel || payload?.scope.name}
                onLoadJson={handleJson}
                onRefreshFromCad={canRefreshCad ? askCadRefresh : undefined}
                statusHint={refreshHint || undefined}
            />
            {error && !payload && (
                <div style={{ padding: 24, color: '#fbbf24' }}>{error}</div>
            )}
            {payload && !html && (
                <div style={{ padding: 24, color: '#f87171' }}>
                    Nie udało się wygenerować raportu HTML.
                </div>
            )}
            {html && (
                <iframe
                    title="Raport projektu"
                    srcDoc={html}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        width: '100%',
                        border: 'none',
                        background: '#f4f7f9',
                    }}
                />
            )}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('report-root')!).render(
    <React.StrictMode>
        <ReportStandaloneApp />
    </React.StrictMode>
);
