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

const HEAD_DAGAPP = `import { DagNodeDetails } from './DagNodeDetails';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';`;

sub('src/dag/DagInspectorApp.tsx', [
  ["import { DagNodeDetails } from './DagNodeDetails';", HEAD_DAGAPP],
  ["<h2 style={{ fontSize: '1.25rem', marginBottom: 12, color: '#f8fafc' }}>Brak elementów w grafie DAG</h2>", "<h2 style={{ fontSize: '1.25rem', marginBottom: 12, color: '#f8fafc' }}>{tx(srcTekst, 'dag.empty_title', TX_NS)}</h2>"],
  ["W scenie nie wykryto obiektów lub sesja nie została przekazana. Upewnij się, że w projekcie znajduje się mebel,", "{tx(srcTekst, 'dag.no_objects', TX_NS)} {tx(srcTekst, 'dag.no_objects_hint', TX_NS)}"],
  ["kliknij prawym przyciskiem myszy (PPM) na drzewie obiektów i wybierz <strong>„Graf powiązań (DAG)”</strong>.", "<strong>{tx(srcTekst, 'dag.empty_hint', TX_NS)}</strong>."],
  ["<span>↻</span> Spróbuj odświeżyć", "<span>{tx(srcTekst, 'dag.refresh', TX_NS)}</span>"],
  ["<span>↩</span> Wróć do edytora CAD", "<span>{tx(srcTekst, 'dag.back_editor', TX_NS)}</span>"],
  ["<span>DAG Inspector</span>", "<span>{tx(srcTekst, 'dag.inspector', TX_NS)}</span>"],
  ["<span>↻</span> Odśwież z CAD", "<span>{tx(srcTekst, 'dag.refresh_cad', TX_NS)}</span>"],
  ["<span>↩</span> Powrót do CAD", "<span>{tx(srcTekst, 'dag.back_cad', TX_NS)}</span>"],
  ["Korpusy", "{tx(srcTekst, 'dag.f_bodies', TX_NS)}"],
  ["Formatki", "{tx(srcTekst, 'dag.f_panels', TX_NS)}"],
  ["Obróbki", "{tx(srcTekst, 'dag.f_features', TX_NS)}"],
  ["Więzy", "{tx(srcTekst, 'dag.f_joints', TX_NS)}"],
  ["Tylko powiązane", "{tx(srcTekst, 'dag.connected_only', TX_NS)}"],
  ["title=\"Pokaż wyłącznie węzły powiązane bezpośrednio z zaznaczonym elementem\"", "title={tx(srcTekst, 'dag.connected_title', TX_NS)}"],
  ["⊞ Zwiń korpusy", "{tx(srcTekst, 'dag.collapse', TX_NS)}"],
  ["title=\"Zwiń wyjścia (formatki) wszystkich korpusów\"", "title={tx(srcTekst, 'dag.collapse_title', TX_NS)}"],
  ["⊟ Rozwiń", "{tx(srcTekst, 'dag.expand', TX_NS)}"],
  ["title=\"Rozwiń wyjścia (formatki) wszystkich korpusów\"", "title={tx(srcTekst, 'dag.expand_title', TX_NS)}"],
]);

console.log('dag-app done');
