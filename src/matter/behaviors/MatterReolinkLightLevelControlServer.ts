import { Logger } from '@matter/general';
import { DimmableLightRequirements } from '@matter/main/devices/dimmable-light';
import { Status, StatusResponseError } from '@matter/types';
import { lightContext } from './lightContext.js';

const BaseLevel = DimmableLightRequirements.LevelControlServer;
const logger = Logger.get('ReolinkLightLevel');

/**
 * Maps Matter LevelControl commands to Reolink WhiteLed brightness (0–100).
 */
export class MatterReolinkLightLevelControlServer extends BaseLevel {
    static override readonly id = 'levelControl';

    override async moveToLevelLogic(
        level: number,
        transitionTime: number | null,
        withOnOff: boolean,
        options = {},
    ) {
        const endpointId = String(this.endpoint.id);
        const handler = lightContext.applyLevel.get(endpointId);
        if (handler) {
            try {
                const ok = await handler(Math.round(level), withOnOff);
                if (!ok) {
                    throw new StatusResponseError('Reolink brightness command rejected', Status.Failure);
                }
            } catch (error) {
                if (error instanceof StatusResponseError) throw error;
                logger.warn(`Reolink level command failed endpoint=${endpointId}: ${error}`);
                throw new StatusResponseError('Reolink brightness command failed', Status.Failure);
            }
        }

        return super.moveToLevelLogic(level, transitionTime ?? null, withOnOff, options);
    }
}
