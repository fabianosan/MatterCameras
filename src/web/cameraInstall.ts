import { bridge } from '../matter/Bridge.js';
import { storage } from '../storage/db.js';
import { setBridgeEndpointCount } from '../config/version.js';
import type { Camera } from '../types/index.js';
import { countBridgedEndpoints } from '../matter/personSensorConfig.js';
import { canCameraExposeReolinkLight } from '../matter/reolinkLightConfig.js';
import { markBridgeRestartRequired } from '../web/bridgeRestartState.js';

export interface SyncReolinkLightCapabilityOptions {
    /** Re-run the active WhiteLed probe even when a prior result is stored. */
    force?: boolean;
}

export async function syncReolinkLightCapability(
    camera: Camera,
    options: SyncReolinkLightCapabilityOptions = {},
): Promise<Camera> {
    if (!canCameraExposeReolinkLight(camera)) {
        if (camera.reolinkLightEnabled || camera.reolinkLightCapable !== undefined) {
            const cleared = await storage.updateCamera(camera.id, {
                reolinkLightEnabled: false,
                reolinkLightCapable: undefined,
            });
            return cleared ?? { ...camera, reolinkLightEnabled: false, reolinkLightCapable: undefined };
        }
        return camera;
    }

    if (!options.force && camera.reolinkLightCapable !== undefined) {
        if (camera.reolinkLightCapable === false && camera.reolinkLightEnabled) {
            const cleared = await storage.updateCamera(camera.id, { reolinkLightEnabled: false });
            return cleared ?? { ...camera, reolinkLightEnabled: false };
        }
        return camera;
    }

    const capable = await bridge.reolinkLight.probeCapability(camera);
    const updates: Partial<Omit<Camera, 'id'>> = { reolinkLightCapable: capable };
    if (!capable) {
        updates.reolinkLightEnabled = false;
    }

    const unchanged = camera.reolinkLightCapable === capable
        && !(updates.reolinkLightEnabled === false && camera.reolinkLightEnabled);
    if (unchanged) return camera;

    const updated = await storage.updateCamera(camera.id, updates);
    return updated ?? { ...camera, ...updates };
}

export async function installCamera(config: Camera): Promise<Camera> {
    await storage.addCamera(config);
    let camera = storage.getCamera(config.id) ?? config;
    camera = await syncReolinkLightCapability(camera, { force: true });

    setBridgeEndpointCount(countBridgedEndpoints(storage.getCameras()));
    await bridge.addCamera(camera);
    await bridge.go2rtc.addStream(camera.id, camera.name, camera.rtspUrl);
    bridge.startMotionDetection(camera);
    await markBridgeRestartRequired();
    return camera;
}

export async function refreshCameraRuntime(existing: Camera, updated: Camera): Promise<void> {
    const forceReolinkProbe = updated.reolinkChannel !== existing.reolinkChannel
        || updated.reolinkHost !== existing.reolinkHost
        || updated.reolinkHttpPort !== existing.reolinkHttpPort
        || updated.reolinkUseHttps !== existing.reolinkUseHttps
        || updated.username !== existing.username
        || updated.password !== existing.password
        || updated.rtspUrl !== existing.rtspUrl
        || updated.reolinkLightEnabled !== existing.reolinkLightEnabled;

    const camera = await syncReolinkLightCapability(updated, { force: forceReolinkProbe });

    await bridge.updateCamera(camera);

    const rtspChanged = camera.rtspUrl !== existing.rtspUrl;
    const motionChanged = camera.motionSource !== existing.motionSource
        || camera.personSensorEnabled !== existing.personSensorEnabled
        || camera.reolinkLightEnabled !== existing.reolinkLightEnabled
        || camera.onvifUrl !== existing.onvifUrl
        || camera.username !== existing.username
        || camera.password !== existing.password
        || camera.protectHost !== existing.protectHost
        || camera.protectCameraId !== existing.protectCameraId
        || camera.reolinkChannel !== existing.reolinkChannel
        || camera.reolinkHost !== existing.reolinkHost
        || camera.reolinkHttpPort !== existing.reolinkHttpPort
        || camera.reolinkUseHttps !== existing.reolinkUseHttps
        || camera.manufacturer !== existing.manufacturer;

    const endpointCountChanged = camera.personSensorEnabled !== existing.personSensorEnabled
        || camera.reolinkLightEnabled !== existing.reolinkLightEnabled;

    if (rtspChanged) {
        await bridge.go2rtc.removeStream(camera.id);
        await bridge.go2rtc.addStream(camera.id, camera.name, camera.rtspUrl);
    } else if (camera.name !== existing.name) {
        await bridge.go2rtc.addStream(camera.id, camera.name, camera.rtspUrl);
    }

    if (motionChanged || rtspChanged) {
        bridge.startMotionDetection(camera);
    }

    if (endpointCountChanged) {
        setBridgeEndpointCount(countBridgedEndpoints(storage.getCameras()));
        await bridge.notifyHubStructureChange();
    }

    await markBridgeRestartRequired();
}
