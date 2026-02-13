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
  LeadStatus,
  LeadType,
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
  sendSmsMessage,
  renderTemplatePreview,
  assignLead,
  fetchLeadTimeline,
  fetchLeadsOptions,
  fetchMe,
  updateLead,
  updateLeadStatus
} from '@/lib/api';
import { subscribeToDealershipChange } from '@/lib/dealership-store';

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
  const [visibleCount, setVisibleCount] = useState(5);
  const [timelineCursor, setTimelineCursor] = useState<string | null>(null);
  const [timelineServerItems, setTimelineServerItems] = useState<Array<{ id: string; type: string; occurredAt: string; payload: unknown }>>([]);
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [leadTypes, setLeadTypes] = useState<string[]>([]);
  const [myRole, setMyRole] = useState<string>('');
  const [aiRefreshKey, setAiRefreshKey] = useState(0);
  const [dealershipVersion, setDealershipVersion] = useState(0);

  const [composeChannel, setComposeChannel] = useState<'SMS' | 'EMAIL' | 'NOTE'>('SMS');
  const [composeBody, setComposeBody] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [templateHint, setTemplateHint] = useState<string>('');

  const [callDirection, setCallDirection] = useState<'INBOUND' | 'OUTBOUND'>('OUTBOUND');
  const [callDurationSec, setCallDurationSec] = useState<number | ''>('');
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
        const [leadResult, activityResult, messageResult, taskResult, appointmentResult, templateResult, optionsResult, meResult, timelineResult] = await Promise.all([
          fetchLeadById(params.id),
          fetchLeadActivities(params.id),
          fetchMessagesByLead(params.id),
          fetchTasks({ leadId: params.id }),
          fetchAppointments(),
          fetchTemplates(),
          fetchLeadsOptions(),
          fetchMe(),
          fetchLeadTimeline(params.id, 5)
        ]);
        await createOrGetThread(params.id);
        setLead(leadResult);
        setActivities(activityResult);
        setMessages(messageResult);
        setTasks(taskResult);
        setAppointments(appointmentResult.filter((appointment) => appointment.lead_id === params.id));
        setTemplates(templateResult);
        setStatuses(optionsResult.statuses);
        setLeadTypes(optionsResult.leadTypes);
        setTeamUsers(optionsResult.assignableUsers.map((user) => ({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim() || user.email, role: user.role })));
        setMyRole(meResult.dealerships.find((d) => d.dealershipId === leadResult.dealershipId)?.role ?? '');
        setTimelineServerItems(timelineResult.items);
        setTimelineCursor(timelineResult.nextCursor);
        setError(null);
      } catch {
        setError('Unable to load lead details');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [params.id, dealershipVersion]);


  useEffect(() => {
    const unsubscribe = subscribeToDealershipChange(() => {
      setAiRefreshKey((previous) => previous + 1);
      setDealershipVersion((previous) => previous + 1);
    });
    return unsubscribe;
  }, []);


  async function refreshMessages(): Promise<void> {
    setMessages(await fetchMessagesByLead(params.id));
  }

  async function applyTemplate(templateId: string): Promise<void> {
    const template = templates.find((item) => item.id === templateId);
    if (!template || template.channel !== composeChannel) return;

    const preview = await renderTemplatePreview({
      templateBody: template.body,
      templateSubject: template.subject ?? undefined,
      leadId: params.id
    });

    setComposeBody(preview.renderedBody);
    setComposeSubject(preview.renderedSubject ?? '');
    setTemplateHint(preview.missingFields.length > 0
      ? `Filled using lead data • missing: ${preview.missingFields.join(', ')}`
      : 'Filled using lead data');
  }

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
        const created = await sendSmsMessage(params.id, { body: composeBody });
        await refreshMessages();
        setLead(created.lead);
        setAiRefreshKey((previous) => previous + 1);
      } else {
        const created = await sendMessage(params.id, {
          channel: composeChannel,
          body: composeBody,
          subject: composeSubject || undefined
        });
        await refreshMessages();
        setLead(created.lead);
        setAiRefreshKey((previous) => previous + 1);
      }

      setComposeBody('');
      setComposeSubject('');
      setTemplateHint('');
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
        direction: callDirection,
        durationSec: callDurationSec === "" ? undefined : Number(callDurationSec),
        outcome: callOutcome,
        body: callNotes
      });
      await refreshMessages();
      setLead(created.lead);
      setAiRefreshKey((previous) => previous + 1);
      setCallNotes('');
      setCallDurationSec('');
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
      if (created.lead) setLead(created.lead);
      setAiRefreshKey((previous) => previous + 1);
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
                  {timeline.slice(0, visibleCount).map((item) => (
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
            {activeTab === 'timeline' && timeline.length > visibleCount ? <Button variant="ghost" onClick={() => setVisibleCount((v) => v + 5)}>Load more</Button> : null}

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
            {activeTab === 'timeline' && timeline.length > visibleCount ? <Button variant="ghost" onClick={() => setVisibleCount((v) => v + 5)}>Load more</Button> : null}

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
            {activeTab === 'timeline' && timeline.length > visibleCount ? <Button variant="ghost" onClick={() => setVisibleCount((v) => v + 5)}>Load more</Button> : null}

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
            {activeTab === 'timeline' && timeline.length > visibleCount ? <Button variant="ghost" onClick={() => setVisibleCount((v) => v + 5)}>Load more</Button> : null}
          </Card>

          <Card>
            <h2 className="section-title">Log activity</h2>
            <div className="lead-actions-grid">
              <form onSubmit={handleComposeSubmit} className="lead-form-stack">
                <strong>Compose message</strong>
                <Select value={composeChannel} onChange={(event) => { setComposeChannel(event.target.value as 'SMS' | 'EMAIL' | 'NOTE'); setTemplateHint(''); }}>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="NOTE">Note</option>
                </Select>
                <Select
                  onChange={(event) => {
                    void applyTemplate(event.target.value);
                  }}
                  defaultValue=""
                >
                  <option value="">Use template (optional)</option>
                  {templates.filter((template) => template.channel === composeChannel).map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </Select>
                {composeChannel === 'EMAIL' ? <Input value={composeSubject} onChange={(event) => setComposeSubject(event.target.value)} placeholder="Subject" /> : null}
                {templateHint ? <small className="page-subtitle">{templateHint}</small> : null}
                <Textarea value={composeBody} onChange={(event) => setComposeBody(event.target.value)} rows={4} placeholder={`Write ${composeChannel.toLowerCase()}...`} />
                <Button type="submit" disabled={composeSubmitting || (composeChannel === 'SMS' && !lead.phone)}>{composeSubmitting ? 'Sending...' : composeChannel === 'SMS' && !lead.phone ? 'Lead missing phone number' : `Send ${composeChannel}`}</Button>
              </form>

              <form onSubmit={handleCallLogSubmit} className="lead-form-stack">
                <strong>Log call</strong>
                <Input value={lead.phone ?? ''} readOnly placeholder="Lead phone" />
                <Select value={callDirection} onChange={(event) => setCallDirection(event.target.value as 'INBOUND' | 'OUTBOUND')}>
                  <option value="INBOUND">Inbound</option>
                  <option value="OUTBOUND">Outbound</option>
                </Select>
                <Select value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)}>
                  <option value="Connected">Connected</option>
                  <option value="Left VM">Left VM</option>
                  <option value="No answer">No answer</option>
                  <option value="Wrong number">Wrong number</option>
                  <option value="Follow-up needed">Follow-up needed</option>
                  <option value="Other">Other</option>
                </Select>
                <Input type="number" min={0} value={callDurationSec} onChange={(event) => setCallDurationSec(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Duration (seconds)" />
                <Textarea value={callNotes} onChange={(event) => setCallNotes(event.target.value)} rows={3} placeholder="Notes" />
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
              <p><strong>Status:</strong></p>
              <Select value={lead.status} onChange={async (event) => { const updated = await updateLeadStatus(lead.id, event.target.value as LeadStatus); setLead(updated); }}>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <p><strong>Lead Type:</strong></p>
              <Select value={lead.leadType ?? 'GENERAL'} onChange={async (event) => { const updated = await updateLead(lead.id, { leadType: event.target.value as LeadType }); setLead(updated); }}>
                {leadTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <p><strong>Salesperson:</strong></p>
              <Select value={lead.assignedToUserId ?? ''} onChange={async (event) => { const updated = await assignLead(lead.id, event.target.value || null); setLead(updated); }}>
                <option value="">Unassigned</option>
                {teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </Select>
              <p><strong>Lead Score:</strong> {lead.leadScore ?? 0}/100</p>
              <p><strong>Source:</strong> {lead.source?.name ?? '—'}</p>
              <p><strong>Vehicle:</strong> {lead.vehicleInterest ?? '—'}</p>
              <p><strong>Sold Date:</strong> {lead.soldAt ? formatDateTime(lead.soldAt) : '—'}</p>
              {['ADMIN', 'MANAGER', 'OPERATOR'].includes(myRole) ? <Button onClick={async () => { const updated = await updateLeadStatus(lead.id, 'SOLD'); setLead(updated); }}>Mark Sold</Button> : null}
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

          <AiPanel leadId={lead.id} refreshKey={aiRefreshKey} />
        </aside>
      </div>
    </main>
  );
}
