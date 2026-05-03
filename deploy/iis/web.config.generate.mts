#!/usr/bin/env tsx
/**
 * Generates a web.config for the IIS reverse proxy from the template.
 *
 * Usage:
 *   tsx deploy/iis/web.config.generate.mts [--port 3000] [--max-body-mb 10] [--output ./web.config]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(): { port: number; maxBodyMb: number; output: string } {
  const args = process.argv.slice(2);
  let port = 3000;
  let maxBodyMb = 10;
  let output = path.join(process.cwd(), 'web.config');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      i++;
      port = parseInt(args[i] ?? '', 10);
    } else if (args[i] === '--max-body-mb' && args[i + 1]) {
      i++;
      maxBodyMb = parseInt(args[i] ?? '', 10);
    } else if (args[i] === '--output' && args[i + 1]) {
      i++;
      output = args[i] ?? output;
    }
  }

  return { port, maxBodyMb, output };
}

const { port, maxBodyMb, output } = parseArgs();
const maxBodyBytes = maxBodyMb * 1024 * 1024;

const templatePath = path.join(__dirname, 'web.config.template');
const template = fs.readFileSync(templatePath, 'utf8');

const result = template
  .replace(/\$\{NODE_PORT\}/g, String(port))
  .replace(/\$\{MAX_BODY_MB\}/g, String(maxBodyMb))
  .replace(/\$\{MAX_BODY_BYTES\}/g, String(maxBodyBytes));

fs.writeFileSync(output, result, 'utf8');
console.log(`web.config written to ${output}`);
console.log(`  Node port:    ${String(port)}`);
console.log(`  Max body:     ${String(maxBodyMb)} MB (${String(maxBodyBytes)} bytes)`);
