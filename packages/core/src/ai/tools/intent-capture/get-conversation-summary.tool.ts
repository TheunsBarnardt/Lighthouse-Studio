import type { ArtifactRepositoryPort } from '@platform/ports-ai-artifacts';

import { ok, err } from 'neverthrow';
import { z } from 'zod';

import type { ConversationMessage } from '../../../services/ai/intent-capture/types.js';

import { NotFoundError, ValidationError } from '../../../errors.js';
import { INTENT_CAPTURE_PERMISSIONS } from '../../../services/ai/intent-capture/permissions.js';
import { defineTool } from '../../define-tool.js';

const SUMMARY_THRESHOLD_TURNS = 15;

export function createGetConversationSummaryTool(artifactRepo: ArtifactRepositoryPort) {
  return defineTool({
    id: 'intent-capture/get-conversation-summary',
    name: 'get_conversation_summary',
    description:
      'Returns a compressed summary of the conversation when it exceeds 15 turns. Use this instead of the full history to stay within context limits.',
    parameters: z.object({
      conversationArtifactId: z.string(),
    }),
    returns: z.object({
      summary: z.string(),
      turnCount: z.number(),
      needsSummary: z.boolean(),
      keyDecisions: z.array(z.string()),
    }),
    permissions: [INTENT_CAPTURE_PERMISSIONS.READ],
    async execute(ctx, params) {
      if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

      const found = await artifactRepo.findById(params.conversationArtifactId, ctx.workspaceId);
      if (found.isErr() || !found.value)
        return err(new NotFoundError('artifact', params.conversationArtifactId));

      const content = found.value.content as {
        messages?: ConversationMessage[];
        turnCount?: number;
        summary?: string;
        keyDecisions?: string[];
      };
      const messages = content.messages ?? [];
      const turnCount = content.turnCount ?? messages.length;
      const needsSummary = turnCount >= SUMMARY_THRESHOLD_TURNS;

      if (!needsSummary) {
        return ok({
          summary: messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n'),
          turnCount,
          needsSummary: false,
          keyDecisions: [],
        });
      }

      // Use cached summary if available
      const summary = content.summary ?? buildCompressedSummary(messages);
      const keyDecisions = content.keyDecisions ?? extractKeyDecisions(messages);

      return ok({ summary, turnCount, needsSummary: true, keyDecisions });
    },
  });
}

function buildCompressedSummary(messages: ConversationMessage[]): string {
  if (messages.length === 0) return 'No conversation yet.';

  // Take every other assistant message (key information exchanges)
  const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const summary = [
    `Conversation with ${String(messages.length)} turns. User described:`,
    ...userMessages
      .slice(0, 5)
      .map((m, i) => `${String(i + 1)}. ${m.substring(0, 150)}${m.length > 150 ? '...' : ''}`),
    messages.length > 5 ? `...and ${String(messages.length - 5)} more exchanges` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return summary;
}

function extractKeyDecisions(messages: ConversationMessage[]): string[] {
  // Extract decisions from messages (simple heuristic: messages containing action words)
  const decisionKeywords = ['decided', 'will', 'need', 'must', 'should', 'want', 'require'];
  return messages
    .filter((m) => m.role === 'user')
    .flatMap((m) => {
      const sentences = m.content.split(/[.!?]/);
      return sentences.filter((s) => decisionKeywords.some((kw) => s.toLowerCase().includes(kw)));
    })
    .slice(0, 5)
    .map((s) => s.trim())
    .filter(Boolean);
}
