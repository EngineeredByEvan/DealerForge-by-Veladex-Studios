import { LeadScoringService } from './lead-scoring.service';

describe('LeadScoringService', () => {
  const prismaMock = {
    lead: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    message: {
      count: jest.fn()
    }
  } as any;

  const service = new LeadScoringService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes expected score based on deterministic rules', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      status: 'APPOINTMENT_SET',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15550001111',
      email: 'jane@example.com',
      vehicleInterest: 'CX-5',
      sourceId: 'src-1',
      soldAt: null,
      appointments: [{ id: 'apt-1' }]
    });
    prismaMock.message.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await service.computeScore('lead-1', 'd-1');

    expect(result.score).toBe(83);
    expect(prismaMock.message.count).toHaveBeenNthCalledWith(1, {
      where: {
        dealershipId: 'd-1',
        thread: { leadId: 'lead-1' },
        direction: 'OUTBOUND',
        channel: { in: ['SMS', 'EMAIL'] }
      }
    });
  });

  it('recalculates and persists lead score', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      status: 'SOLD',
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
      vehicleInterest: null,
      sourceId: null,
      soldAt: new Date(),
      appointments: []
    });
    prismaMock.message.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.lead.update.mockResolvedValue({ id: 'lead-1', leadScore: 20 });

    await service.recalculateAndPersist('lead-1', 'd-1');

    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ leadScore: 20 })
      })
    );
  });
});
