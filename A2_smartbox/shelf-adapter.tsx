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
import { nmToMm } from '../A1_core/cad-math/units.js';
import type { ModuleDims } from './base-engine.js';

function getContainerHeightMm(container: any): number {
    const raw = container?.generatorParams?.height ?? container?.height ?? 720;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) return 720;
    return num > 10000 ? nmToMm(num) : num;
}

export function buildShelfPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new ShelfEngine();
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness !== undefined ? params.thickness : 18,
        referenceFrom: params.referenceFrom,
        offsetFront: params.offset_front !== undefined ? params.offset_front : (params.shelfOffsetFront !== undefined ? params.shelfOffsetFront : 0),
        offsetBack: params.offset_back !== undefined ? params.offset_back : (params.shelfOffsetBack !== undefined ? params.shelfOffsetBack : 0),
        offsetSide: params.offset_side !== undefined ? params.offset_side : (params.shelfOffsetSide !== undefined ? params.shelfOffsetSide : 0),
        offsetBottom: params.offset_bottom !== undefined ? params.offset_bottom : params.offsetBottom,
        offsetTop: params.offset_top !== undefined ? params.offset_top : params.offsetTop
    });
}

export function ShelfSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    const containerHeight = getContainerHeightMm(container);
    const thickness = p.thickness !== undefined ? Number(p.thickness) : 18;

    const initialReference = p.referenceFrom || (p.offset_top !== undefined && p.offset_bottom === undefined ? 'top' : 'bottom');
    const initBottom = p.offset_bottom !== undefined ? Number(p.offset_bottom) : (p.offsetBottom !== undefined ? Number(p.offsetBottom) : 100);
    const initTop = p.offset_top !== undefined ? Number(p.offset_top) : (p.offsetTop !== undefined ? Number(p.offsetTop) : Math.max(0, Math.round(containerHeight - initBottom - thickness)));

    const [offsetBottom, setOffsetBottom] = useState<string | number>(initBottom);
    const [offsetTop, setOffsetTop] = useState<string | number>(initTop);

    useEffect(() => {
        const curP = container?.generatorParams || {};
        const h = getContainerHeightMm(container);
        const th = curP.thickness !== undefined ? Number(curP.thickness) : 18;
        const ref = curP.referenceFrom || (curP.offset_top !== undefined && curP.offset_bottom === undefined ? 'top' : 'bottom');

        if (ref === 'top' && (curP.offset_top !== undefined || curP.offsetTop !== undefined)) {
            const topVal = Number(curP.offset_top ?? curP.offsetTop ?? 100);
            setOffsetTop(topVal);
            setOffsetBottom(Math.max(0, Math.round(h - topVal - th)));
        } else {
            const btmVal = Number(curP.offset_bottom ?? curP.offsetBottom ?? 100);
            setOffsetBottom(btmVal);
            setOffsetTop(Math.max(0, Math.round(h - btmVal - th)));
        }
    }, [container?.id, container?.height, container?.generatorParams?.height]);

    const handleBottomChange = (val: number) => {
        setOffsetBottom(val);
        const calcTop = Math.max(0, Math.round(containerHeight - val - thickness));
        setOffsetTop(calcTop);
        triggerUpdate({
            referenceFrom: 'bottom',
            offset_bottom: val,
            offsetBottom: val,
            offset_top: calcTop,
            offsetTop: calcTop
        });
    };

    const handleTopChange = (val: number) => {
        setOffsetTop(val);
        const calcBottom = Math.max(0, Math.round(containerHeight - val - thickness));
        setOffsetBottom(calcBottom);
        triggerUpdate({
            referenceFrom: 'top',
            offset_top: val,
            offsetTop: val,
            offset_bottom: calcBottom,
            offsetBottom: calcBottom
        });
    };

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Przestrzeń od dołu:</span>
                <SmartNumericInput 
                    value={offsetBottom} 
                    min={0} step={1} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={handleBottomChange}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Przestrzeń od góry:</span>
                <SmartNumericInput 
                    value={offsetTop} 
                    min={0} step={1} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={handleTopChange}
                />
            </div>
        </div>
    );
}
