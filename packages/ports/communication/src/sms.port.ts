import type { Result } from 'neverthrow';

import type { CommunicationError } from './errors.js';
import type { SmsMessage, SmsSendResult } from './types.js';

export interface SmsPort {
  send(message: SmsMessage): Promise<Result<SmsSendResult, CommunicationError>>;
}
