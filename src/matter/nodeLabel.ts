/**
 * Matter BridgedDeviceBasicInformation.NodeLabel is capped at 32 characters.
 * Exceeding it throws during behavior initialization and rolls back the whole
 * endpoint, which aborts the camera install. Clamp every node label to be safe.
 */
export const MATTER_NODE_LABEL_MAX = 32;

/** Truncate a label to the Matter node-label limit. */
export function clampNodeLabel(label: string): string {
    const trimmed = label.trim();
    return trimmed.length <= MATTER_NODE_LABEL_MAX
        ? trimmed
        : trimmed.slice(0, MATTER_NODE_LABEL_MAX).trimEnd();
}

/** Combine a name and a suffix within the limit, trimming the name so the suffix survives. */
export function composeNodeLabel(name: string, suffix: string): string {
    const full = `${name}${suffix}`;
    if (full.length <= MATTER_NODE_LABEL_MAX) {
        return full;
    }
    const room = Math.max(0, MATTER_NODE_LABEL_MAX - suffix.length);
    return `${name.slice(0, room).trimEnd()}${suffix}`.slice(0, MATTER_NODE_LABEL_MAX);
}
