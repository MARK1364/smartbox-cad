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
}

export interface GeneratorParams {
    type?: string;
    zoneCount?: number;
    thickness?: number;
    backOffset?: number;
    [key: string]: any;
}

export class ContainerModel {
    type: string;
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    generatorParams: GeneratorParams | null;

    constructor({ width = 600_000_000, height = 720_000_000, depth = 500_000_000, name = "Korpus" }: ContainerModelOptions = {}) {
        this.type = 'container';
        this.id = 'container_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.name = name;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.generatorParams = null;
    }

    toJSON(): Record<string, any> {
        return {
            type: 'container',
            name: this.name,
            width: this.width,
            height: this.height,
            depth: this.depth,
            generatorParams: this.generatorParams ? { ...this.generatorParams } : null,
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
    }

    static fromJSON(data: any): ContainerModel {
        const container = new ContainerModel({
            width: data?.width,
            height: data?.height,
            depth: data?.depth,
            name: data?.name,
        });
        container.fromJSON(data);
        return container;
    }
}
