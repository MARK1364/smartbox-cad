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

sub('src/dag/DagNodeDetails.tsx', [
  ["import type { DagNode, DagEdge } from '../module-data/types';", "import type { DagNode, DagEdge } from '../module-data/types';\nimport { tx } from '../../T1_tlumaczenia/core.js';\nimport { useLocale } from '../../T1_tlumaczenia/react.js';\nimport type { ModuleTexts } from '../../T1_tlumaczenia/types.js';\nimport srcTekstRaw from '../src_tekst.json';\n\nconst srcTekst = srcTekstRaw as unknown as ModuleTexts;\nconst TX_NS = 'src';"],
  ['<span className="dag-sidebar-title">Inspektor węzła</span>', '<span className="dag-sidebar-title">{tx(srcTekst, "dag.node_inspector", TX_NS)}</span>'],
  ['<p style={{ fontSize: \'0.85rem\' }}>Kliknij dowolny węzeł na grafie, aby podejrzeć jego parametry, relacje i obróbki.</p>', '<p style={{ fontSize: \'0.85rem\' }}>{tx(srcTekst, "dag.click_node", TX_NS)}</p>'],
  ['{node.status?.frozen && <span title="Zamrożony">❄️ Zamrożony</span>}', '{node.status?.frozen && <span title={tx(srcTekst, "dag.frozen", TX_NS)}>{tx(srcTekst, "dag.frozen", TX_NS)}</span>}'],
  ['⚠️ Konflikt więzu kinematycznego', '{tx(srcTekst, "dag.joint_conflict", TX_NS)}'],
  ['Solver nie może spełnić tego wiązania jednocześnie z innymi więzami bryły. Sprawdź sprzeczne płaszczyzny.', '{tx(srcTekst, "dag.joint_conflict_hint", TX_NS)}'],
  ['<div className="dag-card-section-title">Wymiary fizyczne (mm)</div>', '<div className="dag-card-section-title">{tx(srcTekst, "dag.phys_dims", TX_NS)}</div>'],
  ['<span className="dag-prop-key">Szerokość:</span>', '<span className="dag-prop-key">{tx(srcTekst, "dag.width", TX_NS)}</span>'],
  ['<span className="dag-prop-key">Wysokość / Długość:</span>', '<span className="dag-prop-key">{tx(srcTekst, "dag.height_len", TX_NS)}</span>'],
  ['<span className="dag-prop-key">Grubość:</span>', '<span className="dag-prop-key">{tx(srcTekst, "dag.thickness", TX_NS)}</span>'],
  ['<div className="dag-card-section-title">Klasyfikacja CAD</div>', '<div className="dag-card-section-title">{tx(srcTekst, "dag.cad_class", TX_NS)}</div>'],
  ['<span className="dag-prop-key">Rola:</span>', '<span className="dag-prop-key">{tx(srcTekst, "dag.role", TX_NS)}</span>'],
  ['<span className="dag-prop-key">Typ węzła:</span>', '<span className="dag-prop-key">{tx(srcTekst, "dag.node_type", TX_NS)}</span>'],
  ['<span className="dag-prop-key">Błąd resztkowy:</span>', '<span className="dag-prop-key">{tx(srcTekst, "dag.residual", TX_NS)}</span>'],
  ['Szczegóły JSON (Meta)', '{tx(srcTekst, "dag.json_meta", TX_NS)}'],
]);

console.log('dag-details done');
