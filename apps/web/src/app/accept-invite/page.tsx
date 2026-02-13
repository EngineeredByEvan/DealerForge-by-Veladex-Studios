'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { acceptInvitation, fetchInvitation } from '@/lib/api';

export default function AcceptInvitePage(): JSX.Element {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<{ email: string; role: string; dealershipName: string; expiresAt: string; status: string } | null>(null);

  useEffect(() => {
    async function loadInvitation(): Promise<void> {
      if (!token) {
        setError('Missing invitation token.');
        setLoading(false);
        return;
      }

      try {
        setInvitation(await fetchInvitation(token));
      } catch {
        setError('Unable to load invitation.');
      } finally {
        setLoading(false);
      }
    }

    void loadInvitation();
  }, [token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await acceptInvitation({ token, firstName, lastName, password });
      router.push('/dashboard');
    } catch {
      setError('Unable to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main>Loading invitation...</main>;

  return (
    <main className="page" style={{ maxWidth: 540, margin: '0 auto' }}>
      <h1>Accept invitation</h1>
      {error ? <p className="error">{error}</p> : null}
      {invitation ? (
        <>
          <p>Dealership: <strong>{invitation.dealershipName}</strong></p>
          <p>Role: <strong>{invitation.role}</strong></p>
          <p>Email: <strong>{invitation.email}</strong></p>
          <p>Status: <strong>{invitation.status}</strong></p>
          <form className="form-grid" onSubmit={onSubmit}>
            <Input placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            <Input placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            <Input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            <Button type="submit" disabled={submitting || invitation.status !== 'PENDING'}>{submitting ? 'Submitting...' : 'Create account & continue'}</Button>
          </form>
        </>
      ) : null}
    </main>
  );
}
