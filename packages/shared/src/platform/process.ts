import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Cross-platform process spawner. On Windows, npm/pnpm/etc. require shell: true or the .cmd extension.
 * This helper normalises that so call-sites stay platform-agnostic.
 */
export function spawnCommand(
  cmd: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const child = spawn(cmd, args, {
      ...options,
      shell: isWindows,
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    child.on('error', reject);

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8').trim(),
        stderr: Buffer.concat(stderr).toString('utf8').trim(),
      });
    });
  });
}
