/**
 * machining-intent.ts — wspólny kontrakt intencji obróbki (MACHINING) dla modułów A2_bloki.
 *
 * Cel architektoniczny (spójność z pierwowzorem doors/flaps):
 *   silnik modułu → INTENCJE (czyste obiekty, zero mesh/dokumentu) → writer/command aplikuje cechy.
 *
 * Kinds (pismotraszowo, zamiast rodzin *-drilling-intent.ts):
 *   - 'groove' — wpust/frezowanie (pierwszy klient: LED wewnętrzny)
 *   - 'hole'   — nawiercenie (klienci: doors, flaps; kolejne moduły — hurtowo)
 *   - 'pocket' — kieszeń (rezerwa)
 *
 * UWAGA serializacyjna:
 *   - kształt params groove jest dokładnie zgodny z tym, co dziś piszą silniki LED
 *     (source / channel_id / u / v / width / length / depth);
 *   - kształt params hole jest dokładnie zgodny z tym, co dziś piszą buildery
 *     doors/flaps (u / v / diameter / depth + duplikaty *_mm + flaga własności
 *     isDoorDrilling | isFlapDrilling ustawiane jako params[ownerTag] === true).
 *   Klucze serializacji (flagi, *_mm duplikaty, sourceContainerId, sourcePartId) NIE zmieniają nazw.
 */

export type MachiningKind = 'groove' | 'hole' | 'pocket';

export type MachiningFace =
    | 'FACE_X_PLUS'
    | 'FACE_X_MINUS'
    | 'FACE_Y_PLUS'
    | 'FACE_Y_MINUS'
    | 'FACE_Z_PLUS'
    | 'FACE_Z_MINUS';

/** Oznaczenie systemu-emitera wpustu (CNC: geometry-extractor → purpose 'LED_CHANNEL'). */
export type MachiningGrooveSource = 'BLOKI_LED' | 'assembly_led_channel';

export interface MachiningGrooveParams {
    /** System-emiter (tag CNC, nie nazwa). */
    source: MachiningGrooveSource;
    /** ContainerModel.id modułu-właściciela — klucz dedupe/reremplace przy re-sync. */
    channel_id: string;
    /** Pozycja LEWEGO brzegu rowka na face (u) i dolnego (v) — konwencja NativePanelBuilder. */
    u: number;
    v: number;
    width: number;
    length: number;
    depth: number;
    /** Właściciel modułu Bloki (CADNode.id / ContainerModel.id) — jak nawiercenia (ClearBlokiDrillingsCommand). */
    sourceContainerId?: string;
    /** Flaga „automatu" dla czyszczenia po zmianie/usunięciu modułu Bloki. */
    isLedGroove?: boolean;
}

export interface MachiningGrooveFeature {
    id: string;
    type: 'groove';
    face: MachiningFace;
    name?: string;
    params: MachiningGrooveParams;
}

export type MachiningFeature = MachiningGrooveFeature | MachiningHoleFeature;

// ─────────────────────────────────────────────────────────────────────────────
// HOLE — nawiercenie (doors, flaps; dalej kolejne moduły hurtowo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tag własności nawiercenia w params (klucz serializacji — NIE zmieniać nazwy):
 *   isDoorDrilling — drzwi, isFlapDrilling — klapy (clear/sync/CNC czytają te pola).
 */
export type MachiningHoleOwnerTag =
    | 'isDoorDrilling'
    | 'isFlapDrilling'
    | 'isShelfDrilling'
    | 'isDrawerDrilling'
    | 'isTubeDrilling'
    | 'isHangerDrilling'
    | 'isConnectorDrilling';

export interface MachiningHoleParams {
    template_id?: string;
    /** Pozycja ŚRODKA otworu na face (u/v) — konwencja NativePanelBuilder. */
    u: number;
    v: number;
    /** Duplikaty w mm (klucz serializacji CNC — utrzymywany razem z u/v). */
    u_mm?: number;
    v_mm?: number;
    diameter: number;
    diameter_mm?: number;
    depth: number;
    depth_mm?: number;
    clearance?: number;
    /** Właściciel modułu — tag MachiningHoleOwnerTag (params[ownerTag] === true). */
    isDoorDrilling?: boolean;
    isFlapDrilling?: boolean;
    isShelfDrilling?: boolean;
    isDrawerDrilling?: boolean;
    isTubeDrilling?: boolean;
    isHangerDrilling?: boolean;
    isConnectorDrilling?: boolean;
    /** ContainerModel.id modułu-właściciela (jak grooves). */
    sourceContainerId?: string;
    /** Właściciel części (np. Hinge_L0 / HINGE_TL). */
    sourcePartId?: string;
}

export interface MachiningHoleFeature {
    id: string;
    type: 'hole';
    face: MachiningFace;
    /** Duplikat face (klucz serializacji doors/flaps — utrzymywany razem z face). */
    side?: MachiningFace;
    name?: string;
    params: MachiningHoleParams;
}

export interface MachiningIntent<F extends MachiningFeature = MachiningFeature> {
    /** Formateka-właściciel cechy (CADNode.id). */
    targetNodeId: string;
    feature: F;
}

export interface GrooveMachiningIntentOptions {
    targetNodeId: string;
    /** Pełne id cechy (np. led_groove_<channel_id>_l) — stabilne przy re-sync (idempotencja). */
    id: string;
    source: MachiningGrooveSource;
    /** ContainerModel.id modułu-właściciela (params.channel_id). */
    channelId: string;
    sourceContainerId?: string;
    face?: MachiningFace;
    name?: string;
    u: number;
    v: number;
    width: number;
    length: number;
    depth: number;
}

/**
 * Jedyny punkt produkcji wpustu-machining — gwarantuje identyczny kształt co
 * istniejące silniki LED (bez tego dedupe/CNC przestałyby rozpoznawać stare dane).
 */
export function buildGrooveMachiningIntent(
    opts: GrooveMachiningIntentOptions,
): MachiningIntent<MachiningGrooveFeature> {
    return {
        targetNodeId: opts.targetNodeId,
        feature: {
            id: opts.id,
            type: 'groove',
            face: opts.face || 'FACE_Z_PLUS',
            ...(opts.name ? { name: opts.name } : {}),
            params: {
                source: opts.source,
                channel_id: opts.channelId,
                u: opts.u,
                v: opts.v,
                width: opts.width,
                length: opts.length,
                depth: opts.depth,
                ...(opts.sourceContainerId !== undefined ? { sourceContainerId: opts.sourceContainerId } : {}),
                ...(opts.sourceContainerId !== undefined ? { isLedGroove: true } : {}),
            },
        },
    };
}

/**
 * Predykat własności wpustu dla re-syncu (dedupe): usuwamy KAŻDY automat danego
 * modułu (też zamrożony — obecne silniki LED działały tak samo; zamrożenie
 * 'auto' jest podle netem przy regeneracji parametrów modułu).
 */
export function isOwnedGroove(feature: any, source: MachiningGrooveSource, channelId: string): boolean {
    return feature?.type === 'groove'
        && feature.params?.source === source
        && feature.params?.channel_id === channelId;
}

export interface HoleMachiningIntentOptions {
    targetNodeId: string;
    /** Pełne id cechy (np. hinge_plate_l_0_h) — stabilne przy re-sync (idempotencja). */
    id: string;
    face: MachiningFace;
    /** Duplikat face (doors/flaps piszą side = face). */
    side?: MachiningFace;
    template_id?: string;
    u: number;
    v: number;
    diameter: number;
    depth: number;
    clearance?: number;
    /** Tag własności (params[ownerTag] = true). */
    ownerTag: MachiningHoleOwnerTag;
    sourceContainerId?: string;
    sourcePartId?: string;
}

/**
 * Jedyny punkt produkcji nawiercenia-machining — gwarantuje identyczny kształt co
 * istniejące buildery doors/flaps (duplikaty *_mm, side = face; bez tego clear/sync/CNC
 * przestałyby rozpoznawać stare dane).
 */
export function buildHoleMachiningIntent(
    opts: HoleMachiningIntentOptions,
): MachiningIntent<MachiningHoleFeature> {
    return {
        targetNodeId: opts.targetNodeId,
        feature: {
            id: opts.id,
            type: 'hole',
            face: opts.face,
            ...(opts.side ? { side: opts.side } : {}),
            params: {
                ...(opts.template_id !== undefined ? { template_id: opts.template_id } : {}),
                u: opts.u,
                v: opts.v,
                u_mm: opts.u,
                v_mm: opts.v,
                diameter: opts.diameter,
                diameter_mm: opts.diameter,
                depth: opts.depth,
                depth_mm: opts.depth,
                ...(opts.clearance !== undefined ? { clearance: opts.clearance } : {}),
                [opts.ownerTag]: true,
                ...(opts.sourceContainerId !== undefined ? { sourceContainerId: opts.sourceContainerId } : {}),
                ...(opts.sourcePartId !== undefined ? { sourcePartId: opts.sourcePartId } : {}),
            },
        },
    };
}

/**
 * Predykat własności nawiercenia dla re-syncu (dedupe/clear) — czyta tag
 * params[ownerTag] === true (te same klucze co dzisiejsze buildery).
 */
export function isOwnedHole(feature: any, ownerTag: MachiningHoleOwnerTag): boolean {
    if (ownerTag === 'isHangerDrilling') {
        return Boolean(feature?.params?.isHangerDrilling || feature?.params?.isSmartPartFeature);
    }
    return feature?.type === 'hole' && feature.params?.[ownerTag] === true;
}
