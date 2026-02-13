'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DataTableShell } from '@/components/layout/data-table';
import { FormField } from '@/components/layout/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  CreateIntegrationPayload,
  Integration,
  IntegrationProvider,
  createIntegration,
  fetchIntegrations,
  importIntegrationsCsv
} from '@/lib/api';

const PROVIDERS: IntegrationProvider[] = ['GENERIC', 'AUTOTRADER', 'CARGURUS', 'OEM_FORM', 'REFERRAL'];

export default function SettingsIntegrationsPage(): JSX.Element {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [provider, setProvider] = useState<IntegrationProvider>('GENERIC');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [csv, setCsv] = useState<string>('');
  const [importSummary, setImportSummary] = useState<string>('');

  async function loadIntegrations(): Promise<void> {
    setLoading(true);
    setError('');

    try {
      const data = await fetchIntegrations();
      setIntegrations(data);
    } catch {
      setError('Unable to load integrations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIntegrations();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');

    const payload: CreateIntegrationPayload = {
      name,
      provider,
      webhookSecret: webhookSecret.trim() || undefined
    };

    try {
      await createIntegration(payload);
      setName('');
      setWebhookSecret('');
      await loadIntegrations();
    } catch {
      setError('Unable to create integration. Ensure you have ADMIN access.');
    }
  }

  async function onImportCsv(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setImportSummary('');

    try {
      const result = await importIntegrationsCsv({ csv });
      setImportSummary(
        `Imported ${result.successCount}/${result.totalRows} rows (${result.failureCount} failed).`
      );
      setCsv('');
      await loadIntegrations();
    } catch {
      setError('Unable to import CSV.');
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader title="Integrations" subtitle="Manage lead sources and import records through clean, reliable workflows." />
      {error ? <p className="error">{error}</p> : null}

      <SectionCard title="Create Integration">
        <form onSubmit={onCreate} className="form-grid">
          <FormField label="Integration name" htmlFor="name">
            <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="AutoTrader - East Region" />
          </FormField>
          <FormField label="Provider" htmlFor="provider">
            <Select id="provider" value={provider} onChange={(event) => setProvider(event.target.value as IntegrationProvider)}>
              {PROVIDERS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Webhook secret" htmlFor="secret" hint="Optional">
            <Input id="secret" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Auto-generated if omitted" />
          </FormField>
          <div style={{ alignSelf: 'end' }}><Button type="submit">Create Integration</Button></div>
        </form>
      </SectionCard>

      <SectionCard title="CSV Import">
        <form onSubmit={onImportCsv} className="grid">
          <FormField label="CSV payload" htmlFor="csv" description="Paste CSV rows with lead data.">
            <Textarea id="csv" required rows={8} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder={[ 'firstName,lastName,email,phone,vehicleInterest', 'Alex,Rivera,alex@example.com,5550001,2024 CX-5' ].join('\n')} />
          </FormField>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="submit">Import CSV</Button>
            {importSummary ? <Badge>{importSummary}</Badge> : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Configured integrations">
        <DataTableShell
          loading={loading}
          empty={!loading && integrations.length === 0}
          toolbar={<div className="filter-bar"><Input placeholder="Search integrations" readOnly /></div>}
          pagination={<><span>Showing {integrations.length} integrations</span><Button variant="ghost">Next</Button></>}
        >
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Webhook Secret</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration) => (
                <tr key={integration.id}>
                  <td>{integration.name}</td>
                  <td><Badge>{integration.provider}</Badge></td>
                  <td><code>{integration.webhookSecret}</code></td>
                  <td>{integration._count.events}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </DataTableShell>
      </SectionCard>
    </div>
  );
}
