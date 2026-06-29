export interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    prerelease: string | null;
}

/** Parse `0.4.0-beta` or `v1.2.3` style versions. */
export function parseVersion(input: string): ParsedVersion {
    const normalized = input.trim().replace(/^v/i, '');
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/i.exec(normalized);
    if (!match) {
        throw new Error(`Invalid version: ${input}`);
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] ?? null,
    };
}

/** @returns negative if a < b, positive if a > b, zero if equal */
export function compareVersions(a: string, b: string): number {
    const left = parseVersion(a);
    const right = parseVersion(b);

    if (left.major !== right.major) return left.major - right.major;
    if (left.minor !== right.minor) return left.minor - right.minor;
    if (left.patch !== right.patch) return left.patch - right.patch;

    if (!left.prerelease && !right.prerelease) return 0;
    if (!left.prerelease) return 1;
    if (!right.prerelease) return -1;

    return left.prerelease.localeCompare(right.prerelease);
}

export function isNewerVersion(latest: string, current: string): boolean {
    return compareVersions(latest, current) > 0;
}
