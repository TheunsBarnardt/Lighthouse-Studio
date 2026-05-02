import { runAuditConformance } from '@platform/ports-audit/conformance';

import { InMemoryAuditPort } from '../src/index.js';

runAuditConformance('InMemoryAuditPort', () => Promise.resolve(new InMemoryAuditPort()));
