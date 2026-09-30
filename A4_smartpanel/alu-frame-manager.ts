/**
 * A4_smartpanel — Alu Frame Manager
 * 
 * Zarządza szablonami ramek aluminiowych ze szkłem oraz oblicza wymiary
 * i geometrię poszczególnych profili oraz tafli szkła dla SmartPanelu.
 * 
 * Zgodnie z SSOT jednostek:
 * - Wartości wejściowe i kalkulacje profili/szkła: milimetry (mm).
 * - Przeliczniki z/do nanometrów realizowane przez units.ts.
 */

import templatesJson from './ramka_alu_templates.json';
import { nmToMm } from '../A1_core/cad-math/units.js';

export interface AluProfileConfig {
    width_mm: number;
    depth_mm: number;
    lip_depth_mm: number;
    lip_thickness_mm: number;
    corner_joint: 'miter_45' | 'butt';
    finish: string;
    color: { r: number; g: number; b: number };
}

export interface AluGlassConfig {
    thickness_mm: number;
    type: 'TRANSPARENT' | 'GRAPHITE_ANTISOL' | 'FROSTED' | 'FLUTED';
    name: string;
    color: { r: number; g: number; b: number };
    alpha: number;
    clearance_mm: number;
}

export interface AluFrameTemplate {
    id: string;
    name: string;
    description?: string;
    profile: AluProfileConfig;
    glass: AluGlassConfig;
}

export interface AluFrameComponent {
    id: string;
    type: 'profile_left' | 'profile_right' | 'profile_top' | 'profile_bottom' | 'glass';
    name: string;
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    cutAngle?: string;
    materialName?: string;
    color?: { r: number; g: number; b: number };
    alpha?: number;
}

export class AluFrameManager {
    private static _instance: AluFrameManager;

    static get instance(): AluFrameManager {
        if (!this._instance) {
            this._instance = new AluFrameManager();
        }
        return this._instance;
    }

    getTemplates(): Record<string, AluFrameTemplate> {
        return (templatesJson.templates as unknown as Record<string, AluFrameTemplate>) || {};
    }

    getTemplateList(): AluFrameTemplate[] {
        const t = this.getTemplates();
        return Object.values(t);
    }

    getTemplate(templateId?: string): AluFrameTemplate {
        const templates = this.getTemplates();
        const id = templateId || templatesJson.default_template || 'Z1_BLACK';
        return templates[id] || templates['Z1_BLACK'] || Object.values(templates)[0];
    }

    /**
     * Oblicza listę 5 komponentów ramki (4 profile + tafla szkła) na podstawie
     * gabarytów SmartPanelu (w mm).
     */
    computeComponents(panelWidthMm: number, panelHeightMm: number, panelThicknessMm: number, templateId?: string): AluFrameComponent[] {
        const tpl = this.getTemplate(templateId);
        const p = tpl.profile;
        const g = tpl.glass;

        const W = Math.max(10, panelWidthMm);
        const H = Math.max(10, panelHeightMm);
        const T = p.depth_mm || panelThicknessMm || 20;

        // Wymiary szkła: światło ramki powiększone o felce minus luz montażowy
        const glassOverlap = p.lip_depth_mm;
        const clearance = g.clearance_mm || 1.5;
        const glassW = Math.max(10, Math.round((W - 2 * (p.width_mm - glassOverlap) - 2 * clearance) * 10) / 10);
        const glassH = Math.max(10, Math.round((H - 2 * (p.width_mm - glassOverlap) - 2 * clearance) * 10) / 10);

        return [
            {
                id: 'prof_left',
                type: 'profile_left',
                name: 'Profil lewy',
                lengthMm: H,
                widthMm: p.width_mm,
                thicknessMm: T,
                cutAngle: p.corner_joint === 'miter_45' ? '45° / 45°' : '90° / 90°',
                materialName: tpl.name,
                color: p.color
            },
            {
                id: 'prof_right',
                type: 'profile_right',
                name: 'Profil prawy',
                lengthMm: H,
                widthMm: p.width_mm,
                thicknessMm: T,
                cutAngle: p.corner_joint === 'miter_45' ? '45° / 45°' : '90° / 90°',
                materialName: tpl.name,
                color: p.color
            },
            {
                id: 'prof_top',
                type: 'profile_top',
                name: 'Profil górny',
                lengthMm: W,
                widthMm: p.width_mm,
                thicknessMm: T,
                cutAngle: p.corner_joint === 'miter_45' ? '45° / 45°' : '90° / 90°',
                materialName: tpl.name,
                color: p.color
            },
            {
                id: 'prof_bottom',
                type: 'profile_bottom',
                name: 'Profil dolny',
                lengthMm: W,
                widthMm: p.width_mm,
                thicknessMm: T,
                cutAngle: p.corner_joint === 'miter_45' ? '45° / 45°' : '90° / 90°',
                materialName: tpl.name,
                color: p.color
            },
            {
                id: 'glass',
                type: 'glass',
                name: `Szkło (${g.name})`,
                lengthMm: glassH,
                widthMm: glassW,
                thicknessMm: g.thickness_mm,
                materialName: g.name,
                color: g.color,
                alpha: g.alpha
            }
        ];
    }
}
