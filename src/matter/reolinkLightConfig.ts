import type { Camera } from '../types/index.js';
import { cameraLooksLikeReolink } from '../motion/providers/reolink/reolinkClient.js';
import { composeNodeLabel } from './nodeLabel.js';

const REOLINK_LIGHT_ID_PREFIX = 'light-';

export function reolinkLightEndpointId(cameraId: string): string {
    return `${REOLINK_LIGHT_ID_PREFIX}${cameraId}`;
}

export function isReolinkLightEndpointId(id: string): boolean {
    return id.startsWith(REOLINK_LIGHT_ID_PREFIX);
}

export function baseCameraIdFromReolinkLightId(id: string): string | null {
    if (!isReolinkLightEndpointId(id)) return null;
    return id.slice(REOLINK_LIGHT_ID_PREFIX.length) || null;
}

export function reolinkLightLabel(camera: Pick<Camera, 'name'>): string {
    return composeNodeLabel(camera.name, ' Light');
}

export function canCameraExposeReolinkLight(camera: Camera): boolean {
    return cameraLooksLikeReolink(camera);
}

export function shouldExposeReolinkLight(camera: Camera): boolean {
    return camera.reolinkLightEnabled === true && canCameraExposeReolinkLight(camera);
}
