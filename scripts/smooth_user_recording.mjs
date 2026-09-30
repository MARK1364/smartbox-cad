import fs from 'fs';

// Helper generating smooth Cubic Bezier path
function generateSmoothPath(t0, t1, p0, p1, p2, p3, stepMs = 30) {
  const events = [];
  const duration = t1 - t0;
  const steps = Math.max(2, Math.floor(duration / stepMs));

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const tEased = u * u * (3 - 2 * u);
    const omt = 1 - tEased;

    const nx =
      omt * omt * omt * p0.x +
      3 * omt * omt * tEased * p1.x +
      3 * omt * tEased * tEased * p2.x +
      tEased * tEased * tEased * p3.x;

    const ny =
      omt * omt * omt * p0.y +
      3 * omt * omt * tEased * p1.y +
      3 * omt * tEased * tEased * p2.y +
      tEased * tEased * tEased * p3.y;

    const t = Math.round(t0 + u * duration);
    events.push({
      t,
      type: 'mouse_move',
      data: {
        nx: Number(nx.toFixed(4)),
        ny: Number(ny.toFixed(4)),
        x: Math.round(nx * 1920),
        y: Math.round(ny * 1080),
      },
    });
  }

  return events;
}

function generateSmoothCameraOrbit(t0, t1, startCam, endCam, stepMs = 60) {
  const events = [];
  const duration = t1 - t0;
  const steps = Math.max(2, Math.floor(duration / stepMs));

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const tEased = u * u * (3 - 2 * u);
    const t = Math.round(t0 + u * duration);

    const alpha = startCam.alpha + (endCam.alpha - startCam.alpha) * tEased;
    const beta = startCam.beta + (endCam.beta - startCam.beta) * tEased;
    const radius = startCam.radius + (endCam.radius - startCam.radius) * tEased;
    const target = [
      startCam.target[0] + (endCam.target[0] - startCam.target[0]) * tEased,
      startCam.target[1] + (endCam.target[1] - startCam.target[1]) * tEased,
      startCam.target[2] + (endCam.target[2] - startCam.target[2]) * tEased,
    ];

    events.push({
      t,
      type: 'camera',
      data: {
        alpha: Number(alpha.toFixed(4)),
        beta: Number(beta.toFixed(4)),
        radius: Number(radius.toFixed(2)),
        target,
      },
    });
  }

  return events;
}

function buildPristineUserGuidedSession() {
  const events = [];

  // ── 0.0s - Reset sceny & Start Przewodnika ───────────────────────────────
  events.push({
    t: 0,
    type: 'cad_action',
    data: { action: 'reset_scene' },
  });

  events.push({
    t: 50,
    type: 'marker',
    data: {
      title: '1. Moduł Korpusu (SmartFrame)',
      note: 'Wstawienie korpusu 3-strefowego 1000×2200×600 mm (Dół: 500 mm, Środek: 1200 mm, Góra: 500 mm).',
    },
  });

  // Płynny ruch od środka do zakładki SmartFrame (Korpus) na belce (nx: 0.32, ny: 0.035)
  events.push(...generateSmoothPath(
    0, 1100,
    { x: 0.5, y: 0.5 },
    { x: 0.44, y: 0.28 },
    { x: 0.37, y: 0.1 },
    { x: 0.32, y: 0.035 }
  ));

  // Kliknięcie w SmartFrame (Korpus)
  events.push({
    t: 1150,
    type: 'click',
    data: {
      x: 615,
      y: 38,
      nx: 0.32,
      ny: 0.035,
      elementId: 'tab-btn-smartframe',
      selector: '#tab-btn-smartframe, button[data-tab="tab-a3-smartframe"]',
      textContent: 'Korpus',
    },
  });
  events.push({ t: 1180, type: 'tab_switch', data: { tabKey: 'tab-a3-smartframe' } });

  // Ruch do prawego panelu SmartFrame: wybór korpusu 3-strefowego (karta 3 strefy)
  events.push(...generateSmoothPath(
    1200, 2200,
    { x: 0.32, y: 0.035 },
    { x: 0.58, y: 0.12 },
    { x: 0.8, y: 0.15 },
    { x: 0.88, y: 0.22 }
  ));

  events.push({
    t: 2250,
    type: 'click',
    data: {
      x: 1690,
      y: 238,
      nx: 0.88,
      ny: 0.22,
      elementId: 'smartframe-card-zone-3',
      selector: '#smartframe-card-zone-3, .zone-drag-card',
      textContent: '3 Strefy',
    },
  });

  events.push({
    t: 2270,
    type: 'cad_action',
    data: {
      action: 'start_drag_korpus',
      params: { zoneCount: 3, width: 1000, height: 2200, depth: 600, bottomHeight: 500, middleHeight: 1200, backOffset: 3 },
    },
  });

  // Chwycenie korpusu 3-strefowego i płynne przeciągnięcie na scenę 3D (z widocznym 3D ghostem)
  events.push(...generateSmoothPath(
    2300, 3600,
    { x: 0.88, y: 0.22 },
    { x: 0.8, y: 0.35 },
    { x: 0.65, y: 0.48 },
    { x: 0.5, y: 0.52 }
  ));

  // Upuszczenie na scenę 3D -> FIZYCZNE TWORZENIE KORPUSU 3-STREFOWEGO
  events.push({
    t: 3650,
    type: 'click',
    data: {
      x: 960,
      y: 560,
      nx: 0.5,
      ny: 0.52,
      elementId: 'renderCanvas',
      textContent: 'Scena 3D',
    },
  });

  events.push({
    t: 3700,
    type: 'cad_action',
    data: {
      action: 'create_3zone_wardrobe',
    },
  });

  // Kinowa orbita kamery 3D wokół korpusu 3-strefowego
  events.push(...generateSmoothCameraOrbit(
    3800, 5200,
    { alpha: 1.1, beta: 1.2, radius: 2800, target: [0, 1100, 0] },
    { alpha: 1.6, beta: 1.05, radius: 2500, target: [0, 1100, 0] }
  ));

  // ── 2. Moduł Wnętrza Bloki - Dolna sekcja: Szuflady (zmiana 3 -> 2 szt.) ──
  events.push({
    t: 5300,
    type: 'marker',
    data: {
      title: '2. Dolna Sekcja (Bloki) - Szuflady Blum',
      note: 'Wybór dolnej sekcji szafy (500 mm), wstawienie szuflad i zmiana ilości z 3 na 2 sztuki.',
    },
  });

  // Płynny ruch do zakładki Bloki na górnej belce (nx: 0.365, ny: 0.035)
  events.push(...generateSmoothPath(
    5300, 6300,
    { x: 0.5, y: 0.52 },
    { x: 0.46, y: 0.25 },
    { x: 0.4, y: 0.1 },
    { x: 0.365, y: 0.035 }
  ));

  events.push({
    t: 6350,
    type: 'click',
    data: {
      x: 702,
      y: 38,
      nx: 0.365,
      ny: 0.035,
      elementId: 'tab-btn-bloki',
      selector: '#tab-btn-bloki, button[data-tab="tab-a2-bloki"]',
      textContent: 'Bloki',
    },
  });
  events.push({ t: 6380, type: 'tab_switch', data: { tabKey: 'tab-a2-bloki' } });

  // Ruch kursora do dolnej wnęki mebla (Strefa 1 / Dół)
  events.push(...generateSmoothPath(
    6450, 7300,
    { x: 0.365, y: 0.035 },
    { x: 0.44, y: 0.35 },
    { x: 0.48, y: 0.65 },
    { x: 0.5, y: 0.72 }
  ));

  events.push({
    t: 7350,
    type: 'click',
    data: {
      x: 960,
      y: 777,
      nx: 0.5,
      ny: 0.72,
      textContent: 'Dolna strefa szafy (500mm)',
    },
  });

  // Ruch do panelu Bloki: wybór Szuflad i zmiana z 3 na 2 sztuki
  events.push(...generateSmoothPath(
    7450, 8400,
    { x: 0.5, y: 0.72 },
    { x: 0.68, y: 0.45 },
    { x: 0.82, y: 0.28 },
    { x: 0.89, y: 0.22 }
  ));

  events.push({
    t: 8450,
    type: 'click',
    data: {
      x: 1708,
      y: 238,
      nx: 0.89,
      ny: 0.22,
      selector: '.bloki-card-drawers, button',
      textContent: 'Szuflady',
    },
  });

  // Zmiana ilości szuflad z 3 na 2 sztuki
  events.push(...generateSmoothPath(
    8550, 9200,
    { x: 0.89, y: 0.22 },
    { x: 0.89, y: 0.32 },
    { x: 0.89, y: 0.38 },
    { x: 0.89, y: 0.42 }
  ));

  events.push({
    t: 9250,
    type: 'input',
    data: {
      selector: 'input[name="drawerCount"], input[type="number"]',
      value: 2,
    },
  });

  // FIZYCZNE WSTAWIENIE 2 SZUFLAD DO DOLNEJ SEKCJI
  events.push({
    t: 9300,
    type: 'cad_action',
    data: {
      action: 'insert_drawers_bottom',
    },
  });

  // Kamera pochyla się i skupia na wstawionych szufladach
  events.push(...generateSmoothCameraOrbit(
    9350, 10800,
    { alpha: 1.6, beta: 1.05, radius: 2500, target: [0, 1100, 0] },
    { alpha: 1.4, beta: 1.15, radius: 2100, target: [0, 600, 0] }
  ));

  // ── 3. Środkowa Sekcja: Drążek na ubrania (10.9s -> 13.5s) ──────────────────
  events.push({
    t: 10900,
    type: 'marker',
    data: {
      title: '3. Środkowa Sekcja - Drążek na Ubrania',
      note: 'Wybór środkowej strefy szafy (1200 mm) i dodanie owalnego drążka ubraniowego z mocowaniami.',
    },
  });

  // Ruch kursora do środkowej sekcji szafy
  events.push(...generateSmoothPath(
    10900, 11800,
    { x: 0.89, y: 0.42 },
    { x: 0.7, y: 0.4 },
    { x: 0.55, y: 0.42 },
    { x: 0.5, y: 0.45 }
  ));

  events.push({
    t: 11850,
    type: 'click',
    data: {
      x: 960,
      y: 486,
      nx: 0.5,
      ny: 0.45,
      textContent: 'Środkowa strefa szafy (1200mm)',
    },
  });

  // Ruch do panelu Bloki: wybór Drążka (TUBES)
  events.push(...generateSmoothPath(
    11950, 12800,
    { x: 0.5, y: 0.45 },
    { x: 0.68, y: 0.35 },
    { x: 0.8, y: 0.28 },
    { x: 0.89, y: 0.26 }
  ));

  events.push({
    t: 12850,
    type: 'click',
    data: {
      x: 1708,
      y: 280,
      nx: 0.89,
      ny: 0.26,
      selector: '.bloki-card-tubes, button',
      textContent: 'Drążek na ubrania',
    },
  });

  // FIZYCZNE WSTAWIENIE DRĄŻKA DO ŚRODKOWEJ SEKCJI
  events.push({
    t: 12900,
    type: 'cad_action',
    data: {
      action: 'insert_tube_middle',
    },
  });

  // Kamera unosi się ku górze i środkowi
  events.push(...generateSmoothCameraOrbit(
    12950, 14200,
    { alpha: 1.4, beta: 1.15, radius: 2100, target: [0, 600, 0] },
    { alpha: 1.55, beta: 1.0, radius: 2200, target: [0, 1200, 0] }
  ));

  // ── 4. Górna Sekcja: Półka / Pawlacz (1 szt.) (14.3s -> 16.8s) ───────────
  events.push({
    t: 14300,
    type: 'marker',
    data: {
      title: '4. Górna Sekcja - Półka (1 szt.)',
      note: 'Wybór górnej strefy szafy (500 mm), wstawienie półek i ustawienie ilości na 1 sztukę.',
    },
  });

  // Ruch kursora do górnej sekcji szafy
  events.push(...generateSmoothPath(
    14300, 15100,
    { x: 0.89, y: 0.26 },
    { x: 0.72, y: 0.3 },
    { x: 0.58, y: 0.24 },
    { x: 0.5, y: 0.22 }
  ));

  events.push({
    t: 15150,
    type: 'click',
    data: {
      x: 960,
      y: 237,
      nx: 0.5,
      ny: 0.22,
      textContent: 'Górna strefa szafy (500mm)',
    },
  });

  // Ruch do panelu Bloki: wybór Półek i zmiana na 1 sztukę
  events.push(...generateSmoothPath(
    15250, 16000,
    { x: 0.5, y: 0.22 },
    { x: 0.7, y: 0.22 },
    { x: 0.82, y: 0.22 },
    { x: 0.89, y: 0.2 }
  ));

  events.push({
    t: 16050,
    type: 'click',
    data: {
      x: 1708,
      y: 216,
      nx: 0.89,
      ny: 0.2,
      selector: '.bloki-card-shelves, button',
      textContent: 'Półki',
    },
  });

  events.push(...generateSmoothPath(
    16100, 16600,
    { x: 0.89, y: 0.2 },
    { x: 0.89, y: 0.3 },
    { x: 0.89, y: 0.36 },
    { x: 0.89, y: 0.4 }
  ));

  events.push({
    t: 16650,
    type: 'input',
    data: {
      selector: 'input[name="shelfCount"], input[type="number"]',
      value: 1,
    },
  });

  // FIZYCZNE WSTAWIENIE 1 PÓŁKI DO GÓRNEJ SEKCJI
  events.push({
    t: 16700,
    type: 'cad_action',
    data: {
      action: 'insert_shelf_top',
    },
  });

  // ── 5. Drzwi na Sekcję Środkową + Referencja Górna na Górę (16.9s -> 20.0s) ──
  events.push({
    t: 16900,
    type: 'marker',
    data: {
      title: '5. Fronty - Drzwi (Środek + Góra)',
      note: 'Wstawienie drzwi do sekcji środkowej ze zmianą referencji górnej na wieniec górny (drzwi kryją środek i górę szafy).',
    },
  });

  // Ruch kursora z powrotem do sekcji środkowej
  events.push(...generateSmoothPath(
    16900, 17700,
    { x: 0.89, y: 0.4 },
    { x: 0.7, y: 0.38 },
    { x: 0.58, y: 0.42 },
    { x: 0.5, y: 0.45 }
  ));

  events.push({
    t: 17750,
    type: 'click',
    data: {
      x: 960,
      y: 486,
      nx: 0.5,
      ny: 0.45,
      textContent: 'Wybór sekcji środkowej',
    },
  });

  // Ruch do panelu Bloki: wybór Drzwi (DOORS)
  events.push(...generateSmoothPath(
    17850, 18600,
    { x: 0.5, y: 0.45 },
    { x: 0.68, y: 0.32 },
    { x: 0.8, y: 0.25 },
    { x: 0.89, y: 0.22 }
  ));

  events.push({
    t: 18650,
    type: 'click',
    data: {
      x: 1708,
      y: 238,
      nx: 0.89,
      ny: 0.22,
      selector: '.bloki-card-doors, button',
      textContent: 'Drzwi dwuskrzydłowe',
    },
  });

  // Ruch kursora do ustawień referencji pionowych: zmiana referencji górnej
  events.push(...generateSmoothPath(
    18750, 19400,
    { x: 0.89, y: 0.22 },
    { x: 0.89, y: 0.38 },
    { x: 0.89, y: 0.52 },
    { x: 0.89, y: 0.6 }
  ));

  events.push({
    t: 19450,
    type: 'click',
    data: {
      x: 1708,
      y: 648,
      nx: 0.89,
      ny: 0.6,
      selector: 'select[name="refTop"], select',
      textContent: 'Referencja górna: Wieniec Górny (Góra szafy)',
    },
  });

  // FIZYCZNE WSTAWIENIE DRZWI POKRYWAJĄCYCH ŚRODEK I GÓRĘ
  events.push({
    t: 19500,
    type: 'cad_action',
    data: {
      action: 'insert_doors_extended',
    },
  });

  // ── 6. Finałowy kinowy obrót 360 stopni wokół gotowej szafy 3-strefowej ─────
  events.push({
    t: 19600,
    type: 'marker',
    data: {
      title: '6. Gotowa Szafa 3-Strefowa!',
      note: 'Kompletny mebel CAD: szuflady w dolnej sekcji + wysoka szafa z drążkiem i pawlaczem zamknięta frontami!',
    },
  });

  events.push(...generateSmoothCameraOrbit(
    19500, 24000,
    { alpha: 1.55, beta: 1.0, radius: 2200, target: [0, 1100, 0] },
    { alpha: 3.4, beta: 1.15, radius: 2700, target: [0, 1100, 0] }
  ));

  events.push(...generateSmoothPath(
    19500, 23500,
    { x: 0.89, y: 0.6 },
    { x: 0.7, y: 0.55 },
    { x: 0.58, y: 0.5 },
    { x: 0.5, y: 0.5 }
  ));

  events.sort((a, b) => a.t - b.t);

  return {
    id: 'nagranie_szafki_nagranie',
    name: '🎬 Wzorcowy Przewodnik: Szafa 3-strefowa (Wnętrze + Fronty)',
    description: 'Płynna demonstracja: Korpus 3-strefowy -> Szuflady dół (2 szt.) -> Drążek środek -> Półka góra (1 szt.) -> Drzwi środek+góra.',
    createdAt: new Date().toISOString(),
    durationMs: 24000,
    windowSize: { width: 1620, height: 830 },
    events,
  };
}

const session = buildPristineUserGuidedSession();
fs.writeFileSync('nagranie_szafki_nagranie.json', JSON.stringify(session, null, 2), 'utf8');
console.log('Successfully written smoothed nagranie_szafki_nagranie.json with exact coordinates! Events total:', session.events.length);
