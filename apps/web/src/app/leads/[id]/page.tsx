'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AiPanel } from '@/components/leads/ai-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
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
  sendMessage,
  sendSmsMessage
} from '@/lib/api';

type LeadDetailPageProps = {
  params: {
    id: string;
  };
};

type ActiveTab = 'timeline' | 'messages' | 'calls' | 'appointments';
type TimelineType = 'SMS' | 'EMAIL' | 'CALL' | 'NOTE' | 'APPOINTMENT' | 'TASK';

type TimelineItem = {
  id: string;
  type: TimelineType;
  direction?: 'INBOUND' | 'OUTBOUND';
  occurredAt: string;
  title: string;
  body?: string;
  channel?: string;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (dayStart.getTime() === today.getTime()) return time;
  if (dayStart.getTime() === yesterday.getTime()) return `Yesterday • ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${time}`;
}

export default function LeadDetailPage({ params }: LeadDetailPageProps): JSX.Element {
  const { push } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');
  const [newestFirst, setNewestFirst] = useState(true);

  const [composeChannel, setComposeChannel] = useState<'SMS' | 'EMAIL' | 'NOTE'>('SMS');
  const [composeBody, setComposeBody] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeSubmitting, setComposeSubmitting] = useState(false);

  const [callDurationSec, setCallDurationSec] = useState(300);
  const [callOutcome, setCallOutcome] = useState('Connected');
  const [callNotes, setCallNotes] = useState('');
  const [callSubmitting, setCallSubmitting] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  const [appointmentStartAt, setAppointmentStartAt] = useState('');
  const [appointmentEndAt, setAppointmentEndAt] = useState('');
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
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
        setError(null);
      } catch {
        setError('Unable to load lead details');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [params.id]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const messageItems: TimelineItem[] = messages.map((message) => ({
      id: `message-${message.id}`,
      type: message.channel,
      direction: message.direction,
      occurredAt: message.createdAt,
      title: `${message.channel} ${message.direction === 'INBOUND' ? 'received' : 'sent'}`,
      body: message.body,
      channel: message.status
    }));

    const activityItems: TimelineItem[] = activities.map((activity) => ({
      id: `activity-${activity.id}`,
      type: activity.type === 'EMAIL' || activity.type === 'SMS' || activity.type === 'CALL' || activity.type === 'NOTE' ? activity.type : 'NOTE',
      occurredAt: activity.createdAt,
      title: activity.subject,
      body: activity.body ?? activity.outcome ?? undefined
    }));

    const taskItems: TimelineItem[] = tasks.map((task) => ({
      id: `task-${task.id}`,
      type: 'TASK',
      occurredAt: task.createdAt,
      title: task.title,
      body: `Status: ${task.status}${task.dueAt ? ` • Due ${formatDateTime(task.dueAt)}` : ''}`
    }));

    const appointmentItems: TimelineItem[] = appointments.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      type: 'APPOINTMENT',
      occurredAt: appointment.start_at,
      title: `Appointment ${appointment.status.toLowerCase()}`,
      body: appointment.note ?? undefined
    }));

    const combined = [...messageItems, ...activityItems, ...taskItems, ...appointmentItems];
    return combined.sort((a, b) => {
      const first = new Date(a.occurredAt).getTime();
      const second = new Date(b.occurredAt).getTime();
      return newestFirst ? second - first : first - second;
    });
  }, [activities, appointments, messages, newestFirst, tasks]);

  const messageThread = useMemo(
    () => messages.filter((item) => item.channel === 'SMS' || item.channel === 'EMAIL').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  const callItems = useMemo(
    () => messages.filter((item) => item.channel === 'CALL').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [messages]
  );

  const appointmentItems = useMemo(
    () => [...appointments].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()),
    [appointments]
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

      if (composeChannel === 'SMS') {
        const optimisticId = `optimistic-${Date.now()}`;
        setMessages((previous) => [{ id: optimisticId, dealershipId: lead?.dealershipId ?? '', threadId: '', channel: 'SMS', direction: 'OUTBOUND', body: composeBody, status: 'QUEUED', sentAt: null, actorUserId: null, providerMessageId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...previous]);
        const created = await sendSmsMessage(params.id, { body: composeBody });
        setMessages((previous) => [created, ...previous.filter((msg) => msg.id !== optimisticId)]);
      } else {
        const created = await sendMessage(params.id, {
          channel: composeChannel,
          body: composeBody,
          subject: composeSubject || undefined
        });
        setMessages((previous) => [created, ...previous]);
      }

      setComposeBody('');
      setComposeSubject('');
      push(`${composeChannel} sent`);
    } catch {
      setError(`Unable to send ${composeChannel.toLowerCase()}`);
      push(`Unable to send ${composeChannel.toLowerCase()}`);
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
      push('Call logged');
    } catch {
      setError('Unable to log call');
      push('Unable to log call');
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
      push('Task created');
    } catch {
      setError('Unable to create lead task');
      push('Unable to create lead task');
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
      push('Appointment created');
    } catch {
      setError('Unable to create lead appointment');
      push('Unable to create lead appointment');
    } finally {
      setAppointmentSubmitting(false);
    }
  }

  if (loading) return <main className="lead-detail-loading">Loading lead...</main>;
  if (error && !lead) return <main>{error}</main>;
  if (!lead) return <main>Lead not found</main>;

  const leadName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unknown';
  const openTasks = tasks.filter((task) => task.status === 'OPEN').length;

  return (
    <main className="lead-detail-page">
      <div className="lead-detail-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>{leadName}</h1>
          <p className="page-subtitle">Lead detail and communications</p>
        </div>
        <div className="lead-chip-row">
          <Badge>{lead.status}</Badge>
          <Badge>{lead.source?.name ?? 'No source'}</Badge>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="lead-detail-grid">
        <section className="lead-main-column">
          <Card>
            <div className="lead-section-head">
              <h2 className="section-title" style={{ marginBottom: 0 }}>Activity timeline</h2>
              <Button variant="ghost" onClick={() => setNewestFirst((prev) => !prev)}>
                {newestFirst ? 'Newest first' : 'Oldest first'}
              </Button>
            </div>

            <div className="lead-tabs">
              <Button variant={activeTab === 'timeline' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('timeline')}>Timeline</Button>
              <Button variant={activeTab === 'messages' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('messages')}>Messages</Button>
              <Button variant={activeTab === 'calls' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('calls')}>Calls</Button>
              <Button variant={activeTab === 'appointments' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('appointments')}>Appointments</Button>
            </div>

            {activeTab === 'timeline' ? (
              timeline.length === 0 ? <p className="page-subtitle">No activity yet.</p> : (
                <div className="timeline-list">
                  {timeline.map((item) => (
                    <details key={item.id} className="timeline-item" open>
                      <summary>
                        <div>
                          <span className="timeline-icon">{item.type}</span>
                          <strong>{item.title}</strong>
                        </div>
                        <small>{formatDateTime(item.occurredAt)}</small>
                      </summary>
                      {item.body ? <p>{item.body}</p> : null}
                      {item.direction || item.channel ? <small className="page-subtitle">{item.direction ?? ''} {item.channel ? `• ${item.channel}` : ''}</small> : null}
                    </details>
                  ))}
                </div>
              )
            ) : null}

            {activeTab === 'messages' ? (
              messageThread.length === 0 ? <p className="page-subtitle">No messages yet.</p> : (
                <div className="message-thread">
                  {messageThread.map((message) => (
                    <div key={message.id} className={`message-bubble ${message.direction === 'INBOUND' ? 'inbound' : 'outbound'}`}>
                      <small>{message.channel} • {formatDateTime(message.createdAt)}</small>
                      <p>{message.body}</p>
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {activeTab === 'calls' ? (
              callItems.length === 0 ? <p className="page-subtitle">No calls yet.</p> : (
                <div className="timeline-list">
                  {callItems.map((call) => (
                    <div key={call.id} className="timeline-item static">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{call.callOutcome ?? 'Call logged'}</strong>
                        <small>{formatDateTime(call.createdAt)}</small>
                      </div>
                      <p>{call.body}</p>
                      <small className="page-subtitle">Duration: {call.callDurationSec ?? 0}s • {call.status}</small>
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {activeTab === 'appointments' ? (
              appointmentItems.length === 0 ? <p className="page-subtitle">No appointments yet.</p> : (
                <div className="timeline-list">
                  {appointmentItems.map((appointment) => (
                    <div key={appointment.id} className="timeline-item static">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{appointment.status}</strong>
                        <small>{formatDateTime(appointment.start_at)}</small>
                      </div>
                      <p>{appointment.note ?? 'No notes'}</p>
                      <small className="page-subtitle">Ends {formatDateTime(appointment.end_at)}</small>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </Card>

          <Card>
            <h2 className="section-title">Log activity</h2>
            <div className="lead-actions-grid">
              <form onSubmit={handleComposeSubmit} className="lead-form-stack">
                <strong>Compose message</strong>
                <Select value={composeChannel} onChange={(event) => setComposeChannel(event.target.value as 'SMS' | 'EMAIL' | 'NOTE')}>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="NOTE">Note</option>
                </Select>
                <Select
                  onChange={(event) => {
                    const template = templates.find((item) => item.id === event.target.value);
                    if (!template || template.channel !== composeChannel) return;
                    setComposeBody(template.body);
                    setComposeSubject(template.subject ?? '');
                  }}
                  defaultValue=""
                >
                  <option value="">Use template (optional)</option>
                  {templates.filter((template) => template.channel === composeChannel).map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </Select>
                {composeChannel === 'EMAIL' ? <Input value={composeSubject} onChange={(event) => setComposeSubject(event.target.value)} placeholder="Subject" /> : null}
                <Textarea value={composeBody} onChange={(event) => setComposeBody(event.target.value)} rows={4} placeholder={`Write ${composeChannel.toLowerCase()}...`} />
                <Button type="submit" disabled={composeSubmitting || (composeChannel === 'SMS' && !lead.phone)}>{composeSubmitting ? 'Sending...' : composeChannel === 'SMS' && !lead.phone ? 'Lead missing phone number' : `Send ${composeChannel}`}</Button>
              </form>

              <form onSubmit={handleCallLogSubmit} className="lead-form-stack">
                <strong>Log call</strong>
                <Input type="number" min={0} value={callDurationSec} onChange={(event) => setCallDurationSec(Number(event.target.value))} placeholder="Duration seconds" />
                <Input value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)} placeholder="Outcome" />
                <Textarea value={callNotes} onChange={(event) => setCallNotes(event.target.value)} rows={3} placeholder="Call notes" />
                <Button type="submit" disabled={callSubmitting}>{callSubmitting ? 'Logging...' : 'Log call'}</Button>
              </form>

              <form onSubmit={handleTaskCreate} className="lead-form-stack">
                <strong>Add task</strong>
                <Input placeholder="Task title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
                <Input type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} />
                <Button type="submit" disabled={taskSubmitting}>{taskSubmitting ? 'Creating task...' : 'Create task'}</Button>
              </form>

              <form onSubmit={handleAppointmentCreate} className="lead-form-stack">
                <strong>Book appointment</strong>
                <Input type="datetime-local" value={appointmentStartAt} onChange={(event) => setAppointmentStartAt(event.target.value)} />
                <Input type="datetime-local" value={appointmentEndAt} onChange={(event) => setAppointmentEndAt(event.target.value)} />
                <Button type="submit" disabled={appointmentSubmitting}>{appointmentSubmitting ? 'Scheduling...' : 'Create appointment'}</Button>
              </form>
            </div>
          </Card>
        </section>

        <aside className="lead-side-column">
          <Card>
            <h2 className="section-title">Lead summary</h2>
            <div className="lead-summary-list">
              <p><strong>Status:</strong> {lead.status}</p>
              <p><strong>Source:</strong> {lead.source?.name ?? '—'}</p>
              <p><strong>Assigned:</strong> {lead.assignedToUserId ?? 'Unassigned'}</p>
              <p><strong>Vehicle:</strong> {lead.vehicleInterest ?? '—'}</p>
              <p><strong>Phone:</strong> {lead.phone ?? '—'}</p>
              <p><strong>Email:</strong> {lead.email ?? '—'}</p>
              <p><strong>Created:</strong> {formatDateTime(lead.createdAt)}</p>
            </div>
            <div className="lead-tabs" style={{ marginTop: 10 }}>
              <Button variant="secondary">Call</Button>
              <Button variant="secondary">Text</Button>
              <Button variant="secondary">Email</Button>
            </div>
          </Card>

          <Card>
            <h2 className="section-title">Next steps</h2>
            <p className="page-subtitle">Open tasks: {openTasks}</p>
            {tasks.slice(0, 4).map((task) => (
              <div key={task.id} className="timeline-item static">
                <strong>{task.title}</strong>
                <small className="page-subtitle">{task.status}{task.dueAt ? ` • ${formatDateTime(task.dueAt)}` : ''}</small>
              </div>
            ))}
          </Card>

          <AiPanel leadId={lead.id} />
        </aside>
      </div>
    </main>
  );
}
