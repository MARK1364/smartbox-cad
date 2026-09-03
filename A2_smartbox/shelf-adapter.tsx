/**
 * shelf-adapter.tsx — moduł WIENIEC (smartbox_shelf)
 * Odpowiednik @@BLENDER/A2_smartbox/shelf_1_addon_v1.py
 *
 * Panel UI (ShelfSubModule) + mapowanie parametrów na silnik (buildShelfPlan).
 * Wieniec nie ma nawierceń — machining_library w shelf_3_rules_V1.json jest puste.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { ShelfEngine } from './shelf-engine.js';
import type { ModuleDims } from './base-engine.js';

export function buildShelfPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new ShelfEngine();
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness !== undefined ? params.thickness : 18,
        offsetFront: params.offset_front !== undefined ? params.offset_front : (params.shelfOffsetFront !== undefined ? params.shelfOffsetFront : 0),
        offsetBack: params.offset_back !== undefined ? params.offset_back : (params.shelfOffsetBack !== undefined ? params.shelfOffsetBack : 0),
        offsetSide: params.offset_side !== undefined ? params.offset_side : (params.shelfOffsetSide !== undefined ? params.shelfOffsetSide : 0),
        offsetBottom: params.offset_bottom !== undefined ? params.offset_bottom : (params.offsetBottom !== undefined ? params.offsetBottom : 0)
    });
}

export function ShelfSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    const [offsetBottom, setOffsetBottom] = useState<string | number>(p.offset_bottom !== undefined ? p.offset_bottom : (p.offsetBottom !== undefined ? p.offsetBottom : 0));

    useEffect(() => {
        setOffsetBottom(p.offset_bottom !== undefined ? p.offset_bottom : (p.offsetBottom !== undefined ? p.offsetBottom : 0));
    }, [container?.id]);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Odległość od dołu:</span>
                <SmartNumericInput 
                    value={offsetBottom} 
                    min={0} step={1} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setOffsetBottom(val);
                        triggerUpdate({ offset_bottom: val, offsetBottom: val });
                    }}
                />
            </div>
        </div>
    );
}
