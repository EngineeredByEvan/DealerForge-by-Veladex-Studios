'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CommunicationTemplate, createTemplate, fetchTemplates } from '@/lib/api';

export default function TemplatesPage(): JSX.Element {
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function load(): Promise<void> {
    const all = await fetchTemplates();
    setTemplates(all);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await createTemplate({ channel, name, subject: channel === 'EMAIL' ? subject : undefined, body });
    setName('');
    setSubject('');
    setBody('');
    await load();
  }

  const current = useMemo(() => templates.filter((item) => item.channel === channel), [channel, templates]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <PageHeader title="Templates" subtitle="Manage reusable email and text templates." />
      <SectionCard title="Create template">
        <form onSubmit={onSubmit} className="lead-form-stack">
          <Select value={channel} onChange={(event) => setChannel(event.target.value as 'EMAIL' | 'SMS')}>
            <option value="EMAIL">Email</option>
            <option value="SMS">Text (SMS)</option>
          </Select>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" />
          {channel === 'EMAIL' ? <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" /> : null}
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="Body with placeholders, e.g. {{firstName}}" />
          <p>Available placeholders: {{'{firstName}'}}, {{'{lastName}'}}, {{'{vehicle}'}}, {{'{dealershipName}'}}, {{'{salespersonName}'}}</p>
          <Button type="submit">Save template</Button>
        </form>
      </SectionCard>
      <SectionCard title={`${channel} templates`}>
        <div className="timeline-list">
          {current.map((template) => <div key={template.id} className="timeline-item static"><strong>{template.name}</strong>{template.subject ? <p>{template.subject}</p> : null}<p>{template.body}</p></div>)}
        </div>
      </SectionCard>
    </div>
  );
}
