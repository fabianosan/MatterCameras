import { settings } from '../storage/settings.js';

/** Mark that SmartThings needs a bridge restart to pick up roster / endpoint changes. */
export async function markBridgeRestartRequired(): Promise<void> {
    await settings.setBridgeRestartPending(true);
}

export function isBridgeRestartPending(): boolean {
    return settings.isBridgeRestartPending();
}
