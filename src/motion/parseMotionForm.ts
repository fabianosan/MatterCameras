import type { MotionObjectType, MotionSource } from '../motion/types.js';
import type { Camera } from '../types/index.js';

const MOTION_SOURCES = new Set<MotionSource>([
    'auto',
    'frame-diff',
    'onvif',
    'reolink-native',
    'unifi-protect',
]);

const MOTION_OBJECT_TYPES = new Set<MotionObjectType>([
    'any',
    'person',
]);

export function parseMotionSource(raw: unknown, fallback: MotionSource = 'auto'): MotionSource {
    const value = String(raw ?? '').trim() as MotionSource;
    return MOTION_SOURCES.has(value) ? value : fallback;
}

export function parseMotionObjectType(
    raw: unknown,
    fallback: MotionObjectType = 'any',
): MotionObjectType {
    const value = String(raw ?? '').trim() as MotionObjectType;
    return MOTION_OBJECT_TYPES.has(value) ? value : fallback;
}

export function parseOptionalInt(raw: unknown): number | undefined {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
}

export function parseOptionalBoolean(raw: unknown): boolean | undefined {
    if (raw === true || raw === 'true' || raw === '1' || raw === 1) return true;
    if (raw === false || raw === 'false' || raw === '0' || raw === 0) return false;
    return undefined;
}

export function parseCameraMotionFields(body: Record<string, unknown>): Pick<
    Camera,
    | 'motionSource'
    | 'motionObjectType'
    | 'personSensorEnabled'
    | 'reolinkLightEnabled'
    | 'onvifUrl'
    | 'username'
    | 'password'
    | 'manufacturer'
    | 'model'
    | 'reolinkChannel'
    | 'reolinkHost'
    | 'reolinkHttpPort'
    | 'reolinkUseHttps'
    | 'reolinkRtspPort'
    | 'reolinkProtocol'
    | 'reolinkStream'
    | 'reolinkDeviceUid'
    | 'reolinkIsNvr'
    | 'protectHost'
    | 'protectCameraId'
    | 'addSource'
> {
    const addSourceRaw = String(body.addSource ?? '').trim();
    const addSources = new Set(['manual', 'onvif', 'unifi-protect', 'reolink', 'tapo-sonoff']);
    const reolinkProtocolRaw = String(body.reolinkProtocol ?? '').trim();
    const reolinkProtocols = new Set(['rtsp', 'rtmp', 'flv']);
    const reolinkStreamRaw = String(body.reolinkStream ?? '').trim();
    const reolinkStreams = new Set([
        'main',
        'sub',
        'ext',
        'autotrack_main',
        'autotrack_sub',
        'telephoto_main',
        'telephoto_sub',
    ]);
    return {
        motionSource: parseMotionSource(body.motionSource),
        motionObjectType: parseMotionObjectType(body.motionObjectType),
        personSensorEnabled: parseOptionalBoolean(body.personSensorEnabled ?? body.presenceSensorEnabled),
        reolinkLightEnabled: parseOptionalBoolean(body.reolinkLightEnabled),
        onvifUrl: String(body.onvifUrl ?? '').trim() || undefined,
        username: String(body.username ?? '').trim() || undefined,
        password: String(body.password ?? '').trim() || undefined,
        manufacturer: String(body.manufacturer ?? '').trim() || undefined,
        model: String(body.model ?? '').trim() || undefined,
        reolinkChannel: parseOptionalInt(body.reolinkChannel),
        reolinkHost: String(body.reolinkHost ?? '').trim() || undefined,
        reolinkHttpPort: parseOptionalInt(body.reolinkHttpPort),
        reolinkUseHttps: parseOptionalBoolean(body.reolinkUseHttps),
        reolinkRtspPort: parseOptionalInt(body.reolinkRtspPort),
        reolinkProtocol: reolinkProtocols.has(reolinkProtocolRaw)
            ? reolinkProtocolRaw as Camera['reolinkProtocol']
            : undefined,
        reolinkStream: reolinkStreams.has(reolinkStreamRaw)
            ? reolinkStreamRaw as Camera['reolinkStream']
            : undefined,
        reolinkDeviceUid: String(body.reolinkDeviceUid ?? '').trim() || undefined,
        reolinkIsNvr: parseOptionalBoolean(body.reolinkIsNvr),
        protectHost: String(body.protectHost ?? '').trim() || undefined,
        protectCameraId: String(body.protectCameraId ?? '').trim() || undefined,
        addSource: addSources.has(addSourceRaw) ? addSourceRaw as Camera['addSource'] : undefined,
    };
}

/** Labels for Web UI camera cards. */
export function motionSourceLabel(source?: MotionSource): string {
    switch (source ?? 'frame-diff') {
        case 'auto': return 'Motion: Auto';
        case 'onvif': return 'Motion: ONVIF';
        case 'reolink-native': return 'Motion: Reolink native';
        case 'unifi-protect': return 'Motion: UniFi Protect';
        default: return 'Motion: Frame diff';
    }
}
