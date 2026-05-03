#!/usr/bin/env tsx
/**
 * Installs the Platform Worker as a Windows Service via node-windows.
 *
 * Run with Administrator privileges:
 *   node --enable-source-maps scripts\install-windows-service.mjs
 *
 * The service:
 *   - Name: Platform Worker
 *   - Processes background jobs (no inbound HTTP traffic)
 *   - Restarts on crash with exponential backoff (max 3 restarts)
 *   - Logs to Windows Event Log + C:\Platform\logs\worker\
 *
 * See ADR-0086 and docs/deployments/windows.md.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Service } = (await import('node-windows')) as typeof import('node-windows');

const platformHome = process.env['PLATFORM_HOME'] ?? 'C:\\Platform';
const scriptPath = path.resolve(__dirname, '..', 'dist', 'worker.js');
const logDir = path.join(platformHome, 'logs', 'worker');

const svc = new Service({
  name: 'Platform Worker',
  description: 'Lighthouse Platform — background job processor',
  script: scriptPath,
  nodeOptions: ['--enable-source-maps', '--max-old-space-size=1536'],
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PLATFORM_HOME', value: platformHome },
  ],
  workingDirectory: path.resolve(__dirname, '..'),
  logpath: logDir,
  wait: 2,
  grow: 0.5,
  maxRestarts: 3,
} as unknown as ConstructorParameters<typeof Service>[0]);

svc.on('install', () => {
  console.log('Platform Worker service installed successfully.');
  svc.start();
  console.log(
    'Service started. Use "services.msc" or "Get-Service \'Platform Worker\'" to verify.',
  );
});

svc.on('alreadyinstalled', () => {
  console.log('Platform Worker service is already installed.');
  console.log('Run uninstall-windows-service.mjs first if you need to reinstall.');
  process.exit(0);
});

svc.on('start', () => {
  console.log('Platform Worker service is running.');
});

svc.on('error', (err: Error) => {
  console.error('Service install error:', err.message);
  process.exit(1);
});

console.log('Installing Platform Worker service...');
console.log(`  Script: ${scriptPath}`);
console.log(`  Logs:   ${logDir}`);
svc.install();
