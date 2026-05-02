import { describe, expect, it } from 'vitest';

import type { EmailPort } from '../email.port.js';

export function runEmailPortConformance(name: string, factory: () => Promise<EmailPort>): void {
  describe(`${name} — EmailPort conformance`, () => {
    it('send returns a messageId on success', async () => {
      const email = await factory();
      const result = await email.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'recipient@example.com' }],
        subject: 'Conformance test',
        bodyText: 'Hello from the conformance suite.',
      });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().messageId).toBeTruthy();
    });

    it('send result includes accepted addresses', async () => {
      const email = await factory();
      const result = await email.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
        subject: 'Multi-recipient test',
        bodyText: 'Test',
      });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().accepted.length).toBeGreaterThan(0);
    });
  });
}
