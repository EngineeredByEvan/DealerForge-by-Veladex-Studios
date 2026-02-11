'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AuthMeResponse,
  HealthResponse,
  ReportOverviewResponse,
  ReportResponseTimeResponse,
  apiWithTenant,
  clearAuth,
  fetchMe,
  fetchReportsOverview,
  fetchReportsResponseTime,
  fetchTenantHealth,
  getSelectedDealershipId,
  setSelectedDealershipId
} from '@/lib/api';

type LeadsStatus = {
  ok: boolean;
  details: string;
};

function KpiCard(props: { title: string; value: string | number; subtitle?: string }): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid #d4d4d8',
        borderRadius: 12,
        padding: 16,
        minWidth: 180,
        background: '#ffffff'
      }}
    >
      <p style={{ margin: 0, color: '#52525b', fontSize: 12 }}>{props.title}</p>
      <p style={{ margin: '6px 0', fontSize: 24, fontWeight: 700 }}>{props.value}</p>
      {props.subtitle ? <p style={{ margin: 0, color: '#71717a', fontSize: 12 }}>{props.subtitle}</p> : null}
    </div>
  );
}

export default function DashboardPage(): JSX.Element {
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedDealership, setSelectedDealership] = useState<string>('');
  const [leadsStatus, setLeadsStatus] = useState<LeadsStatus | null>(null);
  const [overview, setOverview] = useState<ReportOverviewResponse | null>(null);
  const [responseTime, setResponseTime] = useState<ReportResponseTimeResponse | null>(null);

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
    async function loadKpis(): Promise<void> {
      if (!selectedDealership) {
        setLeadsStatus({ ok: false, details: 'No dealership selected' });
        setOverview(null);
        setResponseTime(null);
        return;
      }

      try {
        const [leadsResponse, overviewResponse, responseTimeResponse] = await Promise.all([
          apiWithTenant('/leads'),
          fetchReportsOverview(),
          fetchReportsResponseTime()
        ]);

        setLeadsStatus({
          ok: leadsResponse.ok,
          details: leadsResponse.ok ? 'Accessible' : `HTTP ${leadsResponse.status}`
        });
        setOverview(overviewResponse);
        setResponseTime(responseTimeResponse);
      } catch {
        setLeadsStatus({ ok: false, details: 'Unable to load KPIs' });
        setOverview(null);
        setResponseTime(null);
      }
    }

    void loadKpis();
  }, [selectedDealership]);

  const currentDealership = useMemo(
    () => profile?.dealerships.find((dealership) => dealership.dealershipId === selectedDealership),
    [profile, selectedDealership]
  );

  return (
    <main style={{ padding: 16 }}>
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

      <section style={{ marginTop: 18 }}>
        <h2>Reporting KPIs</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <KpiCard title="Leads (Today)" value={overview?.today.leads ?? '-'} />
          <KpiCard title="Leads (Week)" value={overview?.week.leads ?? '-'} />
          <KpiCard title="Leads (Month)" value={overview?.month.leads ?? '-'} />
          <KpiCard title="Appointments (Month)" value={overview?.month.appointments ?? '-'} />
          <KpiCard title="Shows (Month)" value={overview?.month.shows ?? '-'} />
          <KpiCard title="Sold (Month)" value={overview?.month.sold ?? '-'} />
          <KpiCard
            title="Avg First Response"
            value={
              responseTime?.averageMinutes !== null && responseTime?.averageMinutes !== undefined
                ? `${responseTime.averageMinutes} min`
                : '-'
            }
            subtitle={
              responseTime
                ? `${responseTime.sampleSize} lead${responseTime.sampleSize === 1 ? '' : 's'} measured`
                : undefined
            }
          />
        </div>
      </section>
    </main>
  );
}
