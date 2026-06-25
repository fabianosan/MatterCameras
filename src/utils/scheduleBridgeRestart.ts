import { spawn } from 'node:child_process';

const MANAGED_RESTART_ENV = 'MATTER_CAMERAS_MANAGED_RESTART';
const RESTART_COMMAND_ENV = 'MATTER_CAMERAS_RESTART_COMMAND';
const RESTART_CWD_ENV = 'MATTER_CAMERAS_RESTART_CWD';
const RESTART_DELAY_ENV = 'MATTER_CAMERAS_RESTART_DELAY_MS';

export function usesManagedRestart(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[MANAGED_RESTART_ENV] === '1';
}

export function getCurrentProcessCommand(proc: NodeJS.Process = process): string[] {
    return [proc.execPath, ...proc.execArgv, ...proc.argv.slice(1)];
}

function launchReplacementProcess(delayMs: number) {
    const launcherScript = [
        "const { spawn } = require('node:child_process');",
        `const rawCommand = process.env.${RESTART_COMMAND_ENV};`,
        `const cwd = process.env.${RESTART_CWD_ENV};`,
        `const delayMs = Number(process.env.${RESTART_DELAY_ENV} || '0');`,
        "const [execPath, ...args] = JSON.parse(rawCommand || '[]');",
        'setTimeout(() => {',
        '  const child = spawn(execPath, args, {',
        '    cwd,',
        '    env: process.env,',
        "    detached: true,",
        "    stdio: 'ignore',",
        '    windowsHide: true,',
        '  });',
        '  child.unref();',
        '}, delayMs);',
    ].join(' ');

    const launcherEnv = {
        ...process.env,
        [RESTART_COMMAND_ENV]: JSON.stringify(getCurrentProcessCommand()),
        [RESTART_CWD_ENV]: process.cwd(),
        [RESTART_DELAY_ENV]: String(delayMs),
    };

    const launcher = spawn(process.execPath, ['-e', launcherScript], {
        cwd: process.cwd(),
        env: launcherEnv,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });

    launcher.unref();
}

/**
 * In containers, exit so the runtime restarts the app with cameras loaded before Matter networking.
 * In local host runs, spawn a replacement process first because `npm start` has no supervisor.
 */
export function scheduleBridgeRestart(reason: string, delayMs = 1500) {
    console.log(`Scheduling bridge restart: ${reason}`);

    if (usesManagedRestart()) {
        setTimeout(() => {
            console.log('Restarting to refresh Matter partsList for SmartThings hub...');
            process.exit(0);
        }, delayMs);
        return;
    }

    try {
        launchReplacementProcess(delayMs);
        console.log('Launching replacement process for local host run...');
        setTimeout(() => {
            console.log('Restarting to refresh Matter partsList for SmartThings hub...');
            process.exit(0);
        }, 100);
    } catch (error) {
        console.error('Failed to launch replacement process for local host run:', error);
    }
}
