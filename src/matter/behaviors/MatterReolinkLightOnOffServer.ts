import { Logger } from '@matter/general';
import { DimmableLightRequirements } from '@matter/main/devices/dimmable-light';
import { lightContext } from './lightContext.js';

const BaseOnOff = DimmableLightRequirements.OnOffServer;
const logger = Logger.get('ReolinkLightOnOff');

/**
 * Matter OnOff server for a bridged Reolink WhiteLed light.
 * Delegates hub on/off commands to {@link ReolinkLightService} via {@link lightContext}.
 */
export class MatterReolinkLightOnOffServer extends BaseOnOff {
    static override readonly id = 'onOff';

    override async on() {
        const applied = await this.#apply(true);
        if (!applied) return;
        await super.on();
    }

    override async off() {
        const applied = await this.#apply(false);
        if (!applied) return;
        await super.off();
    }

    async #apply(on: boolean): Promise<boolean> {
        const endpointId = String(this.endpoint.id);
        const handler = lightContext.applyState.get(endpointId);
        if (!handler) {
            logger.warn(`No Reolink light handler for endpoint=${endpointId}`);
            return false;
        }

        try {
            const ok = await handler(on);
            if (!ok) {
                logger.warn(`Reolink light command rejected endpoint=${endpointId} on=${on}`);
            }
            return ok;
        } catch (error) {
            logger.warn(`Reolink light command failed endpoint=${endpointId}: ${error}`);
            return false;
        }
    }
}
