import { runAiProviderConformance } from '@platform/ports-ai/conformance';

import { EchoAiAdapter } from '../src/index.js';

runAiProviderConformance('EchoAiAdapter', () => Promise.resolve(new EchoAiAdapter()));
