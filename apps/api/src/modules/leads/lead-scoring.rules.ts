import { LeadStatus } from '@prisma/client';

export const LEAD_SCORE_RULES = {
  namePresent: 5,
  phonePresent: 10,
  emailPresent: 10,
  vehicleInterestPresent: 8,
  sourcePresent: 5,
  contactedOrBeyond: 10,
  appointmentSetOrFutureAppointment: 15,
  outboundMessageExists: 10,
  callLogged: 10,
  sold: 20
} as const;

export const STATUS_RANK: Record<LeadStatus, number> = {
  NEW: 0,
  CONTACTED: 1,
  QUALIFIED: 2,
  APPOINTMENT_SET: 3,
  NEGOTIATING: 4,
  SOLD: 5,
  LOST: 6
};

export const MIN_LEAD_SCORE = 0;
export const MAX_LEAD_SCORE = 100;
