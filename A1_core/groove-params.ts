/**
 * Parametry wpustu w mm (UV) — wspólna konwersja bez zależności od A4 mesh builders.
 */

import { nmToMm } from './cad-math/units.js';

export function getGrooveParamsMm(params: any): {
    u: number;
    v: number;
    width: number;
    length: number;
    depth: number;
} {
    if (!params) return { u: 0, v: 0, width: 0, length: 0, depth: 0 };
    return {
        u: params.u !== undefined ? params.u : (params.u_nm !== undefined ? nmToMm(params.u_nm) : 0),
        v: params.v !== undefined ? params.v : (params.v_nm !== undefined ? nmToMm(params.v_nm) : 0),
        width: params.width !== undefined ? params.width : (params.width_nm !== undefined ? nmToMm(params.width_nm) : 0),
        length: params.length !== undefined ? params.length : (params.length_nm !== undefined ? nmToMm(params.length_nm) : 0),
        depth: params.depth !== undefined ? params.depth : (params.depth_nm !== undefined ? nmToMm(params.depth_nm) : 0),
    };
}
