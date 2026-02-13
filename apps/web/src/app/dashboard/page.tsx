'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  AuthMeResponse,
  HealthResponse,
  ReportOverviewResponse,
  ReportResponseTimeResponse,
  apiWithTenant,
  fetchMe,
  fetchReportsOverview,
  fetchReportsResponseTime,
  fetchTenantHealth,
  getSelectedDealershipId,
  setSelectedDealershipId
} from '@/lib/api';

export default function DashboardPage(): JSX.Element {
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedDealership, setSelectedDealership] = useState('');
  const [overview, setOverview] = useState<ReportOverviewResponse | null>(null);
  const [responseTime, setResponseTime] = useState<ReportResponseTimeResponse | null>(null);
  const [leadRouteStatus, setLeadRouteStatus] = useState('Checking...');

  useEffect(() => {
    void Promise.all([fetchMe(), fetchTenantHealth()]).then(([me, healthData]) => {
      setProfile(me);
      setHealth(healthData);
      const active = getSelectedDealershipId() ?? me.dealerships[0]?.dealershipId ?? '';
      setSelectedDealership(active);
      if (active) setSelectedDealershipId(active);
    });
  }, []);

  useEffect(() => {
    if (!selectedDealership) return;
    void Promise.all([apiWithTenant('/leads'), fetchReportsOverview(), fetchReportsResponseTime()]).then(([leadResponse, overviewData, responseData]) => {
      setLeadRouteStatus(leadResponse.ok ? 'Accessible' : `HTTP ${leadResponse.status}`);
      setOverview(overviewData);
      setResponseTime(responseData);
    });
  }, [selectedDealership]);

  const currentDealership = useMemo(() => profile?.dealerships.find((d) => d.dealershipId === selectedDealership)?.dealershipName ?? 'None', [profile, selectedDealership]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PageHeader title="Dashboard" subtitle="Executive-level visibility into dealership pipeline and response quality." actions={<div style={{ width: 300 }}><Select value={selectedDealership} onChange={(event) => { setSelectedDealership(event.target.value); setSelectedDealershipId(event.target.value); }}>{profile?.dealerships.map((dealership) => <option key={dealership.dealershipId} value={dealership.dealershipId}>{dealership.dealershipName}</option>)}</Select></div>} />

      <SectionCard>
        <div className="grid kpi-grid">
          <Card><small>Leads Today</small><h2>{overview?.today.leads ?? '-'}</h2><small style={{ color: 'var(--success)' }}>↗ +8%</small></Card>
          <Card><small>Leads This Week</small><h2>{overview?.week.leads ?? '-'}</h2><small style={{ color: 'var(--success)' }}>↗ +12%</small></Card>
          <Card><small>Appointments</small><h2>{overview?.month.appointments ?? '-'}</h2><small style={{ color: 'var(--success)' }}>↗ +5%</small></Card>
          <Card><small>Sold This Month</small><h2>{overview?.month.sold ?? '-'}</h2><small style={{ color: 'var(--success)' }}>↗ +3%</small></Card>
          <Card><small>Avg. First Response</small><h2>{responseTime?.averageMinutes ? `${responseTime.averageMinutes} min` : '-'}</h2><small style={{ color: 'var(--info)' }}>Fast lane</small></Card>
        </div>
      </SectionCard>

      <SectionCard title="System & Tenant Health">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div><small>Selected dealership</small><p><strong>{currentDealership}</strong></p></div>
          <div><small>API service</small><p><strong>{health?.service ?? 'Unknown'}</strong></p></div>
          <div><small>Tenant /leads route</small><p><Badge>{leadRouteStatus}</Badge></p></div>
        </div>
      </SectionCard>
    </div>
  );
}
