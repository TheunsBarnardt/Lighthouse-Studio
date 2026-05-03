#!/usr/bin/env tsx
/**
 * Uninstalls the Platform Web Windows Service.
 *
 * Run with Administrator privileges:
 *   node --enable-source-maps scripts\uninstall-windows-service.mjs
 *
 * This cleanly removes the service, deregisters the Event Log source,
 * and removes the node-windows wrapper XML file.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Service } = (await import('node-windows')) as typeof import('node-windows');

const platformHome = process.env['PLATFORM_HOME'] ?? 'C:\\Platform';
const scriptPath = path.resolve(__dirname, '..', 'dist', 'server.js');

const svc = new Service({
  name: 'Platform Web',
  script: scriptPath,
  workingDirectory: path.resolve(__dirname, '..'),
} as unknown as ConstructorParameters<typeof Service>[0]);

svc.on('uninstall', () => {
  console.log('Platform Web service uninstalled successfully.');
  console.log('Note: log files in', path.join(platformHome, 'logs', 'web'), 'are preserved.');
});

svc.on('notinstalled', () => {
  console.log('Platform Web service is not installed — nothing to remove.');
  process.exit(0);
});

svc.on('error', (err: Error) => {
  console.error('Service uninstall error:', err.message);
  process.exit(1);
});

console.log('Stopping and uninstalling Platform Web service...');
svc.uninstall();
