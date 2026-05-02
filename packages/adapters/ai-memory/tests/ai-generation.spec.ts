import { runAiGenerationConformance } from '@platform/ports-ai/conformance';

import { EchoAiAdapter } from '../src/index.js';

runAiGenerationConformance('EchoAiAdapter', () => Promise.resolve(new EchoAiAdapter()));
