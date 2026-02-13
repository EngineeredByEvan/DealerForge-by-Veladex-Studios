import { Injectable } from '@nestjs/common';
import { redactName, redactText } from '../ai.safety';
import { AiChannel, AiLeadContext, AiNextBestActionResult, AiTone, LeadScoreResult } from '../ai.types';
import { AiProvider } from './ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  async generateSummary(context: AiLeadContext): Promise<string> {
    const name = redactName(context.firstName, context.lastName);
    const interest = context.vehicleInterest ? redactText(context.vehicleInterest) : 'unspecified vehicle';
    const recentActivity = context.latestActivities[0]
      ? `${context.latestActivities[0].type}: ${redactText(context.latestActivities[0].subject)}`
      : 'no recent activities';

    const nextStep = await this.generateNextBestAction(context);
    return `${name} is currently ${context.status}. Interested in ${interest}. Latest timeline item: ${recentActivity}. Suggested next step: ${nextStep.action}.`;
  }

  async generateScore(context: AiLeadContext): Promise<LeadScoreResult> {
    let score = 30;
    const reasons: string[] = [];

    if (context.vehicleInterest) {
      score += 20;
      reasons.push('Vehicle interest captured');
    }

    if (context.email || context.phone) {
      score += 15;
      reasons.push('Contact method available');
    }

    if (context.activityCount >= 3) {
      score += 20;
      reasons.push('Active conversation history');
    }

    if (['QUALIFIED', 'APPOINTMENT_SET', 'NEGOTIATING'].includes(context.status)) {
      score += 25;
      reasons.push(`Lead status indicates buying intent (${context.status})`);
    }

    if (context.status === 'LOST') {
      score = 10;
      reasons.push('Lead marked as lost');
    }

    return { score: Math.min(100, score), reasons };
  }

  async generateDraft(
    context: AiLeadContext,
    channel: AiChannel,
    tone: AiTone,
    instruction?: string
  ): Promise<{ channel: AiChannel; tone: AiTone; message: string }> {
    const greeting = channel === 'SMS' ? 'Hi' : 'Hello';
    const firstName = context.firstName?.trim() || 'there';
    const vehicle = context.vehicleInterest ? redactText(context.vehicleInterest) : 'a vehicle you asked about';

    const tonePhrase =
      tone === 'DIRECT'
        ? 'Can we lock in a time to connect today?'
        : tone === 'PROFESSIONAL'
          ? 'Please let me know a convenient time to continue your purchase planning.'
          : 'Would you be open to a quick chat today?';

    const customInstruction = instruction ? ` ${redactText(instruction)}` : '';

    return {
      channel,
      tone,
      message: `${greeting} ${firstName}, thanks again for your interest in ${vehicle}. I can share availability and payment options for you.${customInstruction} ${tonePhrase}`
    };
  }

  async generateNextBestAction(context: AiLeadContext): Promise<AiNextBestActionResult> {
    if (!context.phone && context.email) {
      return {
        action: 'Send email with availability and pricing options',
        rationale: 'Lead has email but no phone, so email is the best reachable channel.'
      };
    }

    if (context.status === 'APPOINTMENT_SET') {
      return {
        action: 'Confirm appointment and send reminder',
        rationale: 'Lead is appointment-set and should be protected from no-show risk.'
      };
    }

    if (context.activityCount === 0) {
      return {
        action: 'Call now to establish first contact',
        rationale: 'No activity exists yet, so immediate first-touch outreach is highest leverage.'
      };
    }

    return {
      action: 'Offer payment options and book a dealership visit',
      rationale: 'Lead has engagement history and should be moved toward an in-person commitment.'
    };
  }
}
