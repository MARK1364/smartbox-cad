const fs = require('fs');

function sub(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  const fail = [];
  for (const [a, b] of pairs) {
    const n = s.split(a).length - 1;
    if (n < 1) { fail.push('MISS:' + a.slice(0, 55)); continue; }
    s = s.split(a).join(b);
  }
  fs.writeFileSync(file, s);
  console.log(file + ' fail:' + JSON.stringify(fail));
}

const HEAD_DAG = `import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';`;

// ---- DagCanvas.tsx ----
sub('src/dag/DagCanvas.tsx', [
  ["import React, { useState, useRef, useMemo, useEffect } from 'react';", "import React, { useState, useRef, useMemo, useEffect } from 'react';\n" + HEAD_DAG],
  ["label: 'Formatki wolnostojące / Inne',", "label: tx(srcTekst, 'dag.free_panels', TX_NS),"],
  ['title="Przybliż (Ctrl + kółko)"', 'title={tx(srcTekst, "dag.zoom_in_title", TX_NS)}'],
  ['title="Oddal (Ctrl + kółko)"', 'title={tx(srcTekst, "dag.zoom_out_title", TX_NS)}'],
  ['title="Dopasuj cały diagram do ekranu">⛶</button>', 'title={tx(srcTekst, "dag.zoom_fit", TX_NS)}></button>'],
]);

console.log('dag-canvas done');
