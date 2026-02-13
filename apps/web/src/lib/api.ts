'use client';

import { clearActiveDealershipId, getActiveDealershipId, initializeDealershipStore, setActiveDealershipId } from './dealership-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const ACCESS_TOKEN_KEY = 'dealerforge_access_token';
const REFRESH_TOKEN_KEY = 'dealerforge_refresh_token';

export type PlatformRole = 'NONE' | 'OPERATOR' | 'ADMIN';

export type AuthMeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  isPlatformOperator: boolean;
  platformRole: PlatformRole;
  dealerships: { dealershipId: string; dealershipName: string; dealershipSlug: string; role: string }[];
};

export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

export type LeadType =
  | 'NEW_VEHICLE'
  | 'USED_VEHICLE'
  | 'SERVICE'
  | 'FINANCE'
  | 'GENERAL'
  | 'TRADE_IN'
  | 'PHONE_UP'
  | 'WALK_IN'
  | 'INTERNET'
  | 'OTHER';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'APPOINTMENT_SET'
  | 'NEGOTIATING'
  | 'SOLD'
  | 'LOST';

export type Lead = {
  id: string;
  dealershipId: string;
  status: LeadStatus;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  vehicleInterest: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToUserId?: string | null;
  assignedToUser?: { id: string; firstName: string; lastName: string; email: string } | null;
  soldByUserId?: string | null;
  soldAt?: string | null;
  leadType?: LeadType;
  leadScore?: number | null;
  leadScoreUpdatedAt?: string | null;
  source?: { id: string; name: string } | null;
};


export type LeadsMeta = {
  statuses: LeadStatus[];
  leadTypes: LeadType[];
  sources: Array<{ id: string; name: string }>;
};

export async function fetchLeadMeta(): Promise<LeadsMeta> {
  const response = await apiRequest('/meta/leads');
  if (!response.ok) throw new Error('Unable to fetch lead meta');
  return (await response.json()) as LeadsMeta;
}



export type LeadsOptions = {
  statuses: LeadStatus[];
  leadTypes: LeadType[];
  assignableUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'BDC' | 'SALES';
  }>;
};

export async function fetchLeadsOptions(): Promise<LeadsOptions> {
  const response = await apiRequest('/leads/options');
  if (!response.ok) throw new Error('Unable to fetch lead options');
  return (await response.json()) as LeadsOptions;
}

export type ActivityType = 'CALL' | 'EMAIL' | 'SMS' | 'NOTE' | 'VISIT' | 'TEST_DRIVE' | 'OTHER';

export type Activity = {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  outcome: string | null;
  createdByUserId: string;
  leadId: string;
  createdAt: string;
  updatedAt: string;
  createdByUser: { id: string; firstName: string; lastName: string; email: string } | null;
};

export type CreateActivityPayload = {
  type: ActivityType;
  subject: string;
  body?: string;
  outcome?: string;
};

export type LeadFilters = {
  status?: LeadStatus;
  assignedTo?: string;
  source?: string;
  q?: string;
  dateRange?: string;
};

export type CreateLeadPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  assignedToUserId?: string;
  vehicleInterest?: string;
  status?: LeadStatus;
  leadType?: LeadType;
  leadScore?: number;
};

export type UpdateLeadPayload = Partial<CreateLeadPayload> & { lastActivityAt?: string };

export function setTokens(tokens: { accessToken: string; refreshToken: string }): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearActiveDealershipId();
}

export function setSelectedDealershipId(dealershipId: string): void {
  setActiveDealershipId(dealershipId);
}

export function getSelectedDealershipId(): string | null {
  initializeDealershipStore();
  const dealershipId = getActiveDealershipId();
  return dealershipId || null;
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) throw new Error('Login failed');

  const payload: { accessToken: string; refreshToken: string } = await response.json();
  setTokens(payload);

  // ✅ bootstrap tenant selection right away
  const me = await fetchMe();
  const defaultId = getSelectedDealershipId() ?? me.dealerships[0]?.dealershipId ?? '';
  if (defaultId) setSelectedDealershipId(defaultId);
}


export async function fetchMe(): Promise<AuthMeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`
    }
  });

  if (!response.ok) {
    throw new Error('Unable to fetch user profile');
  }

  return (await response.json()) as AuthMeResponse;
}


export async function fetchTenantHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Health request failed');
  }

  return (await response.json()) as HealthResponse;
}

async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const dealershipId = getSelectedDealershipId();
  if (!dealershipId) {
    throw new Error('Please select a dealership to continue');
  }

  return fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'x-dealership-id': dealershipId,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {})
    }
  });
}

export async function apiWithTenant(path: string): Promise<Response> {
  return apiRequest(path);
}

export async function fetchLeads(filters?: LeadFilters): Promise<Lead[]> {
  const query = new URLSearchParams();
  if (filters?.status) query.set('status', filters.status);
  if (filters?.assignedTo) query.set('assignedTo', filters.assignedTo);
  if (filters?.source) query.set('source', filters.source);
  if (filters?.q) query.set('q', filters.q);
  if (filters?.dateRange) query.set('dateRange', filters.dateRange);

  const queryString = query.toString();
  const response = await apiRequest(`/leads${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error('Unable to fetch leads');
  }

  return (await response.json()) as Lead[];
}

export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  const response = await apiRequest('/leads', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to create lead');
  }

  return (await response.json()) as Lead;
}

export async function fetchLeadById(leadId: string): Promise<Lead> {
  const response = await apiRequest(`/leads/${leadId}`);

  if (!response.ok) {
    throw new Error('Unable to fetch lead');
  }

  return (await response.json()) as Lead;
}

export async function updateLead(leadId: string, payload: UpdateLeadPayload): Promise<Lead> {
  const response = await apiRequest(`/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to update lead');
  }

  return (await response.json()) as Lead;
}

export async function assignLead(leadId: string, assignedToUserId: string | null): Promise<Lead> {
  const response = await apiRequest(`/leads/${leadId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedToUserId })
  });

  if (!response.ok) {
    throw new Error('Unable to assign lead');
  }

  return (await response.json()) as Lead;
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<Lead> {
  const response = await apiRequest(`/leads/${leadId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error('Unable to update lead status');
  }

  return (await response.json()) as Lead;
}


export async function fetchLeadActivities(leadId: string): Promise<Activity[]> {
  const response = await apiRequest(`/leads/${leadId}/activities`);

  if (!response.ok) {
    throw new Error('Unable to fetch lead activities');
  }

  return (await response.json()) as Activity[];
}

export async function createLeadActivity(
  leadId: string,
  payload: CreateActivityPayload
): Promise<Activity> {
  const response = await apiRequest(`/leads/${leadId}/activities`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to create lead activity');
  }

  return (await response.json()) as Activity;
}





export type LeadTimelineResponse = {
  items: Array<{ id: string; type: string; occurredAt: string; payload: unknown }>;
  nextCursor: string | null;
};

export async function fetchLeadTimeline(leadId: string, limit = 5, cursor?: string): Promise<LeadTimelineResponse> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  const response = await apiRequest(`/leads/${leadId}/timeline?${query.toString()}`);
  if (!response.ok) throw new Error('Unable to fetch timeline');
  return (await response.json()) as LeadTimelineResponse;
}
export type MessageChannel = 'SMS' | 'EMAIL' | 'CALL' | 'NOTE';
export type MessageDirection = 'OUTBOUND' | 'INBOUND';

export type ConversationThread = {
  id: string;
  dealershipId: string;
  leadId: string;
  createdAt: string;
};

export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RECEIVED';

export type Message = {
  id: string;
  dealershipId: string;
  threadId: string;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  status: MessageStatus;
  sentAt: string | null;
  actorUserId: string | null;
  providerMessageId: string | null;
  callDurationSec?: number | null;
  callOutcome?: string | null;
  createdAt: string;
  updatedAt: string;
  actorUser?: { id: string; firstName: string; lastName: string; email: string } | null;
  thread?: { id: string; leadId: string };
};

export type CommunicationTemplate = {
  id: string;
  dealershipId: string;
  channel: MessageChannel;
  name: string;
  subject: string | null;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export async function createOrGetThread(leadId: string): Promise<ConversationThread> {
  const response = await apiRequest('/communications/threads', {
    method: 'POST',
    body: JSON.stringify({ leadId })
  });

  if (!response.ok) throw new Error('Unable to create thread');
  return (await response.json()) as ConversationThread;
}

export async function fetchMessagesByLead(leadId: string, channel?: MessageChannel): Promise<Message[]> {
  const query = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  const response = await apiRequest(`/leads/${leadId}/messages${query}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to fetch messages');
  return (await response.json()) as Message[];
}



export type RenderTemplateResponse = {
  renderedBody: string;
  renderedSubject: string;
  missingFields: string[];
};

export async function renderTemplatePreview(payload: { templateBody: string; templateSubject?: string; leadId: string }): Promise<RenderTemplateResponse> {
  const response = await apiRequest('/communications/templates/render', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to render template preview');
  return (await response.json()) as RenderTemplateResponse;
}

export async function sendSmsMessage(
  leadId: string,
  payload: { body: string; toPhone?: string; templateId?: string }
): Promise<{ message: Message; lead: Lead }> {
  const response = await apiRequest(`/communications/leads/${leadId}/messages/sms`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to send SMS message');
  return (await response.json()) as { message: Message; lead: Lead };
}

export async function sendMessage(
  leadId: string,
  payload: { channel: Extract<MessageChannel, 'SMS' | 'EMAIL' | 'NOTE'>; body: string; subject?: string }
): Promise<{ message: Message; lead: Lead }> {
  const response = await apiRequest(`/communications/leads/${leadId}/send`, {
    method: 'POST',
    body: JSON.stringify({ ...payload, direction: 'OUTBOUND' })
  });

  if (!response.ok) throw new Error('Unable to send message');
  return (await response.json()) as { message: Message; lead: Lead };
}

export async function logCall(
  leadId: string,
  payload: { direction?: MessageDirection; durationSec?: number; outcome: string; body?: string }
): Promise<{ message: Message; lead: Lead }> {
  const response = await apiRequest(`/communications/leads/${leadId}/calls`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to log call');
  return (await response.json()) as { message: Message; lead: Lead };
}

export async function fetchTemplates(): Promise<CommunicationTemplate[]> {
  const response = await apiRequest('/communications/templates');
  if (!response.ok) throw new Error('Unable to fetch templates');
  return (await response.json()) as CommunicationTemplate[];
}

export async function createTemplate(payload: {
  channel: MessageChannel;
  name: string;
  subject?: string;
  body: string;
}): Promise<CommunicationTemplate> {
  const response = await apiRequest('/communications/templates', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to create template');
  return (await response.json()) as CommunicationTemplate;
}

export async function updateTemplate(templateId: string, payload: Partial<{
  channel: MessageChannel;
  name: string;
  subject?: string;
  body: string;
}>): Promise<CommunicationTemplate> {
  const response = await apiRequest(`/communications/templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to update template');
  return (await response.json()) as CommunicationTemplate;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const response = await apiRequest(`/communications/templates/${templateId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Unable to delete template');
}



export async function bulkSendCommunication(payload: { channel: 'SMS' | 'EMAIL'; leadIds: string[]; templateId: string }) {
  const path = payload.channel === 'SMS' ? '/communications/bulk/sms' : '/communications/bulk/email';
  const response = await apiRequest(path, { method: 'POST', body: JSON.stringify({ leadIds: payload.leadIds, templateId: payload.templateId }) });
  if (!response.ok) throw new Error('Unable to send bulk communication');
  return (await response.json()) as { accepted: number; totalRequested: number };
}

export type ReportOverviewPeriod = {
  leads: number;
  appointments: number;
  shows: number;
  sold: number;
};

export type ReportOverviewResponse = {
  today: ReportOverviewPeriod;
  week: ReportOverviewPeriod;
  month: ReportOverviewPeriod;
};

export type ReportResponseTimeResponse = {
  averageMinutes: number | null;
  sampleSize: number;
};


export type ReportsFilters = {
  start: string;
  end: string;
  source?: string;
  assignedUser?: string;
  status?: string;
  leadType?: string;
};

export type ReportsSummary = {
  total_leads: number;
  appointments_set: number;
  appointments_showed: number;
  show_rate: number;
  appointment_rate: number;
  sold_count: number;
  close_rate: number;
};

export type ReportsBreakdownDimension = 'source' | 'assignedUser' | 'status';

export type ReportsBreakdownRow = ReportsSummary & {
  key: string;
};

export type ReportsTrendMetric = 'leads' | 'appointments' | 'sold';

export type ReportsTrendPoint = {
  period: string;
  value: number;
};

function toReportsQuery(filters: ReportsFilters): string {
  const query = new URLSearchParams();
  query.set('start', filters.start);
  query.set('end', filters.end);
  if (filters.source) query.set('source', filters.source);
  if (filters.assignedUser) query.set('assignedUser', filters.assignedUser);
  if (filters.status) query.set('status', filters.status);
  if (filters.leadType) query.set('leadType', filters.leadType);
  return query.toString();
}

export type TaskStatus = 'OPEN' | 'DONE' | 'SNOOZED' | 'CANCELED';

export type Task = {
  id: string;
  dealershipId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: string | null;
  assignedToUserId: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToUser: { id: string; firstName: string; lastName: string; email: string } | null;
  lead: { id: string; firstName: string | null; lastName: string | null; status: LeadStatus } | null;
};

export type TaskFilters = {
  status?: TaskStatus;
  assignedTo?: string;
  leadId?: string;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  dueAt?: string;
  assignedToUserId?: string;
  leadId?: string;
};

export type UpdateTaskPayload = Partial<CreateTaskPayload> & { status?: TaskStatus };

export async function fetchTasks(filters?: TaskFilters): Promise<Task[]> {
  const query = new URLSearchParams();
  if (filters?.status) query.set('status', filters.status);
  if (filters?.assignedTo) query.set('assignedTo', filters.assignedTo);
  if (filters?.leadId) query.set('leadId', filters.leadId);

  const response = await apiRequest(`/tasks${query.toString() ? `?${query.toString()}` : ''}`);

  if (!response.ok) {
    throw new Error('Unable to fetch tasks');
  }

  return (await response.json()) as Task[];
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const response = await apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to create task');
  }

  return (await response.json()) as Task;
}

export async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
  const response = await apiRequest(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to update task');
  }

  return (await response.json()) as Task;
}

export async function completeTask(taskId: string): Promise<Task> {
  const response = await apiRequest(`/tasks/${taskId}/complete`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error('Unable to complete task');
  }

  return (await response.json()) as Task;
}

export async function snoozeTask(taskId: string, dueAt: string): Promise<Task> {
  const response = await apiRequest(`/tasks/${taskId}/snooze`, {
    method: 'POST',
    body: JSON.stringify({ dueAt })
  });

  if (!response.ok) {
    throw new Error('Unable to snooze task');
  }

  return (await response.json()) as Task;
}

export type AppointmentStatus = 'SET' | 'CONFIRMED' | 'SHOWED' | 'NO_SHOW' | 'CANCELED';

export type Appointment = {
  id: string;
  dealershipId: string;
  status: AppointmentStatus;
  start_at: string;
  end_at: string;
  lead_id: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lead: { id: string; firstName: string | null; lastName: string | null; status: LeadStatus } | null;
};

export type AppointmentFilters = {
  range?: string;
};

export type CreateAppointmentPayload = {
  start_at: string;
  end_at: string;
  status?: AppointmentStatus;
  lead_id?: string;
  note?: string;
};

export type UpdateAppointmentPayload = Partial<CreateAppointmentPayload>;

export async function fetchAppointments(filters?: AppointmentFilters): Promise<Appointment[]> {
  const query = new URLSearchParams();
  if (filters?.range) query.set('range', filters.range);

  const response = await apiRequest(
    `/appointments${query.toString() ? `?${query.toString()}` : ''}`
  );

  if (!response.ok) {
    throw new Error('Unable to fetch appointments');
  }

  return (await response.json()) as Appointment[];
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<Appointment & { lead?: Lead | null }> {
  const response = await apiRequest('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to create appointment');
  }

  return (await response.json()) as Appointment & { lead?: Lead | null };
}

export async function updateAppointment(
  appointmentId: string,
  payload: UpdateAppointmentPayload
): Promise<Appointment> {
  const response = await apiRequest(`/appointments/${appointmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to update appointment');
  }

  return (await response.json()) as Appointment;
}

export async function confirmAppointment(appointmentId: string): Promise<Appointment> {
  const response = await apiRequest(`/appointments/${appointmentId}/confirm`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error('Unable to confirm appointment');
  }

  return (await response.json()) as Appointment;
}

export async function cancelAppointment(appointmentId: string): Promise<Appointment> {
  const response = await apiRequest(`/appointments/${appointmentId}/cancel`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error('Unable to cancel appointment');
  }

  return (await response.json()) as Appointment;
}


export async function fetchReportsSummary(filters: ReportsFilters): Promise<ReportsSummary> {
  const response = await apiRequest(`/reports/summary?${toReportsQuery(filters)}`);

  if (!response.ok) {
    throw new Error('Unable to fetch reports summary');
  }

  return (await response.json()) as ReportsSummary;
}

export async function fetchReportsBreakdown(
  dimension: ReportsBreakdownDimension,
  filters: ReportsFilters
): Promise<ReportsBreakdownRow[]> {
  const response = await apiRequest(`/reports/breakdown?dimension=${dimension}&${toReportsQuery(filters)}`);

  if (!response.ok) {
    throw new Error('Unable to fetch reports breakdown');
  }

  return (await response.json()) as ReportsBreakdownRow[];
}

export async function fetchReportsTrends(
  metric: ReportsTrendMetric,
  filters: ReportsFilters
): Promise<ReportsTrendPoint[]> {
  const response = await apiRequest(`/reports/trends?metric=${metric}&interval=day&${toReportsQuery(filters)}`);

  if (!response.ok) {
    throw new Error('Unable to fetch reports trends');
  }

  return (await response.json()) as ReportsTrendPoint[];
}

export type IntegrationProvider = 'GENERIC' | 'AUTOTRADER' | 'CARGURUS' | 'OEM_FORM' | 'REFERRAL';

export type Integration = {
  id: string;
  dealershipId: string;
  name: string;
  provider: IntegrationProvider;
  webhookSecret: string;
  config: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { events: number };
};

export type CreateIntegrationPayload = {
  name: string;
  provider: IntegrationProvider;
  webhookSecret?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
};

export type ImportCsvPayload = {
  csv: string;
  integrationId?: string;
  source?: string;
};

export async function fetchIntegrations(): Promise<Integration[]> {
  const response = await apiRequest('/integrations');

  if (!response.ok) {
    throw new Error('Unable to fetch integrations');
  }

  return (await response.json()) as Integration[];
}

export async function createIntegration(payload: CreateIntegrationPayload): Promise<Integration> {
  const response = await apiRequest('/integrations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to create integration');
  }

  return (await response.json()) as Integration;
}

export type CsvImportErrorItem = { field: string; message: string };

export type CsvImportFailure = {
  row: number;
  raw: Record<string, string>;
  errors: CsvImportErrorItem[];
};

export type CsvImportSuccess = {
  row: number;
  leadId: string;
  email?: string;
  phone?: string;
};

export type ImportCsvResult = {
  totalRows: number;
  successCount: number;
  failureCount: number;
  successes: CsvImportSuccess[];
  failures: CsvImportFailure[];
};

export async function importIntegrationsCsv(
  payload: ImportCsvPayload
): Promise<ImportCsvResult> {
  const response = await apiRequest('/integrations/import/csv', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = 'Unable to import integrations CSV';
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (typeof payload.message === 'string') {
        message = payload.message;
      } else if (Array.isArray(payload.message) && payload.message.length > 0) {
        message = payload.message.join('; ');
      }
    } catch {
      // ignore parse errors and keep fallback message
    }
    throw new Error(message);
  }

  return (await response.json()) as ImportCsvResult;
}

export type AiChannel = 'SMS' | 'EMAIL';
export type AiTone = 'FRIENDLY' | 'PROFESSIONAL' | 'DIRECT';

export type AiSummaryResponse = {
  leadId: string;
  summary: string;
};

export type AiLeadScoreResponse = {
  leadId: string;
  score: number;
  breakdown: {
    contactability: number;
    engagement: number;
    appointment: number;
    stage: number;
    freshness: number;
    penalty: number;
    total: number;
  };
  reasons: string[];
  updatedAt: string;
};

export type AiDraftFollowupResponse = {
  leadId: string;
  channel: AiChannel;
  tone: AiTone;
  message: string;
};

export type AiNextBestActionResponse = {
  leadId: string;
  action: string;
  rationale: string;
};

export async function fetchLeadSummary(leadId: string): Promise<AiSummaryResponse> {
  const response = await apiRequest('/ai/lead/summary', {
    method: 'POST',
    body: JSON.stringify({ leadId })
  });

  if (!response.ok) {
    throw new Error('Unable to generate lead summary');
  }

  return (await response.json()) as AiSummaryResponse;
}

export async function fetchLeadScore(leadId: string): Promise<AiLeadScoreResponse> {
  const response = await apiRequest(`/leads/${leadId}/ai/lead-score`);

  if (!response.ok) {
    throw new Error('Unable to generate lead score');
  }

  return (await response.json()) as AiLeadScoreResponse;
}

export async function draftLeadFollowup(payload: {
  leadId: string;
  channel?: AiChannel;
  tone?: AiTone;
  instruction?: string;
}): Promise<AiDraftFollowupResponse> {
  const response = await apiRequest('/ai/lead/draft-followup', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to generate follow-up draft');
  }

  return (await response.json()) as AiDraftFollowupResponse;
}

export async function fetchLeadNextBestAction(leadId: string): Promise<AiNextBestActionResponse> {
  const response = await apiRequest('/ai/next-best-action', {
    method: 'POST',
    body: JSON.stringify({ leadId })
  });

  if (!response.ok) {
    throw new Error('Unable to generate next best action');
  }

  return (await response.json()) as AiNextBestActionResponse;
}


export type DealershipStatus = 'ACTIVE' | 'INACTIVE';

export type Dealership = {
  twilioMessagingServiceSid?: string | null;
  twilioFromPhone?: string | null;
  twilioAccountSid?: string | null;
  twilioAuthTokenConfigured?: boolean;
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: DealershipStatus;
  businessHours?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};


export async function updateCurrentUser(payload: {
  firstName?: string;
  lastName?: string;
  phone?: string;
}): Promise<Pick<AuthMeResponse, 'id' | 'email' | 'firstName' | 'lastName' | 'phone'>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to update profile');
  return (await response.json()) as Pick<AuthMeResponse, 'id' | 'email' | 'firstName' | 'lastName' | 'phone'>;
}

export async function fetchDealershipSettings(dealershipId: string): Promise<Dealership> {
  const response = await apiRequest(`/dealerships/${dealershipId}`);
  if (!response.ok) throw new Error('Unable to fetch dealership settings');
  return (await response.json()) as Dealership;
}

export async function updateDealershipSettings(
  dealershipId: string,
  payload: Partial<{
    name: string;
    timezone: string;
    status: DealershipStatus;
    businessHours: Record<string, unknown>;
    twilioMessagingServiceSid: string;
    twilioFromPhone: string;
    twilioAccountSid: string;
    twilioAuthToken: string;
  }>
): Promise<Dealership> {
  const response = await apiRequest(`/dealerships/${dealershipId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to update dealership settings');
  return (await response.json()) as Dealership;
}

export async function fetchMyDealerships(): Promise<Array<{ dealershipId: string; name: string; slug: string; role: string; status: DealershipStatus; isActive: boolean }>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dealerships/mine`, {
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`
    }
  });

  if (!response.ok) throw new Error('Unable to fetch memberships');
  return (await response.json()) as Array<{ dealershipId: string; name: string; slug: string; role: string; status: DealershipStatus; isActive: boolean }>;
}

export async function fetchDealershipsPlatform(q?: string): Promise<Dealership[]> {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/v1/platform/dealerships${query}`, {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` }
  });

  if (!response.ok) throw new Error('Unable to fetch dealerships');
  return (await response.json()) as Dealership[];
}

export async function createDealershipPlatform(payload: {
  name: string;
  slug: string;
  timezone: string;
  status?: DealershipStatus;
}): Promise<Dealership> {
  const response = await fetch(`${API_BASE_URL}/api/v1/platform/dealerships`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to create dealership');
  return (await response.json()) as Dealership;
}

export async function updateDealershipPlatform(dealershipId: string, payload: Partial<{
  name: string;
  slug: string;
  timezone: string;
  status: DealershipStatus;
}>): Promise<Dealership> {
  const response = await fetch(`${API_BASE_URL}/api/v1/platform/dealerships/${dealershipId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to update dealership');
  return (await response.json()) as Dealership;
}

export type TeamMembership = {
  id: string;
  userId: string;
  dealershipId: string;
  role: 'ADMIN' | 'MANAGER' | 'BDC' | 'SALES';
  isActive: boolean;
  user: { id: string; email: string; firstName: string; lastName: string };
};

export async function fetchTeamUsers(): Promise<TeamMembership[]> {
  const response = await apiRequest('/team/users');
  if (!response.ok) throw new Error('Unable to fetch team users');
  return (await response.json()) as TeamMembership[];
}

export type TeamInvitation = {
  id: string;
  token: string;
  email: string;
  role: TeamMembership['role'];
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  acceptedAt?: string | null;
  dealershipName?: string;
};

export async function inviteTeamUser(payload: { email: string; role: TeamMembership['role'] }) {
  const response = await apiRequest('/team/invitations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to invite user');
  return (await response.json()) as { token: string; status: string; id: string };
}


export async function fetchTeamInvitations(): Promise<TeamInvitation[]> {
  const response = await apiRequest('/team/invitations');
  if (!response.ok) throw new Error('Unable to fetch invitations');
  return (await response.json()) as TeamInvitation[];
}

export async function revokeTeamInvitation(invitationId: string): Promise<void> {
  const response = await apiRequest(`/team/invitations/${invitationId}/revoke`, { method: 'POST' });
  if (!response.ok) throw new Error('Unable to revoke invitation');
}

export async function fetchInvitation(token: string): Promise<{ email: string; role: string; dealershipName: string; expiresAt: string; status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED' }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/invitations/${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error('Unable to fetch invitation');
  return (await response.json()) as { email: string; role: string; dealershipName: string; expiresAt: string; status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED' };
}

export async function setTeamUserRole(userId: string, role: TeamMembership['role']): Promise<void> {
  const response = await apiRequest(`/team/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });

  if (!response.ok) throw new Error('Unable to set role');
}

export async function deactivateTeamUser(userId: string): Promise<void> {
  const response = await apiRequest(`/team/users/${userId}/deactivate`, { method: 'POST' });
  if (!response.ok) throw new Error('Unable to deactivate user');
}

export async function acceptInvitation(payload: {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/accept-invitation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to accept invitation');
  const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
  setTokens(tokens);
}


export type PlatformMembership = {
  id: string;
  userId: string;
  dealershipId: string;
  role: 'ADMIN' | 'MANAGER' | 'BDC' | 'SALES';
  isActive: boolean;
  dealership: { id: string; name: string; slug: string; status: DealershipStatus };
};

export type PlatformUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  isPlatformOperator: boolean;
  dealerships: PlatformMembership[];
};

export async function fetchPlatformUsers(): Promise<PlatformUser[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/platform/users`, {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` }
  });

  if (!response.ok) throw new Error('Unable to fetch platform users');
  return (await response.json()) as PlatformUser[];
}

export async function createPlatformMembership(
  userId: string,
  payload: { dealershipId: string; role: PlatformMembership['role']; isActive?: boolean }
): Promise<PlatformMembership> {
  const response = await fetch(`${API_BASE_URL}/api/v1/platform/users/${userId}/memberships`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to create membership');
  return (await response.json()) as PlatformMembership;
}

export async function updatePlatformMembership(
  userId: string,
  dealershipId: string,
  payload: { role?: PlatformMembership['role']; isActive?: boolean }
): Promise<PlatformMembership> {
  const response = await fetch(`${API_BASE_URL}/api/v1/platform/users/${userId}/memberships/${dealershipId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('Unable to update membership');
  return (await response.json()) as PlatformMembership;
}
