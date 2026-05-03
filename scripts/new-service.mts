/**
 * Generator for new service classes in packages/core/src/services/.
 *
 * Run via: pnpm new-service <ServiceName>
 *
 * Scaffolds:
 *   packages/core/src/services/<name>.service.ts
 *   packages/core/src/services/<name>.service.test.ts
 *   Updates packages/core/src/index.ts with the new exports
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function camelCase(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function pascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kebabCase(s: string): string {
  return s.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '');
}

function main(): void {
  const rawName = process.argv[2];

  if (!rawName) {
    console.error('Usage: pnpm new-service <ServiceName>');
    console.error('  Example: pnpm new-service Project');
    console.error('  Produces: ProjectService in packages/core/src/services/project.service.ts');
    process.exit(1);
  }

  const pascalName = pascalCase(rawName.replace(/Service$/, ''));
  const camelName = camelCase(pascalName);
  const fileName = kebabCase(pascalName);
  const className = `${pascalName}Service`;

  const serviceFile = join(ROOT, 'packages', 'core', 'src', 'services', `${fileName}.service.ts`);
  const testFile = join(ROOT, 'packages', 'core', 'src', 'services', `${fileName}.service.test.ts`);
  const indexFile = join(ROOT, 'packages', 'core', 'src', 'index.ts');

  if (existsSync(serviceFile)) {
    console.error(`Service already exists at: ${serviceFile}`);
    process.exit(1);
  }

  // ── Generate service file ────────────────────────────────────────────────────

  const serviceContent = `import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';

// ── Input schemas ──────────────────────────────────────────────────────────────

const Create${pascalName}InputSchema = z.object({
  // TODO: define input fields
  name: z.string().min(1).max(255),
});

export type Create${pascalName}Input = z.infer<typeof Create${pascalName}InputSchema>;

// ── Domain type ───────────────────────────────────────────────────────────────

export interface ${pascalName} {
  id: string;
  version: number;
  // TODO: add domain fields
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ${className} {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /**
   * Canonical shape: validate → authorize → precondition → execute → audit → return.
   * Replace this stub with the actual implementation.
   */
  async create(
    ctx: RequestContext,
    input: Create${pascalName}Input,
  ): Promise<Result<${pascalName}, AppError>> {
    // 1. Validate
    const parsed = Create${pascalName}InputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid ${camelName} input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, '${camelName}.create', '${camelName}');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition
    // TODO: check uniqueness or other preconditions

    // 4. Execute
    // TODO: call repository and construct entity
    void parsed; // remove once implemented
    return err(new NotFoundError('${camelName}', 'not-implemented'));

    // 5. Audit  (move outside the stub once execute is implemented)
    // await this.audit.write({
    //   eventType: '${camelName}.created',
    //   actor: toAuditActor(ctx),
    //   resource: { type: '${camelName}', id: entity.id },
    //   action: 'created',
    //   outcome: 'success',
    //   correlationId: ctx.correlationId,
    //   ...auditMeta(ctx),
    // });

    // 6. Return
    // return ok(entity);
  }
}
`;

  // ── Generate test file ───────────────────────────────────────────────────────

  const testContent = `import { describe, it, expect, beforeEach } from 'vitest';

import { ${className} } from './${fileName}.service.js';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  makeUserContext,
} from '../testing/index.js';

function makeService(opts?: { denyAll?: boolean }) {
  const adapters = {
    authz: createInMemoryAuthz({ deny: opts?.denyAll }),
    audit: createInMemoryAudit(),
    logger: createInMemoryLogger(),
  };
  const service = new ${className}(adapters.authz, adapters.audit, adapters.logger);
  return { service, adapters };
}

describe('${className}.create', () => {
  it('TODO: add tests', async () => {
    const { service } = makeService();
    const ctx = makeUserContext({ userId: 'user-1' });

    // Replace with a real test once the service is implemented
    const result = await service.create(ctx, { name: 'Test' });
    expect(result.isErr()).toBe(true); // stub always errors
  });

  it('returns FORBIDDEN when authorization is denied', async () => {
    const { service } = makeService({ denyAll: true });
    const ctx = makeUserContext();

    const result = await service.create(ctx, { name: 'Test' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});
`;

  writeFileSync(serviceFile, serviceContent);
  writeFileSync(testFile, testContent);

  console.log(`✓ Created ${serviceFile}`);
  console.log(`✓ Created ${testFile}`);

  // ── Update core index ────────────────────────────────────────────────────────

  const indexContent = readFileSync(indexFile, 'utf8');

  const exportBlock = `
export { ${className} } from './services/${fileName}.service.js';
export type { Create${pascalName}Input, ${pascalName} } from './services/${fileName}.service.js';`;

  if (indexContent.includes(`'./services/${fileName}.service.js'`)) {
    console.log(`  (index.ts already exports ${className} — skipped)`);
  } else {
    const servicesMarker =
      '// ── Services ──────────────────────────────────────────────────────────────────';
    if (indexContent.includes(servicesMarker)) {
      const updatedIndex = indexContent.replace(servicesMarker, `${servicesMarker}${exportBlock}`);
      writeFileSync(indexFile, updatedIndex);
      console.log(`✓ Updated packages/core/src/index.ts`);
    } else {
      const updated = indexContent + exportBlock + '\n';
      writeFileSync(indexFile, updated);
      console.log(`✓ Appended to packages/core/src/index.ts`);
    }
  }

  console.log('\nNext steps:');
  console.log(`  1. Add repository and other deps to ${className} constructor`);
  console.log(`  2. Implement the create() method body`);
  console.log(`  3. Add remaining methods (update, archive, etc.)`);
  console.log(`  4. Wire ${className} into the composition root`);
  console.log(`  5. Add the resource to docs/contracts/permissions.md`);
  console.log(`  6. Update the audit event catalog for new event types`);
}

main();
