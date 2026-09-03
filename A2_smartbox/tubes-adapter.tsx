/**
 * tubes-adapter.tsx — moduł DRĄŻEK (smartbox_tubes)
 * Odpowiednik @@BLENDER/A2_smartbox/tubes_1_addon_v1.py
 *
 * Panel UI (TubesSubModule) + mapowanie parametrów na silnik (buildTubesPlan).
 * Bez nawierceń.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { TubesEngine } from './tubes-engine.js';
import type { ModuleDims } from './base-engine.js';

export function buildTubesPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new TubesEngine();
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        offsetTop: params.offset_top !== undefined ? params.offset_top : (params.offsetTop !== undefined ? params.offsetTop : 70),
        showShelf: params.show_shelf !== undefined ? !!params.show_shelf : (params.showShelf !== undefined ? !!params.showShelf : false),
        spaceAboveShelf: params.space_above_shelf !== undefined ? params.space_above_shelf : (params.spaceAboveShelf !== undefined ? params.spaceAboveShelf : 100),
        shelfThickness: params.thickness || 18,
        rodDiameter: params.rod_diameter || 25
    });
}

export function TubesSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    const [offsetTop, setOffsetTop] = useState<string | number>(p.offset_top !== undefined ? p.offset_top : (p.offsetTop !== undefined ? p.offsetTop : 70));
    const [showShelf, setShowShelf] = useState<boolean>(p.show_shelf !== undefined ? !!p.show_shelf : (p.showShelf !== undefined ? !!p.showShelf : false));
    const [spaceAboveShelf, setSpaceAboveShelf] = useState<string | number>(p.space_above_shelf !== undefined ? p.space_above_shelf : (p.spaceAboveShelf !== undefined ? p.spaceAboveShelf : 100));

    useEffect(() => {
        setOffsetTop(p.offset_top !== undefined ? p.offset_top : (p.offsetTop !== undefined ? p.offsetTop : 70));
        setShowShelf(p.show_shelf !== undefined ? !!p.show_shelf : (p.showShelf !== undefined ? !!p.showShelf : false));
        setSpaceAboveShelf(p.space_above_shelf !== undefined ? p.space_above_shelf : (p.spaceAboveShelf !== undefined ? p.spaceAboveShelf : 100));
    }, [container?.id]);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Dystans od góry:</span>
                <SmartNumericInput 
                    value={offsetTop} 
                    min={10} max={300} step={1} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setOffsetTop(val);
                        triggerUpdate({ offset_top: val, offsetTop: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <input 
                    type="checkbox" 
                    id="chkShowTopShelf"
                    checked={showShelf}
                    onChange={(e) => {
                        setShowShelf(e.target.checked);
                        triggerUpdate({ show_shelf: e.target.checked, showShelf: e.target.checked });
                    }}
                />
                <label htmlFor="chkShowTopShelf" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>Półka nad drążkiem</label>
            </div>

            {showShelf && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Luz nad półką:</span>
                    <SmartNumericInput 
                        value={spaceAboveShelf}
                        min={10} max={500} step={1} unit="mm"
                        style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setSpaceAboveShelf(val);
                            triggerUpdate({ space_above_shelf: val, spaceAboveShelf: val });
                        }}
                    />
                </div>
            )}
        </div>
    );
}
