'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AuthMeResponse,
  HealthResponse,
  apiWithTenant,
  clearAuth,
  fetchMe,
  fetchTenantHealth,
  getSelectedDealershipId,
  setSelectedDealershipId
} from '@/lib/api';

type LeadsStatus = {
  ok: boolean;
  details: string;
};

export default function DashboardPage(): JSX.Element {
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedDealership, setSelectedDealership] = useState<string>('');
  const [leadsStatus, setLeadsStatus] = useState<LeadsStatus | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [me, healthData] = await Promise.all([fetchMe(), fetchTenantHealth()]);
        setProfile(me);
        setHealth(healthData);

        const storedDealershipId = getSelectedDealershipId();
        const firstDealershipId = me.dealerships[0]?.dealershipId;
        const activeDealershipId = storedDealershipId ?? firstDealershipId ?? '';
        setSelectedDealership(activeDealershipId);
        if (activeDealershipId) {
          setSelectedDealershipId(activeDealershipId);
        }
      } catch {
        clearAuth();
      }
    }

    void load();
  }, []);

  useEffect(() => {
    async function checkLeads(): Promise<void> {
      if (!selectedDealership) {
        setLeadsStatus({ ok: false, details: 'No dealership selected' });
        return;
      }

      const response = await apiWithTenant('/leads');
      setLeadsStatus({ ok: response.ok, details: response.ok ? 'Accessible' : `HTTP ${response.status}` });
    }

    void checkLeads();
  }, [selectedDealership]);

  const currentDealership = useMemo(
    () => profile?.dealerships.find((dealership) => dealership.dealershipId === selectedDealership),
    [profile, selectedDealership]
  );

  return (
    <main>
      <h1>DealerForge Dashboard</h1>
      <p>
        Current user:{' '}
        {profile ? `${profile.firstName} ${profile.lastName} (${profile.email})` : 'Not authenticated'}
      </p>
      <label htmlFor="dealership-select">Dealership</label>
      <select
        id="dealership-select"
        value={selectedDealership}
        onChange={(event) => {
          const dealershipId = event.target.value;
          setSelectedDealership(dealershipId);
          setSelectedDealershipId(dealershipId);
        }}
      >
        {profile?.dealerships.map((dealership) => (
          <option key={dealership.dealershipId} value={dealership.dealershipId}>
            {dealership.dealershipName} ({dealership.role})
          </option>
        ))}
      </select>
      <p>Selected dealership: {currentDealership?.dealershipName ?? 'None'}</p>
      <p>API status: {health?.status ?? 'Unknown'}</p>
      <p>Service: {health?.service ?? 'Unknown'}</p>
      <p>Timestamp: {health?.timestamp ?? 'Unknown'}</p>
      <p>Tenant route /leads: {leadsStatus ? `${leadsStatus.details}` : 'Checking...'}</p>
    </main>
  );
}
