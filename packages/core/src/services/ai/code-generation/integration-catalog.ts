import type { IntegrationDescriptor } from './types.js';

const INTEGRATIONS: IntegrationDescriptor[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing, subscriptions, invoicing, and billing management.',
    module: '@platform/integrations/stripe',
    category: 'payment',
    configSchema: {
      stripeApiKey: { type: 'string', required: true, description: 'Stripe secret API key', secret: true },
      stripeWebhookSecret: { type: 'string', required: false, description: 'Webhook signing secret for verifying events', secret: true },
    },
    methods: ['checkout.sessions.create', 'customers.create', 'subscriptions.create', 'subscriptions.cancel', 'invoices.list', 'paymentIntents.create'],
    documentation: 'https://stripe.com/docs/api',
    examples: [
      {
        title: 'Create a checkout session',
        code: `import { stripe } from '@platform/integrations/stripe';
export async function createCheckout(input, ctx) {
  const client = stripe(ctx.secrets.stripeApiKey);
  const session = await client.checkout.sessions.create({
    line_items: input.lineItems,
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  return { url: session.url };
}`,
      },
    ],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Transactional email delivery with templates and analytics.',
    module: '@platform/integrations/sendgrid',
    category: 'communication',
    configSchema: {
      sendgridApiKey: { type: 'string', required: true, description: 'SendGrid API key', secret: true },
      fromEmail: { type: 'string', required: true, description: 'Verified sender email address', secret: false },
    },
    methods: ['send', 'sendTemplate'],
    documentation: 'https://docs.sendgrid.com/api-reference',
    examples: [
      {
        title: 'Send a transactional email',
        code: `import { sendgrid } from '@platform/integrations/sendgrid';
export async function sendWelcomeEmail(input, ctx) {
  await sendgrid(ctx.secrets.sendgridApiKey).send({
    to: input.email,
    from: ctx.secrets.fromEmail,
    subject: 'Welcome!',
    text: 'Thanks for signing up.',
  });
  return { sent: true };
}`,
      },
    ],
  },
  {
    id: 'postmark',
    name: 'Postmark',
    description: 'Transactional email with high deliverability and detailed analytics.',
    module: '@platform/integrations/postmark',
    category: 'communication',
    configSchema: {
      postmarkApiToken: { type: 'string', required: true, description: 'Postmark server API token', secret: true },
    },
    methods: ['send', 'sendWithTemplate'],
    documentation: 'https://postmarkapp.com/developer',
    examples: [],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, voice, and messaging channels.',
    module: '@platform/integrations/twilio',
    category: 'communication',
    configSchema: {
      twilioAccountSid: { type: 'string', required: true, description: 'Twilio Account SID', secret: true },
      twilioAuthToken: { type: 'string', required: true, description: 'Twilio Auth Token', secret: true },
      twilioPhoneNumber: { type: 'string', required: true, description: 'Twilio phone number for outbound', secret: false },
    },
    methods: ['messages.create', 'calls.create'],
    documentation: 'https://www.twilio.com/docs/api',
    examples: [],
  },
  {
    id: 'oauth',
    name: 'OAuth Providers',
    description: 'OAuth2 authentication with Google, GitHub, Microsoft, and other providers.',
    module: '@platform/integrations/oauth',
    category: 'identity',
    configSchema: {
      clientId: { type: 'string', required: true, description: 'OAuth client ID', secret: false },
      clientSecret: { type: 'string', required: true, description: 'OAuth client secret', secret: true },
      redirectUri: { type: 'string', required: true, description: 'OAuth redirect URI', secret: false },
    },
    methods: ['getAuthorizationUrl', 'exchangeCode', 'refreshToken', 'getUserInfo'],
    documentation: '',
    examples: [],
  },
  {
    id: 'webhooks',
    name: 'Outbound Webhooks',
    description: 'Deliver signed, idempotent webhook events to external systems with retry logic.',
    module: '@platform/integrations/webhooks',
    category: 'other',
    configSchema: {
      webhookSigningSecret: { type: 'string', required: false, description: 'Secret for HMAC signing of payloads', secret: true },
    },
    methods: ['deliver', 'deliverWithRetry'],
    documentation: '',
    examples: [],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post messages and notifications to Slack channels.',
    module: '@platform/integrations/slack',
    category: 'notifications',
    configSchema: {
      slackBotToken: { type: 'string', required: true, description: 'Slack Bot OAuth token', secret: true },
    },
    methods: ['postMessage', 'uploadFile'],
    documentation: 'https://api.slack.com/methods',
    examples: [],
  },
  {
    id: 's3',
    name: 'S3-compatible Storage',
    description: 'External object storage (AWS S3, Cloudflare R2, Backblaze B2).',
    module: '@platform/integrations/s3',
    category: 'storage',
    configSchema: {
      s3Endpoint: { type: 'string', required: true, description: 'S3 endpoint URL', secret: false },
      s3AccessKeyId: { type: 'string', required: true, description: 'Access key ID', secret: true },
      s3SecretAccessKey: { type: 'string', required: true, description: 'Secret access key', secret: true },
      s3Bucket: { type: 'string', required: true, description: 'Bucket name', secret: false },
    },
    methods: ['put', 'get', 'delete', 'listObjects', 'getPresignedUrl'],
    documentation: '',
    examples: [],
  },
];

export class IntegrationCatalog {
  list(): IntegrationDescriptor[] {
    return INTEGRATIONS;
  }

  get(id: string): IntegrationDescriptor | null {
    return INTEGRATIONS.find(i => i.id === id) ?? null;
  }

  getByCategory(category: string): IntegrationDescriptor[] {
    return INTEGRATIONS.filter(i => i.category === category);
  }

  validateUsage(integrationId: string, source: string): { valid: boolean; issues: string[] } {
    const integration = this.get(integrationId);
    if (!integration) {
      return { valid: false, issues: [`Unknown integration: ${integrationId}`] };
    }
    const issues: string[] = [];
    const importPattern = new RegExp(`from\\s+['"]${integration.module.replace(/\//g, '\\/')}['"]`);
    if (!importPattern.test(source)) {
      issues.push(`Integration ${integrationId} declared but not imported from ${integration.module}`);
    }
    for (const [key, config] of Object.entries(integration.configSchema)) {
      if (config.secret && config.required) {
        if (!source.includes(`ctx.secrets.${key}`) && !source.includes(`secrets.${key}`)) {
          issues.push(`Secret '${key}' required by ${integrationId} but not accessed via ctx.secrets`);
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
