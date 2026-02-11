export type AiFeature = 'lead_summary' | 'lead_score' | 'draft_followup' | 'next_best_action';

export type AiChannel = 'SMS' | 'EMAIL';
export type AiTone = 'FRIENDLY' | 'PROFESSIONAL' | 'DIRECT';

export type AiLeadContext = {
  id: string;
  dealershipId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  vehicleInterest: string | null;
  lastActivityAt: Date | null;
  source: { name: string } | null;
  activityCount: number;
  latestActivities: Array<{
    type: string;
    subject: string;
    createdAt: Date;
    body: string | null;
    outcome: string | null;
  }>;
};

export type LeadScoreResult = {
  score: number;
  reasons: string[];
};
