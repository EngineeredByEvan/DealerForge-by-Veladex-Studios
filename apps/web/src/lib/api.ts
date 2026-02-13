'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const ACCESS_TOKEN_KEY = 'dealerforge_access_token';
const REFRESH_TOKEN_KEY = 'dealerforge_refresh_token';
const DEALERSHIP_ID_KEY = 'dealerforge_dealership_id';

export type AuthMeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dealerships: { dealershipId: string; dealershipName: string; role: string }[];
};

export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

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
  source?: { id: string; name: string } | null;
};


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
  localStorage.removeItem(DEALERSHIP_ID_KEY);
}

export function setSelectedDealershipId(dealershipId: string): void {
  localStorage.setItem(DEALERSHIP_ID_KEY, dealershipId);
}

export function getSelectedDealershipId(): string | null {
  return localStorage.getItem(DEALERSHIP_ID_KEY);
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
  const dealershipId = getSelectedDealershipId() ?? 'woodstock-mazda';

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'x-dealership-id': dealershipId, // <-- add this
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

export async function assignLead(leadId: string, assignedToUserId: string): Promise<Lead> {
  const response = await apiRequest(`/leads/${leadId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignedToUserId })
  });

  if (!response.ok) {
    throw new Error('Unable to assign lead');
  }

  return (await response.json()) as Lead;
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<Lead> {
  const response = await apiRequest(`/leads/${leadId}/status`, {
    method: 'POST',
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

export async function createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
  const response = await apiRequest('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to create appointment');
  }

  return (await response.json()) as Appointment;
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


export async function fetchReportsOverview(): Promise<ReportOverviewResponse> {
  const response = await apiRequest('/reports/overview');

  if (!response.ok) {
    throw new Error('Unable to fetch reports overview');
  }

  return (await response.json()) as ReportOverviewResponse;
}

export async function fetchReportsResponseTime(): Promise<ReportResponseTimeResponse> {
  const response = await apiRequest('/reports/response-time');

  if (!response.ok) {
    throw new Error('Unable to fetch reports response time');
  }

  return (await response.json()) as ReportResponseTimeResponse;
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

export async function importIntegrationsCsv(
  payload: ImportCsvPayload
): Promise<{ totalRows: number; successCount: number; failureCount: number }> {
  const response = await apiRequest('/integrations/import/csv', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Unable to import integrations CSV');
  }

  return (await response.json()) as { totalRows: number; successCount: number; failureCount: number };
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
  reasons: string[];
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
  const response = await apiRequest('/ai/lead/score', {
    method: 'POST',
    body: JSON.stringify({ leadId })
  });

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
