'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async (): Promise<void> => {
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
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="grid" style={{ gap: 18 }}>
      <PageHeader title="Tasks" subtitle="Track follow-ups with cleaner workflows and status-based controls." />
      {error ? <p className="error">{error}</p> : null}

      <SectionCard title="Create Task">
        <form onSubmit={(event) => void handleCreate(event)} className="form-grid">
          <FormField label="Title" htmlFor="title" description="A concise action-focused task name" error={!title.trim() && error ? 'Title required' : null}>
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </FormField>
          <FormField label="Due date/time" htmlFor="dueAt" hint="Optional">
            <Input id="dueAt" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </FormField>
          <FormField label="Description" htmlFor="description" description="Add context for the assigned rep">
            <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </FormField>
          <div style={{ alignSelf: 'end' }}>
            <Button type="submit">Create Task</Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Task List">
        <DataTableShell
          loading={loading}
          empty={!loading && tasks.length === 0}
          toolbar={
            <div className="filter-bar">
              <FormField label="Status" htmlFor="statusFilter">
                <Select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'ALL')}
                >
                  <option value="ALL">All statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          }
          emptyState={<div><p>No tasks found.</p><Button variant="secondary">Create your first task</Button></div>}
          pagination={<><span>Showing {tasks.length} tasks</span><Button variant="ghost">Next</Button></>}
        >
          <Table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Due</th>
                <th>Lead</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td><Badge>{task.status}</Badge></td>
                  <td>{task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}</td>
                  <td>{task.leadId ?? '—'}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <Button type="button" variant="secondary" disabled={task.status === 'DONE'} onClick={() => void handleComplete(task.id)}>
                      Complete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={task.status === 'DONE' || task.status === 'CANCELED'}
                      onClick={() => void handleSnooze(task.id)}
                    >
                      Snooze +1d
                    </Button>
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
