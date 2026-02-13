'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/layout/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';
import { useToast } from '@/components/ui/toast';
import { AuthMeResponse, fetchMe, updateCurrentUser } from '@/lib/api';

export default function ProfileSettingsPage(): JSX.Element {
  const { push } = useToast();
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    void fetchMe()
      .then((data) => {
        setProfile(data);
        setFirstName(data.firstName);
        setLastName(data.lastName);
        setPhone(data.phone ?? '');
      })
      .catch(() => push('Unable to load profile'))
      .finally(() => setLoading(false));
  }, [push]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateCurrentUser({
        firstName,
        lastName,
        phone: phone.trim() || undefined
      });
      setProfile((current) =>
        current
          ? { ...current, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone }
          : current
      );
      push('Profile updated successfully');
    } catch {
      push('Unable to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader title="Profile" subtitle="Manage your personal information." />
      <SectionCard title="User Profile">
        {loading ? (
          <div className="grid" style={{ gap: 10 }}>
            <SkeletonLoader />
            <SkeletonLoader />
            <SkeletonLoader />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="form-grid">
            <FormField label="First name" htmlFor="firstName">
              <Input id="firstName" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </FormField>
            <FormField label="Last name" htmlFor="lastName">
              <Input id="lastName" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </FormField>
            <FormField label="Phone" htmlFor="phone" hint="Optional">
              <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </FormField>
            <FormField label="Email" htmlFor="email" hint="Read-only">
              <Input id="email" value={profile?.email ?? ''} readOnly />
            </FormField>
            <FormField label="Change password" htmlFor="changePassword" hint="Coming soon">
              <Button id="changePassword" type="button" variant="ghost" disabled>
                Change password (coming soon)
              </Button>
            </FormField>
            <div style={{ alignSelf: 'end' }}>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
