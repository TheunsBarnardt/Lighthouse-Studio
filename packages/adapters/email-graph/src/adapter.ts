/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { EmailMessage, EmailPort, EmailSendResult } from '@platform/ports-communication';
import type { Result } from 'neverthrow';

import { CommunicationError } from '@platform/ports-communication';
import { err, ok } from 'neverthrow';

import type { GraphEmailConfig } from './config.js';

/**
 * Email adapter using Microsoft Graph API.
 *
 * Authenticates via DefaultAzureCredential (managed identity for Azure VMs,
 * or service principal credentials for on-premise machines with a registered
 * app in Entra ID). Sends via the /sendMail Graph API endpoint.
 *
 * Intended for Microsoft-house customers using Exchange Online.
 * See Objective 09 (§6.2).
 */
export class GraphEmailAdapter implements EmailPort {
  private readonly graphBaseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(private readonly config: GraphEmailConfig) {}

  async send(message: EmailMessage): Promise<Result<EmailSendResult, CommunicationError>> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity');

      const credential = new DefaultAzureCredential();
      const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');

      const body = {
        message: {
          subject: message.subject,
          body: {
            contentType: message.htmlBody ? 'HTML' : 'Text',
            content: message.htmlBody ?? message.textBody ?? '',
          },
          toRecipients: toAddresses(message.to),
          ccRecipients: message.cc ? toAddresses(message.cc) : undefined,
          bccRecipients: message.bcc ? toAddresses(message.bcc) : undefined,
          from: {
            emailAddress: { address: this.config.fromAddress },
          },
        },
        saveToSentItems: false,
      };

      const url = `${this.graphBaseUrl}/users/${encodeURIComponent(this.config.fromAddress)}/sendMail`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResponse.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return err(
          new CommunicationError(
            `Graph sendMail failed with status ${String(response.status)}: ${text}`,
          ),
        );
      }

      return ok({ messageId: crypto.randomUUID(), accepted: message.to });
    } catch (cause) {
      return err(new CommunicationError('Failed to send email via Microsoft Graph', String(cause)));
    }
  }
}

function toAddresses(addrs: string | string[]): { emailAddress: { address: string } }[] {
  const list = Array.isArray(addrs) ? addrs : [addrs];
  return list.map((a) => ({ emailAddress: { address: a } }));
}
