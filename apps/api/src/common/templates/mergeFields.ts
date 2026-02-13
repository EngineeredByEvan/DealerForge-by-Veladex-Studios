export type MergeFieldKey =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'vehicleInterest'
  | 'vehicle'
  | 'dealershipName'
  | 'salespersonName'
  | 'unsubscribeText';

export type MergeContext = Partial<Record<MergeFieldKey, string | null | undefined>>;

const PLACEHOLDER_REGEX = /\{\s*(\w+)\s*\}|\{\{\s*(\w+)\s*\}\}/g;

function normalizeContext(ctx: MergeContext): Record<MergeFieldKey, string> {
  const firstName = ctx.firstName?.trim() ?? '';
  const lastName = ctx.lastName?.trim() ?? '';
  const fullName = (ctx.fullName?.trim() || `${firstName} ${lastName}`.trim());
  const vehicleInterest = ctx.vehicleInterest?.trim() ?? ctx.vehicle?.trim() ?? '';

  return {
    firstName,
    lastName,
    fullName,
    email: ctx.email?.trim() ?? '',
    phone: ctx.phone?.trim() ?? '',
    vehicleInterest,
    vehicle: vehicleInterest,
    dealershipName: ctx.dealershipName?.trim() ?? '',
    salespersonName: ctx.salespersonName?.trim() ?? '',
    unsubscribeText: ctx.unsubscribeText?.trim() ?? ''
  };
}

export function renderTemplate(text: string, ctx: MergeContext): string {
  const values = normalizeContext(ctx);

  return text.replace(PLACEHOLDER_REGEX, (_match, singleKey: string | undefined, doubleKey: string | undefined) => {
    const key = (singleKey ?? doubleKey) as MergeFieldKey;
    return values[key] ?? '';
  });
}

export function findMissingMergeFields(text: string, ctx: MergeContext): string[] {
  const values = normalizeContext(ctx);
  const missing = new Set<string>();

  text.replace(PLACEHOLDER_REGEX, (_match, singleKey: string | undefined, doubleKey: string | undefined) => {
    const key = (singleKey ?? doubleKey) as MergeFieldKey;
    if (!values[key]?.trim()) {
      missing.add(key === 'vehicle' ? 'vehicleInterest' : key);
    }
    return '';
  });

  return [...missing];
}
