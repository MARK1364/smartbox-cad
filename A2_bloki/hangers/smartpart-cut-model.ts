/**
 * DomainData węzła FEATURE cięcia SmartPart (walec / kieszeń).
 * Wymaga toJSON() — ProjectDocument.serialize fail-fast bez tego.
 */

export class SmartPartCutModel {
    type = 'smartpart_cut';
    role = 'SMARTPART_CUT';
    id: string;
    name: string;
    cutType: string;
    width: number;
    height: number;
    depth: number;
    generatorParams: Record<string, any>;

    constructor(opts: {
        id: string;
        name: string;
        cutType?: string;
        width?: number;
        height?: number;
        depth?: number;
        generatorParams?: Record<string, any>;
    }) {
        this.id = opts.id;
        this.name = opts.name;
        this.cutType = opts.cutType || 'HOLE';
        this.width = opts.width ?? 0;
        this.height = opts.height ?? 0;
        this.depth = opts.depth ?? 0;
        this.generatorParams = opts.generatorParams ? { ...opts.generatorParams } : { type: 'smartpart_cut' };
    }

    toJSON(): Record<string, any> {
        return {
            type: this.type,
            role: this.role,
            id: this.id,
            name: this.name,
            cutType: this.cutType,
            width: this.width,
            height: this.height,
            depth: this.depth,
            generatorParams: this.generatorParams ? { ...this.generatorParams } : null,
        };
    }

    static fromJSON(data: any): SmartPartCutModel {
        const m = new SmartPartCutModel({
            id: data?.id || '',
            name: data?.name || 'Cut',
            cutType: data?.cutType || data?.generatorParams?.cut?.type || 'HOLE',
            width: data?.width,
            height: data?.height,
            depth: data?.depth,
            generatorParams: data?.generatorParams,
        });
        return m;
    }
}

export function isSmartPartCutDomain(data: any): boolean {
    if (!data) return false;
    return data.role === 'SMARTPART_CUT'
        || data.type === 'smartpart_cut'
        || data.generatorParams?.type === 'smartpart_cut';
}
