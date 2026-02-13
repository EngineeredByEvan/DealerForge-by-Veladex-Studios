'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DataTableShell } from '@/components/layout/data-table';
import { FormField } from '@/components/layout/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import {
  Appointment,
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  fetchAppointments
} from '@/lib/api';
import { subscribeToDealershipChange } from '@/lib/dealership-store';

function toIsoRange(preset: string): string | undefined {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'today') {
    const end = new Date(startOfToday);
    end.setDate(end.getDate() + 1);
    return `${startOfToday.toISOString()},${end.toISOString()}`;
  }

  if (preset === 'week') {
    const weekStart = new Date(startOfToday);
    weekStart.setDate(startOfToday.getDate() - startOfToday.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return `${weekStart.toISOString()},${weekEnd.toISOString()}`;
  }

  return undefined;
}

export default function AppointmentsPage(): JSX.Element {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus') ?? '';
  const range = searchParams.get('range') ?? '';
  const { push } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedAppointmentId, setFocusedAppointmentId] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await fetchAppointments({ range: toIsoRange(range) });
      setAppointments(result);
      setError(null);
    } catch {
      setError('Unable to load appointments');
      push('Unable to load appointments');
    } finally {
      setLoading(false);
    }
  }, [push, range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeToDealershipChange(() => {
      void load();
    });
    return unsub;
  }, [load]);

  useEffect(() => {
    if (!focusId) return;
    setFocusedAppointmentId(focusId);
    const timer = window.setTimeout(() => setFocusedAppointmentId(''), 1500);
    const row = document.querySelector<HTMLTableRowElement>(`tr[data-appointment-id="${focusId}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => window.clearTimeout(timer);
  }, [focusId, appointments]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const created = await createAppointment({
        start_at: startAt,
        end_at: endAt,
        note: note || undefined
      });
      setAppointments((previous) => [created, ...previous]);
      setStartAt('');
      setEndAt('');
      setNote('');
      setError(null);
      push('Appointment created');
    } catch {
      setError('Unable to create appointment');
      push('Unable to create appointment');
    }
  }

  async function handleConfirm(appointmentId: string): Promise<void> {
    try {
      const updated = await confirmAppointment(appointmentId);
      setAppointments((previous) =>
        previous.map((appointment) => (appointment.id === appointmentId ? updated : appointment))
      );
      setError(null);
    } catch {
      setError('Unable to confirm appointment');
      push('Unable to confirm appointment');
    }
  }

  async function handleCancel(appointmentId: string): Promise<void> {
    try {
      const updated = await cancelAppointment(appointmentId);
      setAppointments((previous) =>
        previous.map((appointment) => (appointment.id === appointmentId ? updated : appointment))
      );
      setError(null);
    } catch {
      setError('Unable to cancel appointment');
      push('Unable to cancel appointment');
    }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <PageHeader title="Appointments" subtitle="Book and manage meetings with polished customer-facing operations." />
      {error ? <p className="error">{error}</p> : null}

      <SectionCard title="Book appointment">
        <form onSubmit={(event) => void handleCreate(event)} className="form-grid">
          <FormField label="Start (ISO)" htmlFor="start_at">
            <Input id="start_at" type="text" value={startAt} placeholder="2026-02-01T15:00:00.000Z" onChange={(event) => setStartAt(event.target.value)} required />
          </FormField>
          <FormField label="End (ISO)" htmlFor="end_at">
            <Input id="end_at" type="text" value={endAt} placeholder="2026-02-01T16:00:00.000Z" onChange={(event) => setEndAt(event.target.value)} required />
          </FormField>
          <FormField label="Note" htmlFor="note" hint="Optional">
            <Input id="note" type="text" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          <div style={{ alignSelf: 'end' }}><Button type="submit">Create Appointment</Button></div>
        </form>
      </SectionCard>

      <SectionCard title="Appointment list">
        <DataTableShell
          loading={loading}
          empty={!loading && appointments.length === 0}
          emptyState="No appointments yet"
          toolbar={<div className="filter-bar"><Input readOnly value={range ? `Showing ${range} appointments` : 'All appointment windows'} /></div>}
          pagination={<><span>Showing {appointments.length} appointments</span><Button variant="ghost">Next</Button></>}
        >
          <Table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Window</th>
                <th>Lead</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} data-appointment-id={appointment.id} className={focusedAppointmentId === appointment.id ? 'focus-row' : ''}>
                  <td><Badge>{appointment.status}</Badge></td>
                  <td>{new Date(appointment.start_at).toLocaleString()} - {new Date(appointment.end_at).toLocaleString()}</td>
                  <td>{appointment.lead ? `${appointment.lead.firstName ?? ''} ${appointment.lead.lastName ?? ''}`.trim() || appointment.lead.id : '—'}</td>
                  <td>{appointment.note ?? '—'}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <Button type="button" variant="secondary" disabled={appointment.status === 'CONFIRMED' || appointment.status === 'CANCELED'} onClick={() => void handleConfirm(appointment.id)}>Confirm</Button>
                    <Button type="button" variant="ghost" disabled={appointment.status === 'CANCELED' || appointment.status === 'SHOWED' || appointment.status === 'NO_SHOW'} onClick={() => void handleCancel(appointment.id)}>Cancel</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </DataTableShell>
      </SectionCard>
    </div>
  );
}
