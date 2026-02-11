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

export async function apiWithTenant(path: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/v1${path}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'X-Dealership-Id': getSelectedDealershipId() ?? ''
    }
  });
}
