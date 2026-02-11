import { HealthResponse, healthResponseSchema } from '@dealerforge/shared';

export async function fetchHealth(): Promise<HealthResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  return healthResponseSchema.parse(payload);
}
