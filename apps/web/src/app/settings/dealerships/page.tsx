'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import { Dealership, createDealershipPlatform, fetchDealershipsPlatform } from '@/lib/api';

export default function DealershipSettingsPage(): JSX.Element {
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [error, setError] = useState('');

  async function load(): Promise<void> {
    try {
      setDealerships(await fetchDealershipsPlatform());
    } catch {
      setError('Platform admin access is required.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    try {
      await createDealershipPlatform({ name, slug, timezone });
      setName('');
      setSlug('');
      setTimezone('UTC');
      await load();
    } catch {
      setError('Unable to create dealership.');
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader title="Dealership Settings" subtitle="Provision and manage dealership tenants." />
      {error ? <p className="error">{error}</p> : null}
      <SectionCard title="Create Dealership">
        <form onSubmit={onCreate} className="form-grid">
          <Input required placeholder="Dealership name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input required placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Input required placeholder="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          <Button type="submit">Create</Button>
        </form>
      </SectionCard>
      <SectionCard title="All Dealerships">
        <Table>
          <thead><tr><th>Name</th><th>Slug</th><th>Timezone</th><th>Status</th></tr></thead>
          <tbody>
            {dealerships.map((d) => (
              <tr key={d.id}><td>{d.name}</td><td>{d.slug}</td><td>{d.timezone}</td><td>{d.status}</td></tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    </div>
  );
}
