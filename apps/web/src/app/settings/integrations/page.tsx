'use client';

import { FormEvent, useEffect, useState } from 'react';
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
    <main style={{ padding: 16, display: 'grid', gap: 20 }}>
      <section>
        <h1>Integrations Settings</h1>
        <p>Manage lead source integrations and import CSV leads.</p>
      </section>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      <section style={{ border: '1px solid #d4d4d8', borderRadius: 12, padding: 16 }}>
        <h2>Create Integration</h2>
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Integration name"
          />

          <select value={provider} onChange={(event) => setProvider(event.target.value as IntegrationProvider)}>
            {PROVIDERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <input
            value={webhookSecret}
            onChange={(event) => setWebhookSecret(event.target.value)}
            placeholder="Webhook secret (optional auto-generated)"
          />

          <button type="submit" style={{ width: 180 }}>
            Create Integration
          </button>
        </form>
      </section>

      <section style={{ border: '1px solid #d4d4d8', borderRadius: 12, padding: 16 }}>
        <h2>CSV Import</h2>
        <form onSubmit={onImportCsv} style={{ display: 'grid', gap: 8 }}>
          <textarea
            required
            rows={8}
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder={[
              'firstName,lastName,email,phone,vehicleInterest',
              'Alex,Rivera,alex@example.com,5550001,2024 CX-5'
            ].join('\n')}
          />

          <button type="submit" style={{ width: 140 }}>
            Import CSV
          </button>
        </form>
        {importSummary ? <p>{importSummary}</p> : null}
      </section>

      <section style={{ border: '1px solid #d4d4d8', borderRadius: 12, padding: 16 }}>
        <h2>Configured Integrations</h2>
        {loading ? <p>Loading integrations...</p> : null}
        {!loading && integrations.length === 0 ? <p>No integrations configured yet.</p> : null}

        {!loading && integrations.length > 0 ? (
          <table cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e4e4e7' }}>
                <th>Name</th>
                <th>Provider</th>
                <th>Webhook Secret</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration) => (
                <tr key={integration.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
                  <td>{integration.name}</td>
                  <td>{integration.provider}</td>
                  <td>
                    <code>{integration.webhookSecret}</code>
                  </td>
                  <td>{integration._count.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
