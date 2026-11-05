/**
 * SmartPanel Web — Container Model
 * 
 * Model danych domenowych dla szafy / korpusu meblowego.
 * Dzieci i transformacje (pozycja, rotacja) są przechowywane w węzłach CADNode.
 */

export interface ContainerModelOptions {
    width?: number;
    height?: number;
    depth?: number;
    name?: string;
    visible?: boolean;
    frozen?: boolean;
}

export interface GeneratorParams {
    type?: string;
    zoneCount?: number;
    thickness?: number;
    backOffset?: number;
    [key: string]: any;
}

let _containerIdSeq = 0;

export class ContainerModel {
    type: string;
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    generatorParams: GeneratorParams | null;
    visible: boolean = true;
    frozen: boolean = false;

    constructor({ width = 600_000_000, height = 720_000_000, depth = 500_000_000, name = "Korpus", visible = true, frozen = false }: ContainerModelOptions = {}) {
        this.type = 'container';
        this.id = 'container_' + Date.now() + '_' + (++_containerIdSeq) + '_' + Math.floor(Math.random() * 1_000_000);
        this.name = name;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.generatorParams = null;
        this.frozen = Boolean(frozen);
        this.visible = this.frozen ? false : (visible !== false);
    }

    toJSON(): Record<string, any> {
        let gp: GeneratorParams | null = null;
        if (this.generatorParams) {
            gp = { ...this.generatorParams };
            if (gp.boundary && gp.detectedBay && gp.detectedBay.boundary) {
                gp.detectedBay = { ...gp.detectedBay };
                delete gp.detectedBay.boundary;
            }
        }
        return {
            type: 'container',
            name: this.name,
            width: this.width,
            height: this.height,
            depth: this.depth,
            generatorParams: gp,
            visible: this.frozen ? false : (this.visible !== false),
            frozen: Boolean(this.frozen),
        };
    }

    fromJSON(data: any): void {
        if (!data) return;
        if (data.name != null) this.name = data.name;
        if (data.width != null) this.width = data.width;
        if (data.height != null) this.height = data.height;
        if (data.depth != null) this.depth = data.depth;
        if (data.generatorParams !== undefined) {
            this.generatorParams = data.generatorParams ? { ...data.generatorParams } : null;
        }
        if (data.frozen !== undefined || data.params?.frozen !== undefined) {
            this.frozen = Boolean(data.frozen || data.params?.frozen);
        }
        if (this.frozen) {
            this.visible = false;
        } else if (data.visible !== undefined) {
            this.visible = data.visible !== false;
        }
    }

    static fromJSON(data: any): ContainerModel {
        const container = new ContainerModel({
            width: data?.width,
            height: data?.height,
            depth: data?.depth,
            name: data?.name,
            visible: data?.visible,
            frozen: data?.frozen,
        });
        container.fromJSON(data);
        return container;
    }
}
