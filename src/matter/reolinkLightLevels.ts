/** Matter LevelControl lighting range is 1–254; Reolink WhiteLed bright is 0–100. */
export function reolinkBrightToMatterLevel(bright: number): number {
    const clamped = Math.max(0, Math.min(100, Math.round(bright)));
    if (clamped === 0) return 1;
    return Math.max(1, Math.round((clamped / 100) * 254));
}

export function matterLevelToReolinkBright(level: number): number {
    const clamped = Math.max(1, Math.min(254, Math.round(level)));
    return Math.max(1, Math.round((clamped / 254) * 100));
}
