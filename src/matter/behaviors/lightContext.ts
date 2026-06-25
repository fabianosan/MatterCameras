/** Handlers registered by {@link ReolinkLightService} for bridged Reolink light endpoints. */
export const lightContext = {
    applyState: new Map<string, (on: boolean) => Promise<boolean>>(),
    applyLevel: new Map<string, (level: number, withOnOff: boolean) => Promise<boolean>>(),
};

export interface ReolinkLightSyncState {
    on: boolean;
    level: number;
}
