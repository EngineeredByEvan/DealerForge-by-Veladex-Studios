'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { CreateLeadPayload, Lead, LeadStatus, createLead, fetchLeads } from '@/lib/api';

const LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'APPOINTMENT_SET',
  'NEGOTIATING',
  'SOLD',
  'LOST'
];

export default function LeadsPage(): JSX.Element {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [formState, setFormState] = useState<CreateLeadPayload>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: '',
    vehicleInterest: ''
  });

  async function loadLeads(): Promise<void> {
    setLoading(true);
    const data = await fetchLeads({
      status: status ? (status as LeadStatus) : undefined,
      assignedTo: assignedTo || undefined,
      source: source || undefined,
      q: q || undefined
    });
    setLeads(data);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadLeads();
  };

  const onCreateLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);

    try {
      await createLead(formState);
      setFormState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        source: '',
        vehicleInterest: ''
      });
      await loadLeads();
    } catch {
      setError('Unable to create lead');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main>
      <h1>Leads</h1>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      <form onSubmit={onFilterSubmit} style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        <h2>Filters</h2>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name/email/vehicle" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((leadStatus) => (
            <option key={leadStatus} value={leadStatus}>
              {leadStatus}
            </option>
          ))}
        </select>
        <input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Assigned user id" />
        <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Source" />
        <button type="submit">Apply filters</button>
      </form>

      <button type="button" onClick={() => setShowQuickAdd((current) => !current)}>{showQuickAdd ? 'Hide quick add' : 'Quick add lead'}</button>

      {showQuickAdd ? <form onSubmit={onCreateLead} style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        <h2>Create lead</h2>
        <input
          value={formState.firstName ?? ''}
          onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))}
          placeholder="First name"
        />
        <input
          value={formState.lastName ?? ''}
          onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))}
          placeholder="Last name"
        />
        <input
          value={formState.email ?? ''}
          onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
          placeholder="Email"
        />
        <input
          value={formState.phone ?? ''}
          onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
          placeholder="Phone"
        />
        <input
          value={formState.source ?? ''}
          onChange={(event) => setFormState((current) => ({ ...current, source: event.target.value }))}
          placeholder="Source"
        />
        <input
          value={formState.vehicleInterest ?? ''}
          onChange={(event) => setFormState((current) => ({ ...current, vehicleInterest: event.target.value }))}
          placeholder="Vehicle interest"
        />
        <button type="submit" disabled={creating}>
          {creating ? 'Creating...' : 'Create lead'}
        </button>
      </form> : null}

      {loading ? <p>Loading leads...</p> : null}
      {!loading && leads.length === 0 ? <p>No leads found. Use Quick add lead to create your first record.</p> : null}

      <table cellPadding={8} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Status</th>
            <th align="left">Source</th>
            <th align="left">Vehicle</th>
            <th align="left">Assigned</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} style={{ borderTop: '1px solid #ccc' }}>
              <td>
                <Link href={`/leads/${lead.id}`}>{`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.id}</Link>
              </td>
              <td>{lead.status}</td>
              <td>{lead.source?.name ?? '—'}</td>
              <td>{lead.vehicleInterest ?? '—'}</td>
              <td>{lead.assignedToUserId ?? 'Unassigned'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
