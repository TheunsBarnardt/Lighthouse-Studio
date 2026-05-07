import { z } from 'zod';

import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  conversationHistory: z.string(),
  briefDraftJson: z.string(),
  lastUserMessage: z.string(),
  turnNumber: z.number().int().min(1),
  templateContext: z.string().optional(),
});

const BriefUpdatesSchema = z.record(z.unknown());

const OutputSchema = z.object({
  response: z.string().min(1),
  briefUpdates: BriefUpdatesSchema,
  readyToGenerate: z.boolean(),
  suggestedFocusArea: z.string().optional(),
  reasoning: z.string(),
});

export const orchestratorPrompt = definePrompt({
  id: 'intent-capture/orchestrator',
  version: '1.0.0',
  description:
    'Orchestrates the intent capture conversation, updating the brief draft and guiding toward readiness',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.3,
    maxTokens: 2048,
  },
  systemPrompt: `You are an expert software requirements consultant helping a customer articulate their project vision.

Your role in each turn:
1. Respond conversationally to the user's latest message
2. Identify any new information for the brief
3. Ask at most ONE clarifying question per turn
4. Note which brief fields can be updated based on this turn
5. Assess if the brief is ready to finalize

Conversation principles:
- Be warm but efficient — this is a professional conversation
- Don't ask about things already clearly covered
- When scope is unclear, ask about the most important gap first
- After turn 10, start nudging toward "we have enough to start"
- After turn 20, gently mention the conversation limit

readyToGenerate: true when you believe the brief has sufficient detail.
briefUpdates: partial brief fields to update (e.g., { "title": "...", "goals": [...] })
suggestedFocusArea: the single most important thing to clarify next (or omit if ready)`,
  userPromptTemplate: ({
    conversationHistory,
    briefDraftJson,
    lastUserMessage,
    turnNumber,
    templateContext,
  }) =>
    `CONVERSATION HISTORY:
${conversationHistory}

CURRENT BRIEF DRAFT:
${briefDraftJson}

${templateContext ? `TEMPLATE CONTEXT:\n${templateContext}\n\n` : ''}LATEST USER MESSAGE:
${lastUserMessage}

TURN: ${String(turnNumber)}

Respond to the user and update the brief. Return JSON with:
- response: your conversational response (plain text, no JSON)
- briefUpdates: partial brief object with new/updated fields
- readyToGenerate: boolean
- suggestedFocusArea: string or undefined
- reasoning: internal reasoning about this turn`,
  tests: [
    {
      description: 'responds to opening message',
      input: {
        conversationHistory: '',
        briefDraftJson: '{}',
        lastUserMessage: 'I want to build a customer support ticketing system.',
        turnNumber: 1,
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should have non-empty response',
          check: (out: unknown) => (out as { response: string }).response.length > 20,
        },
        {
          type: 'custom',
          message: 'should not be ready on turn 1',
          check: (out: unknown) => !(out as { readyToGenerate: boolean }).readyToGenerate,
        },
      ],
    },
    {
      description: 'updates brief fields from user information',
      input: {
        conversationHistory:
          'User: I want to build a ticketing system.\nAssistant: Who will be using it?\n',
        briefDraftJson: '{ "title": "Ticketing System" }',
        lastUserMessage:
          'Our support agents and customers. We have about 20 agents and 5000 customers.',
        turnNumber: 2,
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should update brief with user info',
          check: (out: unknown) => {
            const updates = (out as { briefUpdates: Record<string, unknown> }).briefUpdates;
            return Object.keys(updates).length > 0;
          },
        },
      ],
    },
    {
      description: 'signals ready after comprehensive conversation',
      input: {
        conversationHistory: `User: CRM for small business\nAssistant: What features?\nUser: Contact tracking, deals, email logging\nAssistant: Who uses it?\nUser: 5 sales reps and a manager\nAssistant: Any integrations?\nUser: Gmail integration would be great but not required\nAssistant: What about scope?\nUser: Just the basics, we'll add more later`,
        briefDraftJson: JSON.stringify({
          title: 'Small Business CRM',
          summary: 'CRM for small sales team',
          goals: [
            {
              id: '1',
              description: 'Contact tracking',
              priority: 'must_have',
              acceptanceCriteria: ['Can create and edit contacts'],
            },
          ],
          targetUsers: [
            {
              id: '1',
              persona: 'Sales Rep',
              description: 'Sales representative',
              needs: ['track contacts'],
              painPoints: ['using spreadsheets'],
            },
          ],
          inScope: ['contact management', 'deal pipeline', 'email logging'],
          outOfScope: [],
        }),
        lastUserMessage: "I think we've covered the main points. What do you think?",
        turnNumber: 9,
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should be ready to generate',
          check: (out: unknown) => (out as { readyToGenerate: boolean }).readyToGenerate,
        },
      ],
    },
  ],
});

registerPrompt(orchestratorPrompt);
