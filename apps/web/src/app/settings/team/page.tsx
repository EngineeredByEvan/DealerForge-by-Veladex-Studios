'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { TeamMembership, deactivateTeamUser, fetchTeamUsers, inviteTeamUser, setTeamUserRole } from '@/lib/api';

const ROLES: TeamMembership['role'][] = ['ADMIN', 'MANAGER', 'BDC', 'SALES'];

export default function TeamSettingsPage(): JSX.Element {
  const [users, setUsers] = useState<TeamMembership[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMembership['role']>('SALES');
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');

  async function load(): Promise<void> {
    try {
      setUsers(await fetchTeamUsers());
    } catch {
      setError('Unable to load team users.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    try {
      const response = await inviteTeamUser({ email, role });
      setInviteToken(response.token);
      setEmail('');
      setRole('SALES');
    } catch {
      setError('Unable to invite user.');
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader title="Team" subtitle="Manage dealership users and roles." />
      {error ? <p className="error">{error}</p> : null}
      <SectionCard title="Invite user">
        <form className="form-grid" onSubmit={onInvite}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="new.user@dealer.com" />
          <Select value={role} onChange={(e) => setRole(e.target.value as TeamMembership['role'])}>
            {ROLES.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <Button type="submit">Invite</Button>
        </form>
        {inviteToken ? <p>Invite token: <code>{inviteToken}</code></p> : null}
      </SectionCard>
      <SectionCard title="Users">
        <Table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((member) => (
              <tr key={member.id}>
                <td>{member.user.firstName} {member.user.lastName}</td>
                <td>{member.user.email}</td>
                <td>
                  <Select
                    value={member.role}
                    onChange={async (event) => {
                      await setTeamUserRole(member.userId, event.target.value as TeamMembership['role']);
                      await load();
                    }}
                  >
                    {ROLES.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                </td>
                <td>{member.isActive ? 'Yes' : 'No'}</td>
                <td><Button variant="ghost" onClick={async () => { await deactivateTeamUser(member.userId); await load(); }}>Deactivate</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    </div>
  );
}
