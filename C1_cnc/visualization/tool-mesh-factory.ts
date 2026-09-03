/**
 * SmartPanel Web — CNC Tool Mesh Factory
 * 
 * Generuje trójwymiarowe reprezentacje narzędzi obróbczych (Wiertła, Frezy, Piły nutujące)
 * w przestrzeni Babylon.js na podstawie parametrów ze słownika/bazy narzędzi (Tool).
 */

import { Tool } from '../dto/cam-dto.js';

declare const BABYLON: any;

export class CNCToolMeshFactory {
    /**
     * Zwraca kolorystyczne oznaczenie średnicy narzędzia (zgodnie z konwencją C1_cnc / hole_visualizer).
     */
    public static getColorForDiameter(diameterMm: number): any {
        const d = diameterMm / 1000.0; // mm -> m
        const tol = 0.0005;
        if (Math.abs(d - 0.003) <= tol) return new BABYLON.Color3(0.2, 1.0, 0.4);  // 3mm - jasny zielony
        if (Math.abs(d - 0.004) <= tol) return new BABYLON.Color3(0.0, 0.8, 1.0);  // 4mm - cyjan
        if (Math.abs(d - 0.005) <= tol) return new BABYLON.Color3(0.0, 0.6, 1.0);  // 5mm - niebieski
        if (Math.abs(d - 0.006) <= tol) return new BABYLON.Color3(0.4, 0.2, 1.0);  // 6mm - fiolet
        if (Math.abs(d - 0.008) <= tol) return new BABYLON.Color3(1.0, 0.5, 0.0);  // 8mm - pomarańczowy
        if (Math.abs(d - 0.010) <= tol) return new BABYLON.Color3(1.0, 0.2, 0.2);  // 10mm - czerwony
        return new BABYLON.Color3(0.5, 0.7, 1.0);                                  // domyślny błękitny
    }

    /**
     * Tworzy kompozytową siatkę (TransformNode z podpiętymi częściami) reprezentującą aktywne narzędzie.
     */
    public static createToolMesh(tool: Tool, scene: any): any {
        if (!scene) return null;

        const toolNode = new BABYLON.TransformNode(`Tool_Node_${tool.id}_${Math.random()}`, scene);

        if (tool.type === 'groove') {
            // --- PIŁA NUTUJĄCA ---
            const diameter = tool.diameter || 150.0;
            const thickness = tool.parameters?.thickness || 3.0;

            const sawMat = new BABYLON.StandardMaterial(`Saw_Mat_${tool.id}`, scene);
            sawMat.diffuseColor = new BABYLON.Color3(0.85, 0.45, 0.1);
            sawMat.emissiveColor = new BABYLON.Color3(0.3, 0.15, 0.05);
            sawMat.specularColor = new BABYLON.Color3(1, 1, 1);
            sawMat.alpha = 0.9;

            // Dysk tarczy tnącej
            const blade = BABYLON.MeshBuilder.CreateCylinder("Saw_Blade", {
                diameter: diameter,
                height: thickness,
                tessellation: 48
            }, scene);
            blade.material = sawMat;
            blade.rotation.z = Math.PI / 2;
            blade.position.y = diameter / 2;
            blade.parent = toolNode;

            // Kołnierz mocujący (flange)
            const flangeMat = new BABYLON.StandardMaterial(`Flange_Mat_${tool.id}`, scene);
            flangeMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.25);

            const flange = BABYLON.MeshBuilder.CreateCylinder("Saw_Flange", {
                diameter: Math.max(30, diameter * 0.3),
                height: thickness * 2.5,
                tessellation: 24
            }, scene);
            flange.material = flangeMat;
            flange.rotation.z = Math.PI / 2;
            flange.position.y = diameter / 2;
            flange.parent = toolNode;

            // Oś mocowania piły (Arbor)
            const arbor = BABYLON.MeshBuilder.CreateCylinder("Saw_Arbor", {
                diameter: 16,
                height: 50,
                tessellation: 16
            }, scene);
            arbor.material = flangeMat;
            arbor.rotation.z = Math.PI / 2;
            arbor.position.y = diameter / 2;
            arbor.position.x = 25;
            arbor.parent = toolNode;

        } else if (tool.type === 'mill') {
            // --- FREZ PALCOWY / GŁOWICOWY ---
            const diameter = tool.diameter || 8.0;
            const fluteLength = 35.0;
            const holderDiameter = Math.max(25, diameter * 2.2);

            const millColor = this.getColorForDiameter(diameter);
            const millMat = new BABYLON.StandardMaterial(`Mill_Mat_${tool.id}`, scene);
            millMat.diffuseColor = millColor;
            millMat.emissiveColor = millColor.scale(0.3);
            millMat.specularColor = new BABYLON.Color3(1, 1, 1);
            millMat.alpha = 0.9;

            // Część robocza (Ostrza frezu)
            const cutter = BABYLON.MeshBuilder.CreateCylinder("Mill_Cutter", {
                diameter: diameter,
                height: fluteLength,
                tessellation: 24
            }, scene);
            cutter.material = millMat;
            cutter.position.y = fluteLength / 2;
            cutter.parent = toolNode;

            // Oprawka (Holder)
            const holderMat = new BABYLON.StandardMaterial(`Holder_Mat_${tool.id}`, scene);
            holderMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);

            const holder = BABYLON.MeshBuilder.CreateCylinder("Mill_Holder", {
                diameter: holderDiameter,
                height: 35,
                tessellation: 24
            }, scene);
            holder.material = holderMat;
            holder.position.y = fluteLength + 17.5;
            holder.parent = toolNode;

        } else {
            // --- WIERTŁO (DRILL) ---
            const diameter = tool.diameter || 8.0;
            const drillLength = 45.0;
            const tipHeight = Math.min(diameter * 0.5, 6.0);

            const drillColor = this.getColorForDiameter(diameter);
            const drillMat = new BABYLON.StandardMaterial(`Drill_Mat_${tool.id}`, scene);
            drillMat.diffuseColor = drillColor;
            drillMat.emissiveColor = drillColor.scale(0.3);
            drillMat.specularColor = new BABYLON.Color3(1, 1, 1);
            drillMat.alpha = 0.9;

            // Główny walec wiertła
            const body = BABYLON.MeshBuilder.CreateCylinder("Drill_Body", {
                diameter: diameter,
                height: drillLength,
                tessellation: 24
            }, scene);
            body.material = drillMat;
            body.position.y = drillLength / 2 + tipHeight;
            body.parent = toolNode;

            // Stożkowy szpic wiertła
            const tip = BABYLON.MeshBuilder.CreateCylinder("Drill_Tip", {
                diameterTop: 0,
                diameterBottom: diameter,
                height: tipHeight,
                tessellation: 24
            }, scene);
            tip.material = drillMat;
            tip.position.y = tipHeight / 2;
            tip.parent = toolNode;

            // Uchwyt wiertarski
            const holderMat = new BABYLON.StandardMaterial(`Drill_Holder_Mat_${tool.id}`, scene);
            holderMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.3);

            const holder = BABYLON.MeshBuilder.CreateCylinder("Drill_Holder", {
                diameter: Math.max(22, diameter * 2.0),
                height: 30,
                tessellation: 24
            }, scene);
            holder.material = holderMat;
            holder.position.y = drillLength + tipHeight + 15;
            holder.parent = toolNode;
        }

        return toolNode;
    }
}
