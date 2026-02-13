'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  ImportCsvResult,
  Integration,
  IntegrationProvider,
  createIntegration,
  fetchIntegrations,
  getSelectedDealershipId,
  importIntegrationsCsv
} from '@/lib/api';
import { pushCsvImportNotification } from '@/lib/notifications';

const PROVIDERS: IntegrationProvider[] = ['GENERIC', 'AUTOTRADER', 'CARGURUS', 'OEM_FORM', 'REFERRAL'];
const CSV_TEMPLATE = ['firstName,lastName,email,phone,vehicleInterest', 'Alex,Rivera,alex@example.com,5550001,2024 CX-5'].join('\n');

export default function SettingsIntegrationsPage(): JSX.Element {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [provider, setProvider] = useState<IntegrationProvider>('GENERIC');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [csv, setCsv] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportCsvResult | null>(null);

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
    setImportResult(null);

    try {
      const result = await importIntegrationsCsv({ csv });
      setImportResult(result);
      const dealershipId = getSelectedDealershipId();
      if (dealershipId) {
        pushCsvImportNotification(
          dealershipId,
          `Imported ${result.successCount}/${result.totalRows} rows.`
        );
      }
      setCsv('');
      await loadIntegrations();
    } catch (importError) {
      if (importError instanceof Error && importError.message.includes('header')) {
        setError(`CSV header is invalid. Use this template:\n${CSV_TEMPLATE}`);
        return;
      }
      setError('Unable to import CSV.');
    }
  }

  const importSummary = useMemo(() => {
    if (!importResult) {
      return '';
    }

    return `Imported ${importResult.successCount}/${importResult.totalRows} rows (${importResult.failureCount} failed).`;
  }, [importResult]);

  function buildFailuresCsv(): string {
    if (!importResult || importResult.failures.length === 0) {
      return '';
    }

    const lines = ['row,field,message'];
    for (const failure of importResult.failures) {
      for (const fieldError of failure.errors) {
        const escaped = fieldError.message.replace(/"/g, '""');
        lines.push(`${failure.row},${fieldError.field},"${escaped}"`);
      }
    }

    return lines.join('\n');
  }

  function downloadFailures(kind: 'csv' | 'json'): void {
    if (!importResult || importResult.failures.length === 0) {
      return;
    }

    const payload = kind === 'csv' ? buildFailuresCsv() : JSON.stringify(importResult.failures, null, 2);
    const blob = new Blob([payload], { type: kind === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `csv-import-failures.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyErrors(): Promise<void> {
    if (!importResult || importResult.failures.length === 0) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(importResult.failures, null, 2));
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader title="Integrations" subtitle="Manage lead sources and import records through clean, reliable workflows." />
      {error ? <p className="error" style={{ whiteSpace: 'pre-wrap' }}>{error}</p> : null}

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
            <Textarea id="csv" required rows={8} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder={CSV_TEMPLATE} />
          </FormField>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button type="submit">Import CSV</Button>
            {importSummary ? <Badge>{importSummary}</Badge> : null}
            <Button type="button" variant="ghost" onClick={() => void copyErrors()} disabled={!importResult || importResult.failures.length === 0}>Copy errors</Button>
            <Button type="button" variant="ghost" onClick={() => downloadFailures('csv')} disabled={!importResult || importResult.failures.length === 0}>Download errors CSV</Button>
            <Button type="button" variant="ghost" onClick={() => downloadFailures('json')} disabled={!importResult || importResult.failures.length === 0}>Download errors JSON</Button>
          </div>
        </form>

        {importResult && importResult.failures.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <p><strong>Failed rows</strong></p>
            <Table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {importResult.failures.map((failure) => (
                  <tr key={`failure-${failure.row}`}>
                    <td>{failure.row}</td>
                    <td>{failure.errors.map((entry) => `${entry.field}: ${entry.message}`).join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
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
