#!/usr/bin/env tsx
/**
 * Installs the Platform Web app as a Windows Service via node-windows.
 *
 * Run with Administrator privileges:
 *   node --enable-source-maps scripts\install-windows-service.mjs
 *
 * The service:
 *   - Name: Platform Web
 *   - Listens on 127.0.0.1:3000 (IIS reverse-proxies to this)
 *   - Restarts on crash with exponential backoff (max 3 restarts)
 *   - Logs to Windows Event Log + C:\Platform\logs\web\
 *
 * See ADR-0086 and docs/deployments/windows.md.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// node-windows is a Windows-only dependency; dynamic import avoids build errors on Linux
const { Service } = (await import('node-windows')) as typeof import('node-windows');

const platformHome = process.env['PLATFORM_HOME'] ?? 'C:\\Platform';
const scriptPath = path.resolve(__dirname, '..', 'dist', 'server.js');
const logDir = path.join(platformHome, 'logs', 'web');

const svc = new Service({
  name: 'Platform Web',
  description: 'Lighthouse Platform — web application (reverse-proxied by IIS)',
  script: scriptPath,
  nodeOptions: ['--enable-source-maps', '--max-old-space-size=2048'],
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PLATFORM_HOME', value: platformHome },
  ],
  workingDirectory: path.resolve(__dirname, '..'),
  logpath: logDir,
  // Restart policy: wait 2s, grow by 0.5x each retry, max 3 restarts
  wait: 2,
  grow: 0.5,
  maxRestarts: 3,
} as unknown as ConstructorParameters<typeof Service>[0]);

svc.on('install', () => {
  console.log('Platform Web service installed successfully.');
  svc.start();
  console.log('Service started. Use "services.msc" or "Get-Service \'Platform Web\'" to verify.');
});

svc.on('alreadyinstalled', () => {
  console.log('Platform Web service is already installed.');
  console.log('Run uninstall-windows-service.mjs first if you need to reinstall.');
  process.exit(0);
});

svc.on('start', () => {
  console.log('Platform Web service is running.');
});

svc.on('error', (err: Error) => {
  console.error('Service install error:', err.message);
  process.exit(1);
});

console.log(`Installing Platform Web service...`);
console.log(`  Script: ${scriptPath}`);
console.log(`  Logs:   ${logDir}`);
svc.install();
