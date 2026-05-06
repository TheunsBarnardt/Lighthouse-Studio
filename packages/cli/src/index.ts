import { Command } from 'commander';

import { registerDumpSchema } from './commands/dump-schema.js';
import { registerInit } from './commands/init.js';
import { registerLogin } from './commands/login.js';
import { registerPushSchema } from './commands/push-schema.js';
import { registerSyncTypes } from './commands/sync-types.js';
import { registerWatch } from './commands/watch.js';

const program = new Command();

program
  .name('pdm')
  .description('Platform CLI — manage schemas, generate types, bootstrap projects')
  .version('0.1.0');

registerInit(program);
registerLogin(program);
registerSyncTypes(program);
registerWatch(program);
registerDumpSchema(program);
registerPushSchema(program);

program.parse();
