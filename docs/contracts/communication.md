# Contract: Communication Ports

## Purpose

Provides outbound communication channels for the platform: email, SMS, and push
notifications. All three ports share the same fire-and-forget semantics — the
caller learns whether the message was accepted for delivery, not whether it was
delivered. Delivery receipts and bounces are out of scope for this interface.

Defined in `@platform/ports-communication`.

---

## Methods

### EmailPort

#### send(message: EmailMessage): Promise<Result<void, CommunicationError>>

Submits an email message for delivery.

```typescript
interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}
```

**Pre-conditions:**

- `to` must contain at least one address.
- `from` must be a valid RFC 5321 address; the adapter may reject addresses not
  authorized by the configured sending domain.
- At least one of `html` or `text` must be non-empty.
- Attachment `content` of type `string` is treated as base64-encoded binary.

**Post-conditions:**

- On `ok(void)`: the adapter has accepted the message. Delivery is not guaranteed.
- On `err(CommunicationError)`: nothing was sent. The error code indicates the
  reason (see Capability Flags below for adapter-specific behaviour).

---

### SmsPort

#### send(message: SmsMessage): Promise<Result<void, CommunicationError>>

Submits an SMS for delivery.

```typescript
interface SmsMessage {
  to: string; // E.164 format: +14155552671
  body: string;
  from?: string; // Sender ID or number; adapter-dependent
}
```

**Pre-conditions:**

- `to` must be in E.164 format.
- `body` must be non-empty and within the provider's character limit (typically
  1600 characters for concatenated SMS).
- `from` is optional; if omitted, the adapter uses the configured default sender.

**Post-conditions:**

- On `ok(void)`: message accepted by the adapter.
- On `err(CommunicationError)`: message rejected.

**Status:** Interface defined. No production adapter ships yet. Only the
in-memory adapter is available. Do not wire this port in production until a
production adapter is registered.

---

### PushNotificationPort

#### send(notification: PushNotification): Promise<Result<void, CommunicationError>>

Submits a push notification for delivery to a single device.

```typescript
interface PushNotification {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>; // Arbitrary key-value payload
  badge?: number;
}
```

**Pre-conditions:**

- `deviceToken` must be a non-empty string provided by the client platform (APNs
  token or FCM registration token).
- `title` and `body` must be non-empty.
- `data` values must all be strings (the port does not serialize nested objects).

**Post-conditions:**

- On `ok(void)`: notification accepted by the adapter.
- On `err(CommunicationError)`: notification rejected.

**Status:** Interface defined. No production adapter ships yet. Only the
in-memory adapter is available.

---

## Error Codes

```typescript
type CommunicationErrorCode =
  | 'DELIVERY_FAILED' // Provider accepted but reported immediate failure
  | 'INVALID_RECIPIENT' // Address/number/token rejected as malformed or unknown
  | 'RATE_LIMITED' // Provider rate limit hit; caller should back off
  | 'AUTHENTICATION_FAILED' // Credentials rejected by provider
  | 'UNKNOWN'; // Catch-all; inspect error.cause for detail
```

---

## Capability Flags

None defined on these ports. Capabilities are implicitly determined by which
adapter is registered:

| Adapter   | Port(s)   | Production-ready | Notes                       |
| --------- | --------- | ---------------- | --------------------------- |
| SMTP      | Email     | Yes              | Nodemailer-based            |
| SES       | Email     | Yes              | AWS SDK v3                  |
| SendGrid  | Email     | Yes              | REST API                    |
| In-memory | All three | Tests only       | Exposes `getSentMessages()` |

---

## Performance Expectations

- Email `send` should resolve within 5 seconds under normal network conditions.
- SMS and push stubs (in-memory) resolve synchronously; production adapters will
  have provider-dependent latency.
- The port does not batch; callers that need bulk sends must call `send` in a
  loop or implement their own batching above this layer.

---

## Known Adapter Divergences

### SMTP vs. SES vs. SendGrid

- **`from` domain authorization:** SES rejects senders not verified in SES;
  SendGrid rejects senders not on an approved domain. SMTP passes `from` through
  to the MTA without pre-validation.
- **Attachment encoding:** SMTP accepts raw `Buffer`; SES and SendGrid require
  base64. The adapters normalize `Buffer` to base64 before submission — callers
  need not handle this.
- **`DELIVERY_FAILED` vs. `AUTHENTICATION_FAILED`:** SES surfaces authentication
  failures as HTTP 403; the SES adapter maps this to `AUTHENTICATION_FAILED`.
  SMTP surfaces them as SMTP reply codes; the mapping may be less precise.

### In-memory

- Accepts any address without validation.
- Never returns an error unless explicitly configured with `simulateError: true`.
- `getSentMessages()` returns a snapshot of all messages sent since construction
  (or since the last `clear()` call). Use this in test assertions; do not use it
  in production code paths.

---

## Usage Examples

```typescript
// Sending a transactional email
const result = await emailPort.send({
  to: ['user@example.com'],
  from: 'no-reply@platform.example',
  subject: 'Your workspace is ready',
  html: '<p>Welcome to the platform.</p>',
  text: 'Welcome to the platform.',
});

if (result.isErr()) {
  logger.error('Email delivery failed', { code: result.error.code });
  // Do not rethrow — callers decide whether to retry or swallow
}

// Test assertion with in-memory adapter
const inMemory = container.resolve<InMemoryEmailAdapter>('EmailPort');
await emailPort.send({ to: ['a@b.com'], from: 'x@y.com', subject: 'Hi', text: 'Hi' });
const sent = inMemory.getSentMessages();
expect(sent).toHaveLength(1);
expect(sent[0].to).toEqual(['a@b.com']);
```

---

## Common Misuse

**Expecting delivery confirmation.** `ok(void)` means the adapter submitted the
message, not that the recipient received it. Do not build logic that depends on
delivery having occurred.

**Ignoring `RATE_LIMITED`.** When the result is `err({ code: 'RATE_LIMITED' })`,
retrying immediately will fail again. Implement exponential back-off or delegate
to a background queue.

**Treating SMS/Push as production-ready.** Both ports are stubs. Wiring them in
a production container will silently succeed (in-memory adapter) with no actual
delivery. Gate on a feature flag or documented adapter registration.

**Calling `getSentMessages()` in production code.** This method exists only on
`InMemoryEmailAdapter` (and its SMS/push equivalents), not on the port interface.
If your production code imports it, the architecture is wrong.
