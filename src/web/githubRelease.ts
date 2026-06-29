import { isNewerVersion } from '../utils/compareVersions.js';

const GITHUB_REPO = 'patricktd/MatterCameras';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface GitHubRelease {
    tag_name: string;
    html_url: string;
    body: string;
    published_at: string;
}

interface CachedRelease {
    fetchedAt: number;
    release: GitHubRelease | null;
    error: string | null;
}

let cache: CachedRelease | null = null;

function normalizeTag(tag: string): string {
    return tag.trim().replace(/^v/i, '');
}

async function fetchLatestRelease(): Promise<CachedRelease> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'Matter-Cameras-Bridge',
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            return {
                fetchedAt: Date.now(),
                release: null,
                error: response.status === 404
                    ? 'No GitHub releases published yet.'
                    : `GitHub API returned ${response.status}`,
            };
        }

        const release = await response.json() as GitHubRelease;
        return { fetchedAt: Date.now(), release, error: null };
    } catch (error) {
        return {
            fetchedAt: Date.now(),
            release: null,
            error: error instanceof Error ? error.message : String(error),
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function getLatestReleaseInfo(currentVersion: string) {
    const now = Date.now();
    if (!cache || now - cache.fetchedAt > CACHE_TTL_MS) {
        cache = await fetchLatestRelease();
    }

    const latestVersion = cache.release ? normalizeTag(cache.release.tag_name) : null;
    const updateAvailable = Boolean(latestVersion && isNewerVersion(latestVersion, currentVersion));

    return {
        currentVersion,
        latestVersion,
        updateAvailable,
        releaseUrl: cache.release?.html_url ?? `https://github.com/${GITHUB_REPO}/releases`,
        releaseNotes: cache.release?.body?.trim() || null,
        publishedAt: cache.release?.published_at ?? null,
        checkError: cache.error,
        repositoryUrl: `https://github.com/${GITHUB_REPO}`,
    };
}
