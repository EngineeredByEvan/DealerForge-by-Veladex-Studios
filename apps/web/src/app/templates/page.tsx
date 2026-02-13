'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CommunicationTemplate, createTemplate, deleteTemplate, fetchTemplates, updateTemplate } from '@/lib/api';

const PLACEHOLDERS = ['{firstName}', '{lastName}', '{vehicle}', '{dealershipName}', '{salespersonName}'];

export default function TemplatesPage(): JSX.Element {
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function load(): Promise<void> {
    setTemplates(await fetchTemplates());
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (editingId) {
      await updateTemplate(editingId, { channel, name, subject: channel === 'EMAIL' ? subject : undefined, body });
    } else {
      await createTemplate({ channel, name, subject: channel === 'EMAIL' ? subject : undefined, body });
    }
    setEditingId(null);
    setName('');
    setSubject('');
    setBody('');
    await load();
  }

  const current = useMemo(() => templates.filter((item) => item.channel === channel), [channel, templates]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <PageHeader title="Templates" subtitle="Manage reusable email and text templates." />
      <SectionCard title={editingId ? 'Edit template' : 'Create template'}>
        <form onSubmit={onSubmit} className="lead-form-stack">
          <Select value={channel} onChange={(event) => setChannel(event.target.value as 'EMAIL' | 'SMS')}>
            <option value="EMAIL">Email</option>
            <option value="SMS">Text (SMS)</option>
          </Select>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" required />
          {channel === 'EMAIL' ? <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" /> : null}
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="Body with placeholders, e.g. {{firstName}}" required />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLACEHOLDERS.map((placeholder) => (
              <code key={placeholder}>{placeholder}</code>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit">{editingId ? 'Update template' : 'Save template'}</Button>
            {editingId ? <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setName(''); setSubject(''); setBody(''); }}>Cancel</Button> : null}
          </div>
        </form>
      </SectionCard>
      <SectionCard title={`${channel} templates`}>
        <div className="timeline-list">
          {current.map((template) => (
            <div key={template.id} className="timeline-item static">
              <strong>{template.name}</strong>
              {template.subject ? <p>{template.subject}</p> : null}
              <p>{template.body}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="button" variant="secondary" onClick={() => { setEditingId(template.id); setChannel(template.channel as 'EMAIL' | 'SMS'); setName(template.name); setSubject(template.subject ?? ''); setBody(template.body); }}>Edit</Button>
                <Button type="button" variant="ghost" onClick={async () => { await deleteTemplate(template.id); await load(); }}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
