'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DataTableShell } from '@/components/layout/data-table';
import { FormSection } from '@/components/layout/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { CreateLeadPayload, Lead, LeadStatus, createLead, fetchLeads } from '@/lib/api';
import { subscribeToDealershipChange } from '@/lib/dealership-store';

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_SET', 'NEGOTIATING', 'SOLD', 'LOST'];

export default function LeadsPage(): JSX.Element {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus') ?? '';
  const range = searchParams.get('range') ?? '';
  const { push } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [assignedTo, setAssignedTo] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [focusedLeadId, setFocusedLeadId] = useState('');
  const [formState, setFormState] = useState<CreateLeadPayload>({ firstName: '', lastName: '', email: '', phone: '', source: '', vehicleInterest: '' });

  const loadLeads = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const dateRangeMap: Record<string, string> = { today: 'TODAY', week: 'THIS_WEEK', month: 'THIS_MONTH' };
      const data = await fetchLeads({
        status: status ? (status as LeadStatus) : undefined,
        assignedTo: assignedTo || undefined,
        source: source || undefined,
        q: q || undefined,
        dateRange: dateRangeMap[range] ?? undefined
      });
      setLeads(data);
      setError(null);
    } catch {
      setLeads([]);
      setError('Unable to load leads for the selected dealership');
      push('Unable to load leads');
    } finally {
      setLoading(false);
    }
  }, [assignedTo, push, q, range, source, status]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const unsub = subscribeToDealershipChange(() => {
      void loadLeads();
    });
    return unsub;
  }, [loadLeads]);

  useEffect(() => {
    setStatus(searchParams.get('status') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (!focusId) return;
    setFocusedLeadId(focusId);
    const timer = window.setTimeout(() => setFocusedLeadId(''), 1500);
    const row = document.querySelector<HTMLTableRowElement>(`tr[data-lead-id="${focusId}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => window.clearTimeout(timer);
  }, [focusId, leads]);

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
      push('Unable to create lead');
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
        <DataTableShell
          loading={loading}
          empty={!loading && leads.length === 0}
          emptyState="No leads yet"
          toolbar={<div className="filter-bar"><Button variant="ghost" onClick={() => setSortAsc((v) => !v)}>Sort {sortAsc ? 'A-Z ↑' : 'Z-A ↓'}</Button>{searchParams.get('sla') === 'first-response' ? <Badge>First response SLA focus</Badge> : null}</div>}
          pagination={<><span>Showing {leads.length} leads</span><Button variant="ghost">Next</Button></>}
        >
          <Table>
            <thead><tr><th>Name</th><th>Status</th><th>Source</th><th>Vehicle</th><th>Assigned</th></tr></thead>
            <tbody>{sortedLeads.map((lead) => <tr key={lead.id} data-lead-id={lead.id} className={focusedLeadId === lead.id ? 'focus-row' : ''}><td><Link href={`/leads/${lead.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.id}</Link></td><td><Badge>{lead.status}</Badge></td><td><Badge>{lead.source?.name ?? '—'}</Badge></td><td>{lead.vehicleInterest ?? '—'}</td><td><span className="assignee-pill">{(lead.assignedToUserId ?? 'UN').slice(0, 2).toUpperCase()}</span>{lead.assignedToUserId ?? 'Unassigned'}</td></tr>)}</tbody>
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
