import type { Result } from 'neverthrow';

import type { CommunicationError } from './errors.js';
import type { PushNotification, PushSendResult } from './types.js';

export interface PushNotificationPort {
  send(notification: PushNotification): Promise<Result<PushSendResult, CommunicationError>>;
}
