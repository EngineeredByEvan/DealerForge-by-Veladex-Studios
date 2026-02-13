import { BadRequestException } from '@nestjs/common';

export type CsvImportFieldError = {
  field: string;
  message: string;
};

export type CsvImportFailure = {
  row: number;
  raw: Record<string, string>;
  errors: CsvImportFieldError[];
};

export type CsvImportSuccess = {
  row: number;
  leadId: string;
  email?: string;
  phone?: string;
};

export type ParsedCsvRow = {
  row: number;
  raw: Record<string, string>;
  normalized: NormalizedLeadRow;
};

export type LeadTypeValue =
  | 'NEW_VEHICLE'
  | 'USED_VEHICLE'
  | 'SERVICE'
  | 'FINANCE'
  | 'GENERAL'
  | 'TRADE_IN'
  | 'PHONE_UP'
  | 'WALK_IN'
  | 'INTERNET'
  | 'OTHER';

export type LeadStatusValue =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'APPOINTMENT_SET'
  | 'NEGOTIATING'
  | 'SOLD'
  | 'LOST';

export type NormalizedLeadRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  vehicleInterest?: string;
  source?: string;
  leadType: LeadTypeValue;
  status: LeadStatusValue;
};

const LEAD_TYPE_SET = new Set<string>([
  'NEW_VEHICLE',
  'USED_VEHICLE',
  'SERVICE',
  'FINANCE',
  'GENERAL',
  'TRADE_IN',
  'PHONE_UP',
  'WALK_IN',
  'INTERNET',
  'OTHER'
]);
const LEAD_STATUS_SET = new Set<string>(['NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_SET', 'NEGOTIATING', 'SOLD', 'LOST']);

const HEADER_ALIASES: Record<string, keyof Omit<NormalizedLeadRow, 'leadType' | 'status'> | 'leadType' | 'status'> = {
  firstname: 'firstName',
  first_name: 'firstName',
  firstName: 'firstName',
  lastname: 'lastName',
  last_name: 'lastName',
  lastName: 'lastName',
  email: 'email',
  emailaddress: 'email',
  email_address: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  phone_number: 'phone',
  mobile: 'phone',
  vehicleinterest: 'vehicleInterest',
  vehicle_interest: 'vehicleInterest',
  vehicle: 'vehicleInterest',
  source: 'source',
  leadsource: 'source',
  lead_source: 'source',
  leadtype: 'leadType',
  lead_type: 'leadType',
  status: 'status'
};

function normalizeCell(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePhone(raw: string | undefined): string | undefined {
  const normalized = normalizeCell(raw);
  if (!normalized) {
    return undefined;
  }

  const keepPlusPrefix = normalized.startsWith('+');
  const digits = normalized.replace(/\D/g, '');
  if (!digits) {
    return undefined;
  }

  return keepPlusPrefix ? `+${digits}` : digits;
}

function canonicalHeader(header: string): string {
  return header.replace(/[\s\-]/g, '').trim();
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = '';
  let i = 0;
  let inQuotes = false;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }

      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === ',' && !inQuotes) {
      columns.push(current);
      current = '';
      i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  if (inQuotes) {
    throw new BadRequestException('CSV contains an unterminated quoted field');
  }

  columns.push(current);
  return columns;
}

export function parseCsvRows(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalizedCsv = csv.replace(/^\uFEFF/, '');
  const lines = normalizedCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new BadRequestException('CSV must include a header row and at least one data row');
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  if (headers.length === 0 || headers.some((header) => header.length === 0)) {
    throw new BadRequestException('CSV header row is invalid: empty column names are not allowed');
  }

  const mappedHeaderKeys = headers.map((header) => HEADER_ALIASES[canonicalHeader(header)]);
  const hasContact = mappedHeaderKeys.includes('email') || mappedHeaderKeys.includes('phone');

  if (!hasContact) {
    throw new BadRequestException(
      'CSV header is invalid. Include at least one contact column (email or phone). Example: firstName,lastName,email,phone,vehicleInterest'
    );
  }

  const rows = lines.slice(1).map((line, index) => {
    const columns = parseCsvLine(line);
    if (columns.length !== headers.length) {
      throw new BadRequestException(`CSV row ${index + 2} has ${columns.length} columns but expected ${headers.length}`);
    }

    const row: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      row[header] = columns[headerIndex] ?? '';
    });

    return row;
  });

  return { headers, rows };
}

export function normalizeCsvRow(row: Record<string, string>): { normalized: NormalizedLeadRow; errors: CsvImportFieldError[] } {
  const canonical: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(row)) {
    const mapped = HEADER_ALIASES[canonicalHeader(key)];
    if (mapped) {
      canonical[mapped] = value;
    }
  }

  const errors: CsvImportFieldError[] = [];

  const leadTypeCandidate = normalizeCell(canonical.leadType)?.toUpperCase();
  const statusCandidate = normalizeCell(canonical.status)?.toUpperCase();

  if (leadTypeCandidate && !LEAD_TYPE_SET.has(leadTypeCandidate)) {
    errors.push({
      field: 'leadType',
      message: `Unsupported leadType "${leadTypeCandidate}"`
    });
  }

  if (statusCandidate && !LEAD_STATUS_SET.has(statusCandidate)) {
    errors.push({
      field: 'status',
      message: `Unsupported status "${statusCandidate}"`
    });
  }

  const normalized: NormalizedLeadRow = {
    firstName: normalizeCell(canonical.firstName),
    lastName: normalizeCell(canonical.lastName),
    email: normalizeCell(canonical.email)?.toLowerCase(),
    phone: normalizePhone(canonical.phone),
    vehicleInterest: normalizeCell(canonical.vehicleInterest),
    source: normalizeCell(canonical.source),
    leadType: (leadTypeCandidate as LeadTypeValue | undefined) ?? 'GENERAL',
    status: (statusCandidate as LeadStatusValue | undefined) ?? 'NEW'
  };

  if (!normalized.email && !normalized.phone) {
    errors.push({
      field: 'email|phone',
      message: 'Either email or phone is required'
    });
  }

  return {
    normalized,
    errors
  };
}
