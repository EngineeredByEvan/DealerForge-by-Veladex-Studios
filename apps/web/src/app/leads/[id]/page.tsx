'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Activity,
  ActivityType,
  Lead,
  Task,
  createLeadActivity,
  createTask,
  fetchLeadActivities,
  fetchLeadById,
  fetchTasks
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [leadResult, activityResult, taskResult] = await Promise.all([
          fetchLeadById(params.id),
          fetchLeadActivities(params.id),
          fetchTasks({ leadId: params.id })
        ]);
        setLead(leadResult);
        setActivities(activityResult);
        setTasks(taskResult);
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


  async function handleTaskCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!taskTitle.trim()) {
      setError('Task title is required');
      return;
    }

    try {
      setTaskSubmitting(true);
      setError(null);
      const created = await createTask({
        title: taskTitle,
        dueAt: taskDueAt || undefined,
        leadId: params.id
      });
      setTasks((previous) => [created, ...previous]);
      setTaskTitle('');
      setTaskDueAt('');
    } catch {
      setError('Unable to create lead task');
    } finally {
      setTaskSubmitting(false);
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
        <form onSubmit={(event) => void handleTaskCreate(event)}>
          <label htmlFor="taskTitle">Task title</label>
          <input
            id="taskTitle"
            type="text"
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            required
          />

          <label htmlFor="taskDueAt">Due date/time (ISO)</label>
          <input
            id="taskDueAt"
            type="text"
            placeholder="2026-02-01T15:00:00.000Z"
            value={taskDueAt}
            onChange={(event) => setTaskDueAt(event.target.value)}
          />

          <button type="submit" disabled={taskSubmitting}>
            {taskSubmitting ? 'Saving task...' : 'Create Task'}
          </button>
        </form>

        {tasks.length === 0 ? <p>No tasks for this lead yet.</p> : null}
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong> — {task.status}
              <br />
              <small>Due: {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}</small>
              {task.description ? <p>{task.description}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>AI Panel</h2>
        <p>Placeholder: lead summary, score, and next best action.</p>
      </section>
    </main>
  );
}
