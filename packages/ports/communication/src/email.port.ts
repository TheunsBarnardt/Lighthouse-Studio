import type { Result } from 'neverthrow';

import type { CommunicationError } from './errors.js';
import type { EmailMessage, EmailSendResult } from './types.js';

export interface EmailPort {
  send(message: EmailMessage): Promise<Result<EmailSendResult, CommunicationError>>;
}
