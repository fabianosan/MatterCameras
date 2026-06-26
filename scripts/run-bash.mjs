import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function resolveBash() {
  if (process.platform !== 'win32') {
    return 'bash';
  }

  const candidates = [
    join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  console.error(`Git Bash not found. On Windows, npm deploy scripts use Git Bash, not WSL.

Install Git for Windows: https://git-scm.com/download/win
Or run .\\deploy.ps1 from PowerShell after installing Git Bash and rsync.`);
  process.exit(1);
}

const [, , script, ...args] = process.argv;
if (!script) {
  console.error('Usage: node scripts/run-bash.mjs <script.sh> [args...]');
  process.exit(1);
}

const result = spawnSync(resolveBash(), [script, ...args], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
