import { AiChannel, AiLeadContext, AiNextBestActionResult, AiTone, LeadScoreResult } from '../ai.types';

export interface AiProvider {
  generateSummary(context: AiLeadContext): Promise<string>;
  generateScore(context: AiLeadContext): Promise<LeadScoreResult>;
  generateDraft(
    context: AiLeadContext,
    channel: AiChannel,
    tone: AiTone,
    instruction?: string
  ): Promise<{ channel: AiChannel; tone: AiTone; message: string }>;
  generateNextBestAction(context: AiLeadContext): Promise<AiNextBestActionResult>;
}

export const AI_PROVIDER_TOKEN = Symbol('AI_PROVIDER_TOKEN');
