import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SessionRecorder } from '../SessionRecorder.js';
import { SessionReplayer } from '../SessionReplayer.js';
import { SAMPLE_CABINET_SESSION } from '../sample-recordings.js';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { ContextManager } from '../../../A1_core/context-manager.js';

describe('SessionRecorder & SessionReplayer', () => {
  let recorder: SessionRecorder;
  let replayer: SessionReplayer;

  beforeEach(() => {
    recorder = SessionRecorder.instance;
    replayer = SessionReplayer.instance;
    replayer.stop();
  });

  it('poprawnie ładuje przykładową sesję do odtwarzacza', () => {
    replayer.loadSession(SAMPLE_CABINET_SESSION);
    expect(replayer.currentSession).not.toBeNull();
    expect(replayer.currentSession?.name).toContain('Przewodnik');
    expect(replayer.currentSession?.events.length).toBeGreaterThan(5);
  });

  it('obsługuje zmianę prędkości odtwarzania', () => {
    replayer.loadSession(SAMPLE_CABINET_SESSION);
    replayer.setSpeed(2);
    expect(replayer.speed).toBe(2);
  });

  it('rejestruje znaczniki i przełączanie zakładek podczas sesji', () => {
    recorder.start('Testowa sesja');
    expect(recorder.isRecording).toBe(true);

    recorder.recordTabSwitch('bloki');
    recorder.addMarker('Krok 1', 'Wybór półki');

    const session = recorder.stop();
    expect(recorder.isRecording).toBe(false);
    expect(session.name).toBe('Testowa sesja');
    expect(session.events.length).toBe(2);

    const tabEv = session.events.find(e => e.type === 'tab_switch');
    expect(tabEv?.data.tabKey).toBe('bloki');

    const markerEv = session.events.find(e => e.type === 'marker');
    expect(markerEv?.data.title).toBe('Krok 1');
  });

  it('zapisuje i odczytuje sesje z pamięci', () => {
    const testSession = {
      id: 'test_rec_123',
      name: 'Sesja Zapisana',
      createdAt: new Date().toISOString(),
      durationMs: 5000,
      windowSize: { width: 1920, height: 1080 },
      events: []
    };

    recorder.saveSession(testSession);
    const all = recorder.getAllSavedSessions();
    const found = all.find(s => s.id === 'test_rec_123');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Sesja Zapisana');

    recorder.deleteSession('test_rec_123');
    const afterDelete = recorder.getAllSavedSessions().find(s => s.id === 'test_rec_123');
    expect(afterDelete).toBeUndefined();
  });

  it('odtwarza sekwencję przeciągnięcia korpusu 3-strefowego oraz wstawienia przegród', () => {
    const doc = new ProjectDocument();
    ContextManager.instance.document = doc;

    const dragSession = {
      id: 'test_korpus_session',
      name: 'Korpus + Przegrody',
      createdAt: new Date().toISOString(),
      durationMs: 2000,
      windowSize: { width: 1920, height: 1080 },
      events: [
        {
          t: 100,
          type: 'drag_start' as const,
          data: { elementId: 'smartframe-card-zone-3', liczba_stref: 3 }
        },
        {
          t: 500,
          type: 'drag_drop' as const,
          data: { x: 500, y: 500, isCanvas: true }
        },
        {
          t: 700,
          type: 'drag_start' as const,
          data: { elementId: 'cardBlokiMod_DIVIDERS', boxType: 'DIVIDERS' }
        },
        {
          t: 1000,
          type: 'drag_drop' as const,
          data: { x: 500, y: 500, isCanvas: true }
        }
      ]
    };

    replayer.loadSession(dragSession as any);
    (replayer as any)._processEventsUpTo(600);

    // Weryfikacja dodania korpusu
    const containers = doc.getContainers();
    expect(containers.length).toBeGreaterThan(0);
    const korpus = containers[0];
    const model = (korpus.domainData || korpus) as any;
    expect(model.generatorParams?.liczba_stref).toBe(3);

    // Odtworzenie wstawienia przegród
    (replayer as any)._processEventsUpTo(1100);
    const containersAfter = doc.getContainers();
    const korpusChildren = korpus.children || [];
    const hasBlokiOrDividers =
      containersAfter.some((c: any) => c.name?.toLowerCase().includes('przegrod') || c.domainData?.generatorParams?.boxType === 'DIVIDERS') ||
      korpusChildren.some((c: any) => c.name?.toLowerCase().includes('przegrod') || c.domainData?.generatorParams?.boxType === 'DIVIDERS');
    expect(hasBlokiOrDividers).toBe(true);
  });

  it('odtwarza rzeczywisty zarejestrowany plik użytkownika nagranie_szafki_nagranie (2).json', () => {
    const jsonPath = path.resolve(process.cwd(), 'nagranie_szafki_nagranie (2).json');
    if (!fs.existsSync(jsonPath)) return;

    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const doc = new ProjectDocument();
    ContextManager.instance.document = doc;

    replayer.loadSession(rawData);
    // Przetworzenie wszystkich zdarzeń z sesji
    (replayer as any)._processEventsUpTo(rawData.durationMs || 20000);

    // Weryfikacja: korpus 3-strefowy został utworzony
    const containers = doc.getContainers();
    expect(containers.length).toBeGreaterThan(0);
    const korpus = containers[0];
    const model = (korpus.domainData || korpus) as any;
    expect(model.generatorParams?.liczba_stref).toBe(3);

    // Weryfikacja: Bloki przegrody zostały wstawione
    const korpusChildren = korpus.children || [];
    const hasBlokiOrDividers =
      containers.some((c: any) => c.name?.toLowerCase().includes('przegrod') || c.domainData?.generatorParams?.boxType === 'DIVIDERS') ||
      korpusChildren.some((c: any) => c.name?.toLowerCase().includes('przegrod') || c.domainData?.generatorParams?.boxType === 'DIVIDERS');
    expect(hasBlokiOrDividers).toBe(true);
  });

  it('odtwarza najnowszy plik sesji użytkownika nagranie_szafki44_nagranie.json', () => {
    const jsonPath = path.resolve(process.cwd(), 'nagranie_szafki44_nagranie.json');
    if (!fs.existsSync(jsonPath)) return;

    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const doc = new ProjectDocument();
    ContextManager.instance.document = doc;

    replayer.loadSession(rawData);
    // Przetworzenie wszystkich zdarzeń ze wskazanego nagrania
    (replayer as any)._processEventsUpTo(rawData.durationMs || 20000);

    // Weryfikacja: korpus 3-strefowy powstał w dokumencie
    const containers = doc.getContainers();
    expect(containers.length).toBeGreaterThan(0);
    const korpus = containers[0];
    const model = (korpus.domainData || korpus) as any;
    expect(model.generatorParams?.liczba_stref).toBe(3);

    // Weryfikacja: podmoduł DIVIDERS / przegrody został poprawnie dodany
    const korpusChildren = korpus.children || [];
    const hasBlokiOrDividers =
      containers.some((c: any) => c.name?.toLowerCase().includes('przegrod') || c.domainData?.generatorParams?.boxType === 'DIVIDERS') ||
      korpusChildren.some((c: any) => c.name?.toLowerCase().includes('przegrod') || c.domainData?.generatorParams?.boxType === 'DIVIDERS');
    expect(hasBlokiOrDividers).toBe(true);
  });
});
