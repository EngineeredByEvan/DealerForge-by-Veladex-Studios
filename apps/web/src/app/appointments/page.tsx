'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Appointment,
  AppointmentStatus,
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  fetchAppointments
} from '@/lib/api';

const STATUS_OPTIONS: AppointmentStatus[] = ['SET', 'CONFIRMED', 'SHOWED', 'NO_SHOW', 'CANCELED'];

export default function AppointmentsPage(): JSX.Element {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const result = await fetchAppointments();
      setAppointments(result);
      setError(null);
    } catch {
      setError('Unable to load appointments');
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
    <main>
      <h1>Appointments</h1>
      {error ? <p>{error}</p> : null}

      <section>
        <h2>Book appointment</h2>
        <form onSubmit={(event) => void handleCreate(event)}>
          <label htmlFor="start_at">Start (ISO)</label>
          <input
            id="start_at"
            type="text"
            value={startAt}
            placeholder="2026-02-01T15:00:00.000Z"
            onChange={(event) => setStartAt(event.target.value)}
            required
          />

          <label htmlFor="end_at">End (ISO)</label>
          <input
            id="end_at"
            type="text"
            value={endAt}
            placeholder="2026-02-01T16:00:00.000Z"
            onChange={(event) => setEndAt(event.target.value)}
            required
          />

          <label htmlFor="note">Note</label>
          <input id="note" type="text" value={note} onChange={(event) => setNote(event.target.value)} />

          <button type="submit">Create Appointment</button>
        </form>
      </section>

      <section>
        <h2>Appointment list</h2>
        {appointments.length === 0 ? <p>No appointments found.</p> : null}
        <ul>
          {appointments.map((appointment) => (
            <li key={appointment.id}>
              <strong>{appointment.status}</strong>
              <br />
              <small>
                {new Date(appointment.start_at).toLocaleString()} -{' '}
                {new Date(appointment.end_at).toLocaleString()}
              </small>
              <p>Lead: {appointment.lead ? `${appointment.lead.firstName ?? ''} ${appointment.lead.lastName ?? ''}`.trim() || appointment.lead.id : '—'}</p>
              <p>Note: {appointment.note ?? '—'}</p>
              <button
                type="button"
                disabled={appointment.status === 'CONFIRMED' || appointment.status === 'CANCELED'}
                onClick={() => void handleConfirm(appointment.id)}
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={appointment.status === 'CANCELED' || appointment.status === 'SHOWED' || appointment.status === 'NO_SHOW'}
                onClick={() => void handleCancel(appointment.id)}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Status legend</h2>
        <p>{STATUS_OPTIONS.join(' | ')}</p>
      </section>
    </main>
  );
}
