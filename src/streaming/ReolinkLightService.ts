import { Logger } from '@matter/general';
import { LevelControlServer } from '@matter/node/behaviors/level-control';
import { OnOffServer } from '@matter/node/behaviors/on-off';
import type { Endpoint } from '@matter/node';
import { motionConfig } from '../config/motion.js';
import type { Camera } from '../types/index.js';
import { lightContext, type ReolinkLightSyncState } from '../matter/behaviors/lightContext.js';
import { reolinkBrightToMatterLevel, matterLevelToReolinkBright } from '../matter/reolinkLightLevels.js';
import { reolinkLightEndpointId } from '../matter/reolinkLightConfig.js';
import {
    ReolinkClient,
    resolveReolinkTarget,
} from '../motion/providers/reolink/reolinkClient.js';

const logger = Logger.get('ReolinkLight');

interface ActiveLight {
    client: ReolinkClient;
    channel: number;
    brightness: number;
    timer?: ReturnType<typeof setInterval>;
    applying: boolean;
    syncState: (state: ReolinkLightSyncState) => void;
}

/** Polls Reolink WhiteLed state and applies hub OnOff / LevelControl for bridged light endpoints. */
export class ReolinkLightService {
    readonly #lights = new Map<string, ActiveLight>();

    /** Returns true when GetWhiteLed succeeds for the camera channel. */
    async probeCapability(camera: Camera): Promise<boolean> {
        const target = resolveReolinkTarget(camera);
        if (!target) return false;

        const client = new ReolinkClient(target.host, target.username, target.password, {
            port: target.port,
            useHttps: target.useHttps,
        });

        try {
            await client.ensureAuth();
            return (await client.getWhiteLedState(target.channel)) !== null;
        } catch (error) {
            logger.debug(`Reolink light capability probe failed camera=${camera.id}: ${error}`);
            return false;
        }
    }

    /** Probe GetWhiteLed and start polling when the camera supports spotlight control. */
    async start(
        camera: Camera,
        endpoint: Endpoint,
        syncState: (state: ReolinkLightSyncState) => void,
    ): Promise<boolean> {
        const target = resolveReolinkTarget(camera);
        if (!target) {
            logger.warn(`Reolink light unavailable — missing credentials camera=${camera.id}`);
            return false;
        }

        this.stop(camera.id);

        const client = new ReolinkClient(target.host, target.username, target.password, {
            port: target.port,
            useHttps: target.useHttps,
        });

        let initial;
        try {
            await client.ensureAuth();
            initial = await client.getWhiteLedState(target.channel);
        } catch (error) {
            logger.warn(`Reolink light probe failed camera=${camera.id}: ${error}`);
            return false;
        }

        if (!initial) {
            logger.info(
                `Reolink light capability unavailable camera=${camera.id} host=${target.host} ch=${target.channel}`,
            );
            return false;
        }

        const initialBright = initial.brightness ?? 100;
        logger.info(
            `Reolink light capability camera=${camera.id} host=${target.host} ch=${target.channel} enabled=${initial.enabled} bright=${initialBright}`,
        );

        const endpointId = reolinkLightEndpointId(camera.id);
        const active: ActiveLight = {
            client,
            channel: target.channel,
            brightness: initialBright,
            applying: false,
            syncState,
        };
        this.#lights.set(camera.id, active);

        lightContext.applyState.set(endpointId, on => this.#applyOn(camera.id, on));
        lightContext.applyLevel.set(endpointId, (level, withOnOff) => this.#applyLevel(camera.id, level, withOnOff));
        this.#sync(active, initial.enabled, initialBright);

        const tick = () => void this.#poll(camera.id, endpoint);
        await tick();
        active.timer = setInterval(tick, motionConfig.reolinkLightPollMs);
        logger.info(`Reolink light start camera=${camera.id} endpoint=${endpointId}`);
        return true;
    }

    stop(cameraId: string): void {
        const active = this.#lights.get(cameraId);
        if (!active) return;

        if (active.timer) clearInterval(active.timer);
        const endpointId = reolinkLightEndpointId(cameraId);
        lightContext.applyState.delete(endpointId);
        lightContext.applyLevel.delete(endpointId);
        this.#lights.delete(cameraId);
        logger.info(`Reolink light stop camera=${cameraId}`);
    }

    async #applyOn(cameraId: string, on: boolean): Promise<boolean> {
        const active = this.#lights.get(cameraId);
        if (!active) return false;

        active.applying = true;
        try {
            const ok = await active.client.setWhiteLed(active.channel, on, active.brightness);
            if (ok) {
                this.#sync(active, on, active.brightness);
            }
            return ok;
        } finally {
            active.applying = false;
        }
    }

    async #applyLevel(cameraId: string, level: number, withOnOff: boolean): Promise<boolean> {
        const active = this.#lights.get(cameraId);
        if (!active) return false;

        const bright = matterLevelToReolinkBright(level);
        active.applying = true;
        try {
            const ok = await active.client.setWhiteLed(active.channel, true, bright);
            if (ok) {
                active.brightness = bright;
                this.#sync(active, true, bright);
            }
            return ok;
        } finally {
            active.applying = false;
        }
    }

    #sync(active: ActiveLight, on: boolean, bright: number): void {
        active.syncState({
            on,
            level: reolinkBrightToMatterLevel(on ? bright : 0),
        });
    }

    async #poll(cameraId: string, endpoint: Endpoint): Promise<void> {
        const active = this.#lights.get(cameraId);
        if (!active || active.applying) return;

        try {
            const state = await active.client.getWhiteLedState(active.channel);
            if (!state) return;

            const bright = state.brightness ?? active.brightness;
            active.brightness = bright;

            const matterOn = Boolean(endpoint.stateOf(OnOffServer)?.onOff);
            const matterLevel = endpoint.stateOf(LevelControlServer)?.currentLevel ?? reolinkBrightToMatterLevel(bright);
            const targetLevel = reolinkBrightToMatterLevel(state.enabled ? bright : 0);

            if (matterOn !== state.enabled || matterLevel !== targetLevel) {
                this.#sync(active, state.enabled, bright);
            }
        } catch (error) {
            logger.debug(`Reolink light poll failed camera=${cameraId}: ${error}`);
        }
    }
}
