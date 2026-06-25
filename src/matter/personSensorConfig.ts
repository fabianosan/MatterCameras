import type { Camera } from '../types/index.js';
import { cameraLooksLikeReolink } from '../motion/providers/reolink/reolinkClient.js';
import { resolveProtectTarget } from '../motion/providers/unifi/protectTarget.js';
import { reolinkLightEndpointId, shouldExposeReolinkLight } from './reolinkLightConfig.js';

const PERSON_SENSOR_ID_PREFIX = 'person-';

export function personSensorEndpointId(cameraId: string): string {
    return `${PERSON_SENSOR_ID_PREFIX}${cameraId}`;
}

export function isPersonSensorEndpointId(id: string): boolean {
    return id.startsWith(PERSON_SENSOR_ID_PREFIX);
}

export function baseCameraIdFromPersonSensorId(id: string): string | null {
    if (!isPersonSensorEndpointId(id)) return null;
    return id.slice(PERSON_SENSOR_ID_PREFIX.length) || null;
}

export function personSensorLabel(camera: Pick<Camera, 'name'>): string {
    return `${camera.name} Person Presence`;
}

export function canCameraExposePersonSensor(camera: Camera): boolean {
    return Boolean(resolveProtectTarget(camera) || cameraLooksLikeReolink(camera));
}

export function shouldExposePersonSensor(camera: Camera): boolean {
    return camera.personSensorEnabled === true && canCameraExposePersonSensor(camera);
}

export function buildPersonSensorMotionCamera(camera: Camera): Camera {
    const preferredSource = camera.motionSource === 'unifi-protect' || camera.motionSource === 'reolink-native'
        ? camera.motionSource
        : 'auto';

    return {
        ...camera,
        id: personSensorEndpointId(camera.id),
        name: personSensorLabel(camera),
        motionSource: preferredSource,
        motionObjectType: 'person',
        personSensorEnabled: false,
    };
}

export function expectedBridgedEndpointIds(cameras: Camera[]): Set<string> {
    const ids = new Set<string>();
    for (const camera of cameras) {
        ids.add(camera.id);
        if (shouldExposePersonSensor(camera)) {
            ids.add(personSensorEndpointId(camera.id));
        }
        if (shouldExposeReolinkLight(camera)) {
            ids.add(reolinkLightEndpointId(camera.id));
        }
    }
    return ids;
}

export function countBridgedEndpoints(cameras: Camera[]): number {
    return expectedBridgedEndpointIds(cameras).size;
}