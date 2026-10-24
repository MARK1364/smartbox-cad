/**
 * SmartPanel Web — Hardware Model
 *
 * Model danych domenowych dla okuć meblowych (NodeType.HARDWARE):
 * podpórki półek, zawiasy, prowadnice, uchwyty, wieszaki, profile LED itp.
 */

import { NodeType } from './cad-node/node-type.js';
import { registerDefaultFactory, registerDefaultHydrator } from './domain-registry.js';

export interface HardwareModelOptions {
    id?: string;
    name?: string;
    role?: string;
    hardwareType?: string;
    hardwareId?: string;
    side?: string;
    loc?: { x: number; y: number; z: number };
    dim?: { x: number; y: number; z: number };
    params?: Record<string, any>;
    custom_properties?: Record<string, any>;
    units?: string;
    art_no?: string;
    price_id?: string;
    visible?: boolean;
    frozen?: boolean;
    [key: string]: any;
}

let _hwIdSeq = 0;

export class HardwareModel {
    type: string;
    id: string;
    name: string;
    role: string;
    nodeType: string;
    hardwareType: string;
    hardwareId?: string;
    side?: string;
    loc?: { x: number; y: number; z: number };
    dim?: { x: number; y: number; z: number };
    params?: Record<string, any>;
    custom_properties?: Record<string, any>;
    units?: string;
    art_no?: string;
    price_id?: string;
    visible: boolean;
    frozen: boolean;
    [key: string]: any;

    constructor(options: HardwareModelOptions = {}) {
        this.type = 'hardware';
        this.id = options.id || `hw_${Date.now()}_${++_hwIdSeq}_${Math.floor(Math.random() * 1_000_000)}`;
        this.name = options.name || 'Okucie';
        this.role = options.role || 'HARDWARE';
        this.nodeType = NodeType.HARDWARE;
        this.hardwareType = options.hardwareType || 'HARDWARE';
        if (options.hardwareId !== undefined) this.hardwareId = options.hardwareId;
        if (options.side !== undefined) this.side = options.side;
        if (options.loc !== undefined) this.loc = { ...options.loc };
        if (options.dim !== undefined) this.dim = { ...options.dim };
        if (options.params !== undefined) this.params = { ...options.params };
        if (options.custom_properties !== undefined) this.custom_properties = { ...options.custom_properties };
        if (options.units !== undefined) this.units = options.units;
        if (options.art_no !== undefined) this.art_no = options.art_no;
        if (options.price_id !== undefined) this.price_id = options.price_id;
        this.visible = options.visible !== false;
        this.frozen = Boolean(options.frozen);

        // Kopiowanie ewentualnych dodatkowych pól niestandardowych
        for (const [key, value] of Object.entries(options)) {
            if (!(key in this)) {
                this[key] = value;
            }
        }
    }

    toJSON(): Record<string, any> {
        const out: Record<string, any> = {
            type: 'hardware',
            id: this.id,
            name: this.name,
            role: this.role,
            nodeType: this.nodeType,
            hardwareType: this.hardwareType,
            visible: this.visible,
            frozen: this.frozen,
        };

        if (this.hardwareId !== undefined) out.hardwareId = this.hardwareId;
        if (this.side !== undefined) out.side = this.side;
        if (this.loc !== undefined) out.loc = { ...this.loc };
        if (this.dim !== undefined) out.dim = { ...this.dim };
        if (this.params !== undefined) out.params = { ...this.params };
        if (this.custom_properties !== undefined) out.custom_properties = { ...this.custom_properties };
        if (this.units !== undefined) out.units = this.units;
        if (this.art_no !== undefined) out.art_no = this.art_no;
        if (this.price_id !== undefined) out.price_id = this.price_id;

        for (const [key, value] of Object.entries(this)) {
            if (key === 'toJSON' || key === 'fromJSON') continue;
            if (!(key in out)) {
                out[key] = value;
            }
        }

        return out;
    }

    fromJSON(data: any): void {
        if (!data) return;
        if (data.id != null) this.id = data.id;
        if (data.name != null) this.name = data.name;
        if (data.role != null) this.role = data.role;
        if (data.hardwareType != null) this.hardwareType = data.hardwareType;
        if (data.hardwareId !== undefined) this.hardwareId = data.hardwareId;
        if (data.side !== undefined) this.side = data.side;
        if (data.loc !== undefined) this.loc = { ...data.loc };
        if (data.dim !== undefined) this.dim = { ...data.dim };
        if (data.params !== undefined) this.params = { ...data.params };
        if (data.custom_properties !== undefined) this.custom_properties = { ...data.custom_properties };
        if (data.units !== undefined) this.units = data.units;
        if (data.art_no !== undefined) this.art_no = data.art_no;
        if (data.price_id !== undefined) this.price_id = data.price_id;
        if (data.visible !== undefined) this.visible = data.visible !== false;
        if (data.frozen !== undefined) this.frozen = Boolean(data.frozen);

        for (const [key, value] of Object.entries(data)) {
            if (key === 'type' || key === 'toJSON' || key === 'fromJSON') continue;
            if (!(key in this)) {
                this[key] = value;
            }
        }
    }

    static fromJSON(data: any): HardwareModel {
        if (data instanceof HardwareModel) {
            return data;
        }
        const model = new HardwareModel({
            id: data?.id,
            name: data?.name,
            role: data?.role,
            hardwareType: data?.hardwareType,
            hardwareId: data?.hardwareId,
            side: data?.side,
            loc: data?.loc,
            dim: data?.dim,
            params: data?.params,
            custom_properties: data?.custom_properties || data?.customProperties,
            units: data?.units,
            art_no: data?.art_no,
            price_id: data?.price_id,
            visible: data?.visible,
            frozen: data?.frozen,
            ...data,
        });
        return model;
    }
}

export function hydrateHardware(raw: any, nodeJson: any): HardwareModel {
    const hw = HardwareModel.fromJSON(raw);
    if (nodeJson?.id) hw.id = nodeJson.id;
    if (nodeJson?.name && !hw.name) hw.name = nodeJson.name;
    return hw;
}

registerDefaultHydrator(NodeType.HARDWARE, hydrateHardware);
registerDefaultFactory(NodeType.HARDWARE, (options) => new HardwareModel(options));
