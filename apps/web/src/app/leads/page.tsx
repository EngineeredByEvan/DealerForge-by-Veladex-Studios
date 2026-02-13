'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell } from '@/components/layout/data-table';
import { FormSection } from '@/components/layout/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { CreateLeadPayload, Lead, LeadStatus, createLead, fetchLeads } from '@/lib/api';

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_SET', 'NEGOTIATING', 'SOLD', 'LOST'];

export default function LeadsPage(): JSX.Element {
  const { push } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [formState, setFormState] = useState<CreateLeadPayload>({ firstName: '', lastName: '', email: '', phone: '', source: '', vehicleInterest: '' });

  async function loadLeads(): Promise<void> {
    setLoading(true);
    const data = await fetchLeads({ status: status ? (status as LeadStatus) : undefined, assignedTo: assignedTo || undefined, source: source || undefined, q: q || undefined });
    setLeads(data);
    setLoading(false);
    setError(null);
  }

  useEffect(() => { void loadLeads(); }, []);

  const sortedLeads = useMemo(() => [...leads].sort((a, b) => {
    const aName = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
    const bName = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim();
    return sortAsc ? aName.localeCompare(bName) : bName.localeCompare(aName);
  }), [leads, sortAsc]);

  const onFilterSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await loadLeads(); };

  const onCreateLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      await createLead(formState);
      setFormState({ firstName: '', lastName: '', email: '', phone: '', source: '', vehicleInterest: '' });
      push('Lead created successfully');
      setShowQuickAdd(false);
      await loadLeads();
    } catch {
      setError('Unable to create lead');
    } finally { setCreating(false); }
  };

  return (
    <div className="grid" style={{ gap: 18 }}>
      <PageHeader title="Leads" subtitle="Track, qualify, and convert customer opportunities with consistent workflows." actions={<Button onClick={() => setShowQuickAdd(true)}>+ New lead</Button>} />

      {error ? <p className="error">{error}</p> : null}

      <SectionCard title="Filters">
        <form onSubmit={onFilterSubmit} style={{ display: 'grid', gap: 10 }}>
          <FormSection>
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name/email/vehicle" />
            <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{LEAD_STATUSES.map((leadStatus) => <option key={leadStatus} value={leadStatus}>{leadStatus}</option>)}</Select>
            <Input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Assigned user id" />
            <Input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Source" />
          </FormSection>
          <Button type="submit" variant="secondary">Apply filters</Button>
        </form>
      </SectionCard>

      <SectionCard title="Pipeline records">
        <DataTableShell loading={loading} empty={!loading && leads.length === 0} toolbar={<Button variant="ghost" onClick={() => setSortAsc((v) => !v)}>Sort {sortAsc ? 'A-Z ↑' : 'Z-A ↓'}</Button>}>
          <Table>
            <thead><tr><th>Name</th><th>Status</th><th>Source</th><th>Vehicle</th><th>Assigned</th></tr></thead>
            <tbody>{sortedLeads.map((lead) => <tr key={lead.id}><td><Link href={`/leads/${lead.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.id}</Link></td><td>{lead.status}</td><td>{lead.source?.name ?? '—'}</td><td>{lead.vehicleInterest ?? '—'}</td><td>{lead.assignedToUserId ?? 'Unassigned'}</td></tr>)}</tbody>
          </Table>
        </DataTableShell>
      </SectionCard>

      <Modal open={showQuickAdd} onOpenChange={setShowQuickAdd} title="Create lead">
        <form onSubmit={onCreateLead} style={{ display: 'grid', gap: 10 }}>
          <Input value={formState.firstName ?? ''} onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" />
          <Input value={formState.lastName ?? ''} onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" />
          <Input value={formState.email ?? ''} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
          <Input value={formState.phone ?? ''} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
          <Input value={formState.source ?? ''} onChange={(event) => setFormState((current) => ({ ...current, source: event.target.value }))} placeholder="Source" />
          <Input value={formState.vehicleInterest ?? ''} onChange={(event) => setFormState((current) => ({ ...current, vehicleInterest: event.target.value }))} placeholder="Vehicle interest" />
          <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create lead'}</Button>
        </form>
      </Modal>
    </div>
  );
}
