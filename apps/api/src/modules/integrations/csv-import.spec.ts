import { BadRequestException } from '@nestjs/common';
import { normalizeCsvRow, parseCsvRows } from './csv-import';

describe('csv-import utilities', () => {
  it('parses BOM, windows newlines, and quoted values', () => {
    const csv = '\uFEFFfirstName,lastName,email,vehicleInterest\r\n"Alex","Rivera","Alex@Example.com","2024 CX-5, Touring"';

    const parsed = parseCsvRows(csv);

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].vehicleInterest).toBe('2024 CX-5, Touring');

    const normalized = normalizeCsvRow(parsed.rows[0]);
    expect(normalized.errors).toHaveLength(0);
    expect(normalized.normalized.email).toBe('alex@example.com');
  });

  it('maps alias headers and defaults status/leadType', () => {
    const row = {
      firstname: 'Jamie',
      lastname: 'Smith',
      lead_source: 'Website',
      vehicle: 'Used SUV',
      phone_number: '(555) 222-1111'
    };

    const normalized = normalizeCsvRow(row);

    expect(normalized.errors).toHaveLength(0);
    expect(normalized.normalized.firstName).toBe('Jamie');
    expect(normalized.normalized.source).toBe('Website');
    expect(normalized.normalized.vehicleInterest).toBe('Used SUV');
    expect(normalized.normalized.phone).toBe('5552221111');
    expect(normalized.normalized.status).toBe('NEW');
    expect(normalized.normalized.leadType).toBe('GENERAL');
  });

  it('requires email or phone', () => {
    const normalized = normalizeCsvRow({ firstName: 'No', lastName: 'Contact' });

    expect(normalized.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email|phone' })
      ])
    );
  });

  it('throws for missing contact headers', () => {
    expect(() => parseCsvRows('firstName,lastName\nAlex,Rivera')).toThrow(BadRequestException);
  });
});
