'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Appointment,
  CommunicationTemplate,
  Lead,
  Message,
  Task,
  createAppointment,
  createOrGetThread,
  createTask,
  fetchAppointments,
  fetchLeadActivities,
  fetchLeadById,
  fetchMessagesByLead,
  fetchTasks,
  fetchTemplates,
  logCall,
  sendSmsMessage
} from '@/lib/api';
import { AiPanel } from '@/components/leads/ai-panel';

type LeadDetailPageProps = {
  params: {
    id: string;
  };
};

type TimelineItem =
  | { kind: 'activity'; id: string; createdAt: string; payload: Activity }
  | { kind: 'message'; id: string; createdAt: string; payload: Message };

export default function LeadDetailPage({ params }: LeadDetailPageProps): JSX.Element {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentStartAt, setAppointmentStartAt] = useState('');
  const [appointmentEndAt, setAppointmentEndAt] = useState('');
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);
    const [composeBody, setComposeBody] = useState('');
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(300);
  const [callOutcome, setCallOutcome] = useState('Connected - follow up requested');
  const [callNotes, setCallNotes] = useState('');
  const [callSubmitting, setCallSubmitting] = useState(false);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [leadResult, activityResult, messageResult, taskResult, appointmentResult, templateResult] = await Promise.all([
          fetchLeadById(params.id),
          fetchLeadActivities(params.id),
          fetchMessagesByLead(params.id),
          fetchTasks({ leadId: params.id }),
          fetchAppointments(),
          fetchTemplates()
        ]);
        await createOrGetThread(params.id);
        setLead(leadResult);
        setActivities(activityResult);
        setMessages(messageResult);
        setTasks(taskResult);
        setAppointments(appointmentResult.filter((appointment) => appointment.lead_id === params.id));
        setTemplates(templateResult);
      } catch {
        setError('Unable to load lead details');
      }
    }

    void load();
  }, [params.id]);

  const timeline = useMemo<TimelineItem[]>(
    () =>
      [
        ...activities.map((activity) => ({ kind: 'activity' as const, id: `activity-${activity.id}`, createdAt: activity.createdAt, payload: activity })),
        ...messages.map((message) => ({ kind: 'message' as const, id: `message-${message.id}`, createdAt: message.createdAt, payload: message }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activities, messages]
  );

  async function handleComposeSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!composeBody.trim()) {
      setError('Message body is required');
      return;
    }

    try {
      setComposeSubmitting(true);
      setError(null);
      const optimisticId = `optimistic-${Date.now()}`;
      setMessages((previous) => [{ id: optimisticId, dealershipId: lead?.dealershipId ?? '', threadId: '', channel: 'SMS', direction: 'OUTBOUND', body: composeBody, status: 'QUEUED', sentAt: null, actorUserId: null, providerMessageId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...previous]);
      const created = await sendSmsMessage(params.id, { body: composeBody });
      setMessages((previous) => [created, ...previous.filter((msg) => msg.id !== optimisticId)]);
      setComposeBody('');
    } catch {
      setError('Unable to send message');
    } finally {
      setComposeSubmitting(false);
    }
  }

  async function handleCallLogSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    try {
      setCallSubmitting(true);
      setError(null);
      const created = await logCall(params.id, {
        durationSec: callDurationSec,
        outcome: callOutcome,
        body: callNotes
      });
      setMessages((previous) => [created, ...previous]);
      setCallNotes('');
    } catch {
      setError('Unable to log call');
    } finally {
      setCallSubmitting(false);
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

  async function handleAppointmentCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    try {
      setAppointmentSubmitting(true);
      setError(null);
      const created = await createAppointment({
        start_at: appointmentStartAt,
        end_at: appointmentEndAt,
        lead_id: params.id
      });
      setAppointments((previous) => [created, ...previous]);
      setAppointmentStartAt('');
      setAppointmentEndAt('');
    } catch {
      setError('Unable to create lead appointment');
    } finally {
      setAppointmentSubmitting(false);
    }
  }

  if (error && !lead) return <main>{error}</main>;
  if (!lead) return <main>Loading lead...</main>;

  return (
    <main>
      <h1>Lead Detail</h1>
      {error ? <p>{error}</p> : null}
      <p>Name: {`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unknown'}</p>
      <p>Status: {lead.status}</p>

      <AiPanel leadId={lead.id} />

      <section>
        <h2>Activity timeline</h2>
        {timeline.length === 0 ? <p>No timeline items yet.</p> : null}
        <ul>
          {timeline.map((item) => (
            <li key={item.id}>
              {item.kind === 'message' ? (
                <>
                  <strong>{item.payload.channel}</strong> ({item.payload.direction}) — {item.payload.body}
                  <br />
                  <small>
                    {new Date(item.createdAt).toLocaleString()} <span style={{ marginLeft: 6, padding: '2px 8px', border: '1px solid #ccc', borderRadius: 999 }}>{item.payload.status}</span>
                  </small>
                </>
              ) : (
                <>
                  <strong>{item.payload.type}</strong> — {item.payload.subject}
                  <br />
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>SMS conversation</h2>
        <form onSubmit={handleComposeSubmit} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <label>
            Template
            <select
              onChange={(event) => {
                const template = templates.find((item) => item.id === event.target.value);
                if (!template) return;
                setComposeBody(template.body);
              }}
              defaultValue=""
            >
              <option value="">Pick template</option>
              {templates
                .filter((template) => template.channel === 'SMS')
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Message
            <textarea value={composeBody} onChange={(event) => setComposeBody(event.target.value)} rows={4} />
          </label>
          <button type="submit" disabled={composeSubmitting || !lead.phone}>{composeSubmitting ? 'Sending...' : lead.phone ? 'Send SMS' : 'Lead missing phone number'}</button>
        </form>
      </section>

      <section>
        <h2>Log call</h2>
        <form onSubmit={handleCallLogSubmit} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <label>
            Duration (seconds)
            <input type="number" min={0} value={callDurationSec} onChange={(event) => setCallDurationSec(Number(event.target.value))} />
          </label>
          <label>
            Outcome
            <input value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)} />
          </label>
          <label>
            Notes
            <textarea value={callNotes} onChange={(event) => setCallNotes(event.target.value)} rows={3} />
          </label>
          <button type="submit" disabled={callSubmitting}>{callSubmitting ? 'Logging...' : 'Log call'}</button>
        </form>
      </section>

      <section>
        <h2 id="quick-task">Quick add task</h2>
        <form onSubmit={handleTaskCreate} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input placeholder="Task title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
          <input type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} />
          <button type="submit" disabled={taskSubmitting}>{taskSubmitting ? 'Creating task...' : 'Create task'}</button>
        </form>
      </section>

      <section>
        <h2 id="quick-appointment">Quick add appointment</h2>
        <form onSubmit={handleAppointmentCreate} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input type="datetime-local" value={appointmentStartAt} onChange={(event) => setAppointmentStartAt(event.target.value)} />
          <input type="datetime-local" value={appointmentEndAt} onChange={(event) => setAppointmentEndAt(event.target.value)} />
          <button type="submit" disabled={appointmentSubmitting}>{appointmentSubmitting ? 'Scheduling...' : 'Create appointment'}</button>
        </form>
      </section>

      <section>
        <h2>Lead tasks</h2>
        <ul>{tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
      </section>

      <section>
        <h2>Lead appointments</h2>
        <ul>{appointments.map((appointment) => <li key={appointment.id}>{new Date(appointment.start_at).toLocaleString()}</li>)}</ul>
      </section>
    </main>
  );
}
