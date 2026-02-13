'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/layout/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  Dealership,
  fetchDealershipSettings,
  getSelectedDealershipId,
  updateDealershipSettings
} from '@/lib/api';

export default function DealershipSettingsPage(): JSX.Element {
  const { push } = useToast();
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [businessHoursJson, setBusinessHoursJson] = useState('{}');

  useEffect(() => {
    const dealershipId = getSelectedDealershipId();
    if (!dealershipId) {
      push('Select a dealership first');
      setLoading(false);
      return;
    }

    void fetchDealershipSettings(dealershipId)
      .then((data) => {
        setDealership(data);
        setName(data.name);
        setTimezone(data.timezone);
        setStatus(data.status);
        setBusinessHoursJson(JSON.stringify(data.businessHours ?? {}, null, 2));
      })
      .catch(() => push('Unable to load dealership settings. Ensure tenant header and access role are valid.'))
      .finally(() => setLoading(false));
  }, [push]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!dealership) return;

    setSaving(true);
    try {
      const parsedBusinessHours = JSON.parse(businessHoursJson) as Record<string, unknown>;
      const updated = await updateDealershipSettings(dealership.id, {
        name,
        timezone,
        status,
        businessHours: parsedBusinessHours
      });
      setDealership(updated);
      push('Dealership settings updated successfully');
    } catch {
      push('Unable to update dealership settings. Verify business hours JSON is valid.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader title="Dealership Settings" subtitle="Manage your dealership configuration." />
      <SectionCard title="Dealership Profile">
        {loading ? (
          <div className="grid" style={{ gap: 10 }}>
            <SkeletonLoader />
            <SkeletonLoader />
            <SkeletonLoader />
          </div>
        ) : dealership ? (
          <form onSubmit={onSubmit} className="form-grid">
            <FormField label="Name" htmlFor="name">
              <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
            <FormField label="Slug" htmlFor="slug" hint="Read-only after creation">
              <Input id="slug" readOnly value={dealership.slug} />
            </FormField>
            <FormField label="Timezone" htmlFor="timezone">
              <Input id="timezone" required value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <Select id="status" value={status} onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </FormField>
            <FormField label="Business hours (JSON)" htmlFor="businessHours" hint="Optional">
              <Textarea id="businessHours" rows={8} value={businessHoursJson} onChange={(event) => setBusinessHoursJson(event.target.value)} />
            </FormField>
            <div style={{ alignSelf: 'end' }}>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}
