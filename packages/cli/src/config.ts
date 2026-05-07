import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface CliConfig {
  url?: string;
  token?: string;
  workspace?: string;
}

function configPath(): string {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';
  return join(home, '.platform', 'config.json');
}

export function readConfig(): CliConfig {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as CliConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: CliConfig): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
}

export function requireConfig(): Required<Pick<CliConfig, 'url' | 'token'>> & CliConfig {
  const cfg = readConfig();
  if (!cfg.url || !cfg.token) {
    console.error('Not logged in. Run: pdm login --url <platform-url>');
    process.exit(1);
  }
  return cfg as Required<Pick<CliConfig, 'url' | 'token'>> & CliConfig;
}
