import React from 'react';
import { tx } from '../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

export interface ViewCubeProps {
  onSetView: (view: string) => void;
}

/** Kostka widoków — belka widokowa / viewport overlay. */
export function ViewCube({ onSetView }: ViewCubeProps) {
  return (
    <div id="view-cube-container" className="view-cube-container">
      <div id="view-cube-wrapper" className="view-cube-wrapper">
        <div className="cube-face face-front" onClick={() => onSetView('front')}>
          {tx(srcTekst, 'app.cube.front', TX_NS)}
        </div>
        <div className="cube-face face-back" onClick={() => onSetView('back')}>
          {tx(srcTekst, 'app.cube.back', TX_NS)}
        </div>
        <div className="cube-face face-left" onClick={() => onSetView('left')}>
          LEWY
        </div>
        <div className="cube-face face-right" onClick={() => onSetView('right')}>
          PRAWY
        </div>
        <div className="cube-face face-top" onClick={() => onSetView('top')}>
          {tx(srcTekst, 'app.cube.top', TX_NS)}
        </div>
        <div className="cube-face face-bottom" onClick={() => onSetView('bottom')}>
          {tx(srcTekst, 'app.cube.bottom', TX_NS)}
        </div>
      </div>
    </div>
  );
}
