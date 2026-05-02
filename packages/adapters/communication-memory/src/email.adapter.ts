import type {
  CommunicationError,
  EmailMessage,
  EmailPort,
  EmailSendResult,
} from '@platform/ports-communication';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

export class InMemoryEmailPort implements EmailPort {
  private readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<Result<EmailSendResult, CommunicationError>> {
    this.sent.push(message);
    return Promise.resolve(
      ok({
        messageId: `memory-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        accepted: message.to.map((r) => r.email),
        rejected: [],
      }),
    );
  }

  getSentMessages(): readonly EmailMessage[] {
    return this.sent;
  }

  clearSentMessages(): void {
    this.sent.length = 0;
  }
}
