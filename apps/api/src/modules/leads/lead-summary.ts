import { Prisma } from '@prisma/client';

export const LEAD_SUMMARY_INCLUDE = {
  assignedToUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true
    }
  },
  source: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.LeadInclude;

export type LeadSummary = Prisma.LeadGetPayload<{ include: typeof LEAD_SUMMARY_INCLUDE }>;
