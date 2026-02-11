import { healthResponseSchema } from '@dealerforge/shared';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns a valid health response', () => {
    const service = new HealthService();

    const response = service.getHealth();
    const parsed = healthResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
  });
});
