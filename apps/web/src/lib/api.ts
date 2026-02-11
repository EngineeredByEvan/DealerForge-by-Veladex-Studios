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
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const payload: { accessToken: string; refreshToken: string } = await response.json();
  setTokens(payload);
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
  return fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'X-Dealership-Id': getSelectedDealershipId() ?? '',
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
