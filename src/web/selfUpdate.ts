import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const DOCKER_SOCKET = '/var/run/docker.sock';
const UPDATE_SCRIPT = 'scripts/self-update.sh';

let updateInProgress = false;

export function isUpdateInProgress(): boolean {
    return updateInProgress;
}

export function getSelfUpdateStatus() {
    const root = process.env.MATTER_CAMERAS_SELF_UPDATE_ROOT?.trim() || '';
    const canAutoUpdate = Boolean(
        root &&
        existsSync(join(root, '.git')) &&
        existsSync(join(root, UPDATE_SCRIPT)) &&
        existsSync(DOCKER_SOCKET),
    );

    return { root, canAutoUpdate };
}

export function spawnSelfUpdate(targetVersion: string): void {
    if (updateInProgress) {
        throw new Error('An update is already in progress.');
    }

    const { root, canAutoUpdate } = getSelfUpdateStatus();
    if (!canAutoUpdate) {
        throw new Error(
            'One-click update is not enabled. See docs/INSTALL.md — enable docker-compose.update.yml.',
        );
    }

    updateInProgress = true;

    const child = spawn('bash', [UPDATE_SCRIPT, targetVersion], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        env: process.env,
    });

    child.on('error', () => {
        updateInProgress = false;
    });

    child.unref();
}
