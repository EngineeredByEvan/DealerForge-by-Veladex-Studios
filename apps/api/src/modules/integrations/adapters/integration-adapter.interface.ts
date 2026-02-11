export type LeadInboundDto = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  vehicleInterest?: string;
  source?: string;
};

export interface IntegrationAdapter {
  parseInbound(payload: unknown): LeadInboundDto;
}
