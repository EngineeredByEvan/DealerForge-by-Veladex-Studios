'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  CreateTaskPayload,
  Task,
  TaskStatus,
  completeTask,
  createTask,
  fetchTasks,
  snoozeTask
} from '@/lib/api';

const STATUS_OPTIONS: TaskStatus[] = ['OPEN', 'DONE', 'SNOOZED', 'CANCELED'];

export default function TasksPage(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const result = await fetchTasks(statusFilter === 'ALL' ? undefined : { status: statusFilter });
      setTasks(result);
      setError(null);
    } catch {
      setError('Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [statusFilter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    const payload: CreateTaskPayload = {
      title,
      description: description || undefined,
      dueAt: dueAt || undefined
    };

    try {
      const created = await createTask(payload);
      setTasks((previous) => [created, ...previous]);
      setTitle('');
      setDescription('');
      setDueAt('');
      setError(null);
    } catch {
      setError('Unable to create task');
    }
  }

  async function handleComplete(taskId: string): Promise<void> {
    try {
      const updated = await completeTask(taskId);
      setTasks((previous) => previous.map((task) => (task.id === taskId ? updated : task)));
      setError(null);
    } catch {
      setError('Unable to complete task');
    }
  }

  async function handleSnooze(taskId: string): Promise<void> {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    try {
      const updated = await snoozeTask(taskId, tomorrow);
      setTasks((previous) => previous.map((task) => (task.id === taskId ? updated : task)));
      setError(null);
    } catch {
      setError('Unable to snooze task');
    }
  }

  return (
    <main>
      <h1>Tasks</h1>
      {error ? <p>{error}</p> : null}

      <section>
        <h2>Create Task</h2>
        <form onSubmit={(event) => void handleCreate(event)}>
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />

          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <label htmlFor="dueAt">Due date/time</label>
          <input
            id="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />

          <button type="submit">Create Task</button>
        </form>
      </section>

      <section>
        <h2>Task List</h2>
        <label htmlFor="statusFilter">Filter by status</label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'ALL')}
        >
          <option value="ALL">ALL</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {loading ? <p>Loading tasks...</p> : null}
        {!loading && tasks.length === 0 ? <p>No tasks found. Create your first follow-up task above.</p> : null}
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong> ({task.status})
              <p>{task.description ?? 'No description'}</p>
              <p>Due: {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}</p>
              <p>Lead: {task.leadId ?? '—'}</p>
              <button type="button" disabled={task.status === 'DONE'} onClick={() => void handleComplete(task.id)}>
                Complete
              </button>
              <button
                type="button"
                disabled={task.status === 'DONE' || task.status === 'CANCELED'}
                onClick={() => void handleSnooze(task.id)}
              >
                Snooze +1d
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
