'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAuth, fetchMe, getSelectedDealershipId, setSelectedDealershipId } from '@/lib/api';

export function AppShell(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [dealerships, setDealerships] = useState<Array<{ dealershipId: string; dealershipName: string; role: string }>>([]);
  const [selectedDealership, setSelectedDealership] = useState('');

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      if (pathname === '/login') return;

      try {
        const me = await fetchMe();
        setDealerships(me.dealerships);
        const saved = getSelectedDealershipId();
        const defaultId = saved ?? me.dealerships[0]?.dealershipId ?? '';
        setSelectedDealership(defaultId);
        if (defaultId) setSelectedDealershipId(defaultId);
      } catch {
        clearAuth();
        router.push('/login');
      }
    }

    void loadProfile();
  }, [pathname, router]);

  if (pathname === '/login') {
    return <></>;
  }

  return (
    <header style={{ display: 'grid', gap: 12, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #ddd' }}>
      <nav style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/leads">Leads</Link>
        <Link href="/tasks">Tasks</Link>
        <Link href="/appointments">Appointments</Link>
        <Link href="/settings/integrations">Integrations</Link>
        <button
          type="button"
          onClick={() => {
            clearAuth();
            router.push('/login');
          }}
        >
          Logout
        </button>
      </nav>

      <div>
        <label htmlFor="global-dealership-select" style={{ fontWeight: 700 }}>Dealership</label>{' '}
        <select
          id="global-dealership-select"
          value={selectedDealership}
          onChange={(event) => {
            const nextDealership = event.target.value;
            setSelectedDealership(nextDealership);
            setSelectedDealershipId(nextDealership);
          }}
          style={{ minWidth: 260 }}
        >
          <option value="">Select dealership before using CRM</option>
          {dealerships.map((dealership) => (
            <option key={dealership.dealershipId} value={dealership.dealershipId}>
              {dealership.dealershipName} ({dealership.role})
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
