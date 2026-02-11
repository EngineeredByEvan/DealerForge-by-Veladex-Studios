'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Activity,
  ActivityType,
  Lead,
  createLeadActivity,
  fetchLeadActivities,
  fetchLeadById
} from '@/lib/api';

type LeadDetailPageProps = {
  params: {
    id: string;
  };
};

const ACTIVITY_TYPE_OPTIONS: ActivityType[] = [
  'CALL',
  'EMAIL',
  'SMS',
  'NOTE',
  'VISIT',
  'TEST_DRIVE',
  'OTHER'
];

export default function LeadDetailPage({ params }: LeadDetailPageProps): JSX.Element {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('CALL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [outcome, setOutcome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [leadResult, activityResult] = await Promise.all([
          fetchLeadById(params.id),
          fetchLeadActivities(params.id)
        ]);
        setLead(leadResult);
        setActivities(activityResult);
      } catch {
        setError('Unable to load lead details');
      }
    }

    void load();
  }, [params.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!subject.trim()) {
      setError('Subject is required to log an activity');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const created = await createLeadActivity(params.id, {
        type: activityType,
        subject,
        body,
        outcome
      });
      setActivities((previous) => [created, ...previous]);
      setLead((previous) =>
        previous
          ? {
              ...previous,
              lastActivityAt: created.createdAt
            }
          : previous
      );
      setSubject('');
      setBody('');
      setOutcome('');
      setActivityType('CALL');
    } catch {
      setError('Unable to save activity');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !lead) {
    return <main>{error}</main>;
  }

  if (!lead) {
    return <main>Loading lead...</main>;
  }

  return (
    <main>
      <h1>Lead Detail</h1>
      {error ? <p>{error}</p> : null}
      <p>ID: {lead.id}</p>
      <p>Name: {`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unknown'}</p>
      <p>Status: {lead.status}</p>
      <p>Email: {lead.email ?? '—'}</p>
      <p>Phone: {lead.phone ?? '—'}</p>
      <p>Source: {lead.source?.name ?? '—'}</p>
      <p>Vehicle interest: {lead.vehicleInterest ?? '—'}</p>
      <p>Assigned to: {lead.assignedToUserId ?? 'Unassigned'}</p>
      <p>Last activity: {lead.lastActivityAt ?? '—'}</p>

      <section>
        <h2>Timeline</h2>
        {activities.length === 0 ? <p>No activities logged yet.</p> : null}
        <ul>
          {activities.map((activity) => (
            <li key={activity.id}>
              <strong>{activity.type}</strong> — {activity.subject}
              <br />
              <small>
                {new Date(activity.createdAt).toLocaleString()} by{' '}
                {activity.createdByUser
                  ? `${activity.createdByUser.firstName} ${activity.createdByUser.lastName}`
                  : 'Unknown user'}
              </small>
              {activity.body ? <p>{activity.body}</p> : null}
              {activity.outcome ? <p>Outcome: {activity.outcome}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Log Activity</h2>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="activityType">Type</label>
          <select
            id="activityType"
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as ActivityType)}
          >
            {ACTIVITY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />

          <label htmlFor="body">Body</label>
          <textarea id="body" value={body} onChange={(event) => setBody(event.target.value)} />

          <label htmlFor="outcome">Outcome</label>
          <input
            id="outcome"
            type="text"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          />

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Log Activity'}
          </button>
        </form>
      </section>

      <section>
        <h2>Tasks</h2>
        <p>Placeholder: upcoming and completed tasks for this lead.</p>
      </section>

      <section>
        <h2>AI Panel</h2>
        <p>Placeholder: lead summary, score, and next best action.</p>
      </section>
    </main>
  );
}
