import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  appName: z.string(),
  authTypes: z.array(z.enum(['sign_in', 'sign_up', 'forgot_password', 'reset_password', 'verify_email'])),
  designTokens: z.object({ primaryColor: z.string(), fontFamily: z.string(), borderRadius: z.string() }),
  sdkNamespace: z.string(),
});

const OutputSchema = z.object({
  pages: z.array(z.object({
    type: z.string(),
    path: z.string(),
    componentCode: z.string(),
  })),
  authLayoutCode: z.string(),
  reasoning: z.string(),
});

export const authPagesPrompt = definePrompt({
  id: 'ui-generation.auth-pages',
  version: '1.0.0',
  description: 'Generate authentication pages: sign-in, sign-up, forgot password, etc.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You generate authentication pages for a React application.

Each page uses the platform SDK's auth client:
- signIn({ email, password })
- signUp({ email, password, name })
- requestPasswordReset({ email })
- resetPassword({ token, newPassword })

Design: centered card on full-screen background; app logo + name at top.
Forms: react-hook-form + zod; proper error messages; loading states.
After sign-in: redirect to /
After sign-up: redirect to / or email verification
Accessible: labels, autocomplete attributes, keyboard navigation.
Tailwind + TypeScript strict.`,
  userPromptTemplate: `App: {{appName}}
SDK namespace: {{sdkNamespace}}
Pages to generate: {{authTypes.join ", "}}
Design: primary={{designTokens.primaryColor}}, font={{designTokens.fontFamily}}, radius={{designTokens.borderRadius}}

Generate the auth pages and shared auth layout.`,
  tests: [
    {
      description: 'Generates sign-in page',
      input: {
        appName: 'CRM',
        sdkNamespace: 'crm',
        authTypes: ['sign_in', 'sign_up'],
        designTokens: { primaryColor: '#3B82F6', fontFamily: 'Inter', borderRadius: '0.375rem' },
      },
      assertions: [
        { path: 'pages.length', equals: 2 },
      ],
    },
  ],
});
