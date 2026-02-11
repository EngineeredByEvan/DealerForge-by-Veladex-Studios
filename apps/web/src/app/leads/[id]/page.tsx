'use client';

import { useEffect, useState } from 'react';
import { Lead, fetchLeadById } from '@/lib/api';

type LeadDetailPageProps = {
  params: {
    id: string;
  };
};

export default function LeadDetailPage({ params }: LeadDetailPageProps): JSX.Element {
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const result = await fetchLeadById(params.id);
        setLead(result);
      } catch {
        setError('Unable to load lead details');
      }
    }

    void load();
  }, [params.id]);

  if (error) {
    return <main>{error}</main>;
  }

  if (!lead) {
    return <main>Loading lead...</main>;
  }

  return (
    <main>
      <h1>Lead Detail</h1>
      <p>ID: {lead.id}</p>
      <p>Name: {`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unknown'}</p>
      <p>Status: {lead.status}</p>
      <p>Email: {lead.email ?? '—'}</p>
      <p>Phone: {lead.phone ?? '—'}</p>
      <p>Source: {lead.source?.name ?? '—'}</p>
      <p>Vehicle interest: {lead.vehicleInterest ?? '—'}</p>
      <p>Assigned to: {lead.assignedToUserId ?? 'Unassigned'}</p>
      <p>Last activity: {lead.lastActivityAt ?? '—'}</p>

      <section>
        <h2>Timeline</h2>
        <p>Placeholder: activities and communications will appear here.</p>
      </section>

      <section>
        <h2>Tasks</h2>
        <p>Placeholder: upcoming and completed tasks for this lead.</p>
      </section>

      <section>
        <h2>AI Panel</h2>
        <p>Placeholder: lead summary, score, and next best action.</p>
      </section>
    </main>
  );
}
