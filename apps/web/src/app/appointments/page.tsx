'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DataTableShell } from '@/components/layout/data-table';
import { FormField } from '@/components/layout/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import {
  Appointment,
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  fetchAppointments
} from '@/lib/api';

export default function AppointmentsPage(): JSX.Element {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const result = await fetchAppointments();
      setAppointments(result);
      setError(null);
    } catch {
      setError('Unable to load appointments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
    } catch {
      setError('Unable to create appointment');
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
          toolbar={<div className="filter-bar"><Input readOnly value="Filter and sort controls coming soon" /></div>}
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
                <tr key={appointment.id}>
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
