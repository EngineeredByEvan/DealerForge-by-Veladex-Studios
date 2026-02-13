import { LeadScoringService } from './lead-scoring.service';

describe('LeadScoringService', () => {
  const prismaMock = {
    lead: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    message: {
      count: jest.fn()
    },
    activity: {
      count: jest.fn()
    },
    appointment: {
      count: jest.fn()
    }
  } as any;

  const service = new LeadScoringService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes score using contactability, engagement cap, appointment, stage, freshness, and penalties', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      status: 'QUALIFIED',
      soldAt: null,
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+1 (555) 000-1111',
      email: 'jane@example.com',
      vehicleInterest: 'CX-5',
      lastActivityAt: new Date(Date.now() - 20 * 60 * 60 * 1000)
    });

    prismaMock.message.count
      .mockResolvedValueOnce(1) // outbound exists
      .mockResolvedValueOnce(1) // inbound exists
      .mockResolvedValueOnce(2) // outbound count
      .mockResolvedValueOnce(1); // call message count

    prismaMock.activity.count.mockResolvedValueOnce(1); // call activity count

    prismaMock.appointment.count
      .mockResolvedValueOnce(0) // showed
      .mockResolvedValueOnce(1) // future set/confirmed
      .mockResolvedValueOnce(1); // no show

    const result = await service.computeScore('lead-1', 'd-1');

    // contactability 30 + engagement min(12+18+10+5,35)=35 + appointment 20 + stage 10 + freshness 5 - penalty 10
    expect(result.score).toBe(90);
    expect(result.breakdown).toEqual({
      contactability: 30,
      engagement: 35,
      appointment: 20,
      stage: 10,
      freshness: 5,
      penalty: -10,
      total: 90
    });
  });

  it('applies sold override and returns 100 immediately', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      status: 'SOLD',
      soldAt: new Date(),
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
      vehicleInterest: null,
      lastActivityAt: null
    });

    const result = await service.computeScore('lead-1', 'd-1');

    expect(result.score).toBe(100);
    expect(prismaMock.message.count).not.toHaveBeenCalled();
    expect(prismaMock.appointment.count).not.toHaveBeenCalled();
    expect(prismaMock.activity.count).not.toHaveBeenCalled();
  });

  it('recalculates and persists lead score', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      status: 'NEW',
      soldAt: null,
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
      vehicleInterest: null,
      lastActivityAt: null
    });
    prismaMock.message.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.activity.count.mockResolvedValueOnce(0);
    prismaMock.appointment.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.lead.update.mockResolvedValue({ id: 'lead-1', leadScore: 0 });

    await service.recalculateAndPersist('lead-1', 'd-1');

    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ leadScore: 0 })
      })
    );
  });
});
