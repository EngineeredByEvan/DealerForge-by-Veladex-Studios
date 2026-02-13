'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import {
  createDealershipPlatform,
  createPlatformMembership,
  Dealership,
  fetchDealershipsPlatform,
  fetchPlatformUsers,
  PlatformMembership,
  PlatformUser,
  updateDealershipPlatform,
  updatePlatformMembership
} from '@/lib/api';

export default function PlatformPage(): JSX.Element {
  const { push } = useToast();
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Dealership | null>(null);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editTimezone, setEditTimezone] = useState('UTC');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const [membershipDealershipId, setMembershipDealershipId] = useState('');
  const [membershipRole, setMembershipRole] = useState<PlatformMembership['role']>('MANAGER');

  async function load(query?: string): Promise<void> {
    const [nextDealerships, nextUsers] = await Promise.all([
      fetchDealershipsPlatform(query),
      fetchPlatformUsers()
    ]);
    setDealerships(nextDealerships);
    setUsers(nextUsers);
  }

  useEffect(() => {
    void load().catch(() => push('Unable to load platform data'));
  }, [push]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await createDealershipPlatform({ name, slug, timezone });
    push('Dealership created');
    setCreateOpen(false);
    setName('');
    setSlug('');
    setTimezone('UTC');
    await load(search);
  }

  function openEdit(dealership: Dealership): void {
    setSelected(dealership);
    setEditName(dealership.name);
    setEditSlug(dealership.slug);
    setEditTimezone(dealership.timezone);
    setEditStatus(dealership.status);
    setEditOpen(true);
  }

  async function onEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected) return;

    await updateDealershipPlatform(selected.id, {
      name: editName,
      slug: editSlug,
      timezone: editTimezone,
      status: editStatus
    });

    push('Dealership updated');
    setEditOpen(false);
    setSelected(null);
    await load(search);
  }

  async function onAddMembership(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedUser || !membershipDealershipId) return;

    await createPlatformMembership(selectedUser.id, {
      dealershipId: membershipDealershipId,
      role: membershipRole,
      isActive: true
    });

    setMembershipDealershipId('');
    setMembershipRole('MANAGER');
    push('Membership assigned');
    await load(search);
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader title="Platform" subtitle="Provision dealerships and manage cross-rooftop access." />
      <SectionCard title="Dealerships">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Input placeholder="Search by name or slug" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button onClick={() => load(search).catch(() => push('Search failed'))}>Search</Button>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>Create dealership</Button>
        </div>
        <Table>
          <thead><tr><th>Name</th><th>Slug</th><th>Timezone</th><th>Status</th><th /></tr></thead>
          <tbody>
            {dealerships.map((dealership) => (
              <tr key={dealership.id}>
                <td>{dealership.name}</td>
                <td>{dealership.slug}</td>
                <td>{dealership.timezone}</td>
                <td>{dealership.status}</td>
                <td><Button variant="ghost" onClick={() => openEdit(dealership)}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>

      <SectionCard title="User Access">
        <p style={{ marginBottom: 12, color: 'var(--muted-foreground)' }}>Operator-only access assignment across dealerships.</p>
        <Table>
          <thead><tr><th>User</th><th>Platform Role</th><th>Memberships</th><th /></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.firstName} {user.lastName}<br /><small>{user.email}</small></td>
                <td>{user.isPlatformAdmin ? 'ADMIN' : user.isPlatformOperator ? 'OPERATOR' : 'NONE'}</td>
                <td>{user.dealerships.filter((membership) => membership.isActive).length}</td>
                <td><Button variant="ghost" onClick={() => setSelectedUser(user)}>Manage</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="Create dealership">
        <form className="form-grid" onSubmit={(event) => void onCreate(event).catch(() => push('Unable to create dealership'))}>
          <Input required placeholder="Dealership name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input required placeholder="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
          <Input required placeholder="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          <Button type="submit">Create</Button>
        </form>
      </Modal>

      {editOpen ? (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal" style={{ marginLeft: 'auto', height: '100vh', maxWidth: 480 }} onClick={(event) => event.stopPropagation()}>
            <h3>Edit dealership</h3>
            <form className="form-grid" onSubmit={(event) => void onEdit(event).catch(() => push('Unable to update dealership'))}>
              <Input required value={editName} onChange={(event) => setEditName(event.target.value)} />
              <Input required value={editSlug} onChange={(event) => setEditSlug(event.target.value)} />
              <Input required value={editTimezone} onChange={(event) => setEditTimezone(event.target.value)} />
              <select className="input" value={editStatus} onChange={(event) => setEditStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
              <Button type="submit">Save changes</Button>
            </form>
          </div>
        </div>
      ) : null}

      {selectedUser ? (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal" style={{ marginLeft: 'auto', height: '100vh', maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
            <h3>Manage {selectedUser.firstName} {selectedUser.lastName}</h3>
            <form className="form-grid" onSubmit={(event) => void onAddMembership(event).catch(() => push('Unable to assign membership'))}>
              <select className="input" required value={membershipDealershipId} onChange={(event) => setMembershipDealershipId(event.target.value)}>
                <option value="">Select dealership</option>
                {dealerships.map((dealership) => <option key={dealership.id} value={dealership.id}>{dealership.name}</option>)}
              </select>
              <select className="input" value={membershipRole} onChange={(event) => setMembershipRole(event.target.value as PlatformMembership['role'])}>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="BDC">BDC</option>
                <option value="SALES">SALES</option>
              </select>
              <Button type="submit">Add membership</Button>
            </form>
            <Table>
              <thead><tr><th>Dealership</th><th>Role</th><th>Status</th><th /></tr></thead>
              <tbody>
                {selectedUser.dealerships.map((membership) => (
                  <tr key={membership.dealershipId}>
                    <td>{membership.dealership.name}</td>
                    <td>{membership.role}</td>
                    <td>{membership.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          void updatePlatformMembership(selectedUser.id, membership.dealershipId, { isActive: !membership.isActive })
                            .then(async () => {
                              push('Membership updated');
                              await load(search);
                              const refreshed = (await fetchPlatformUsers()).find((user) => user.id === selectedUser.id) ?? null;
                              setSelectedUser(refreshed);
                            })
                            .catch(() => push('Unable to update membership'));
                        }}
                      >
                        {membership.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
