'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AiDraftFollowupResponse,
  AiLeadScoreResponse,
  AiNextBestActionResponse,
  AiSummaryResponse,
  draftLeadFollowup,
  fetchLeadNextBestAction,
  fetchLeadScore,
  fetchLeadSummary
} from '@/lib/api';

type AiPanelProps = {
  leadId: string;
  refreshKey?: number;
};

type Action = 'summary' | 'score' | 'draft' | 'next-action';

export function AiPanel({ leadId, refreshKey = 0 }: AiPanelProps): JSX.Element {
  const [loading, setLoading] = useState<Action | null>(null);
  const [active, setActive] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AiSummaryResponse | null>(null);
  const [score, setScore] = useState<AiLeadScoreResponse | null>(null);
  const [draft, setDraft] = useState<AiDraftFollowupResponse | null>(null);
  const [nextAction, setNextAction] = useState<AiNextBestActionResponse | null>(null);


  useEffect(() => {
    if (active === 'score') {
      void runAction('score');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, refreshKey]);

  async function runAction(action: Action): Promise<void> {
    setError(null);
    setLoading(action);
    setActive(action);

    try {
      if (action === 'summary') {
        setSummary(await fetchLeadSummary(leadId));
      } else if (action === 'score') {
        setScore(await fetchLeadScore(leadId));
      } else if (action === 'draft') {
        setDraft(await draftLeadFollowup({ leadId, channel: 'EMAIL', tone: 'FRIENDLY' }));
      } else {
        setNextAction(await fetchLeadNextBestAction(leadId));
      }
    } catch {
      setError('Unable to generate AI response right now.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section>
      <h2>AI Panel</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant={active === 'summary' ? 'secondary' : 'ghost'} type="button" onClick={() => void runAction('summary')} disabled={loading !== null}>
          🧠 {loading === 'summary' ? 'Generating...' : 'Lead Summary'}
        </Button>
        <Button variant={active === 'score' ? 'secondary' : 'ghost'} type="button" onClick={() => void runAction('score')} disabled={loading !== null}>
          📊 {loading === 'score' ? 'Scoring...' : 'Lead Score'}
        </Button>
        <Button variant={active === 'draft' ? 'secondary' : 'ghost'} type="button" onClick={() => void runAction('draft')} disabled={loading !== null}>
          ✍️ {loading === 'draft' ? 'Drafting...' : 'Draft Follow-up'}
        </Button>
        <Button variant={active === 'next-action' ? 'secondary' : 'ghost'} type="button" onClick={() => void runAction('next-action')} disabled={loading !== null}>
          🎯 {loading === 'next-action' ? 'Thinking...' : 'Next Best Action'}
        </Button>
      </div>

      {error ? <p>{error}</p> : null}

      {summary ? <article><h3>Summary</h3><p>{summary.summary}</p></article> : null}
      {score ? <article><h3>Score</h3><p>{score.score}/100</p><p>Last updated {new Date(score.updatedAt).toLocaleString()}</p><ul>{score.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></article> : null}
      {draft ? <article><h3>Draft Follow-up ({draft.channel})</h3><p>{draft.message}</p></article> : null}
      {nextAction ? <article><h3>Next Best Action</h3><p><strong>{nextAction.action}</strong></p><p>{nextAction.rationale}</p></article> : null}
    </section>
  );
}
