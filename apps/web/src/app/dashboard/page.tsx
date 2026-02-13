'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  Appointment,
  AuthMeResponse,
  HealthResponse,
  Lead,
  apiWithTenant,
  fetchAppointments,
  fetchLeads,
  fetchMe,
  fetchTenantHealth,
  getSelectedDealershipId,
  setSelectedDealershipId
} from '@/lib/api';

type Trend = { value: number | null; direction: 'up' | 'down' | 'neutral' };

type KpiCard = {
  label: string;
  value: string;
  trend: Trend;
  href: string;
  subtitle?: string;
};

function dateInRange(dateIso: string, start: Date, end: Date): boolean {
  const date = new Date(dateIso);
  return date >= start && date < end;
}

function getTrend(current: number, previous: number): Trend {
  if (previous === 0) {
    return current === 0 ? { value: 0, direction: 'neutral' } : { value: null, direction: 'neutral' };
  }
  const value = ((current - previous) / previous) * 100;
  if (value > 0) return { value, direction: 'up' };
  if (value < 0) return { value, direction: 'down' };
  return { value: 0, direction: 'neutral' };
}

function countUpcomingAppointments(appointments: Appointment[], start: Date, end: Date): number {
  return appointments.filter((appointment) => {
    const when = new Date(appointment.start_at);
    return when >= start && when < end && appointment.status !== 'CANCELED';
  }).length;
}

export default function DashboardPage(): JSX.Element {
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedDealership, setSelectedDealership] = useState('');
  const [leadRouteStatus, setLeadRouteStatus] = useState('Checking...');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

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
    void Promise.all([apiWithTenant('/leads'), fetchLeads(), fetchAppointments()]).then(
      ([leadResponse, leadData, appointmentData]) => {
        setLeadRouteStatus(leadResponse.ok ? 'Accessible' : `HTTP ${leadResponse.status}`);
        setLeads(leadData);
        setAppointments(appointmentData);
      }
    );
  }, [selectedDealership]);

  const currentDealership = useMemo(
    () =>
      profile?.dealerships.find((d) => d.dealershipId === selectedDealership)?.dealershipName ??
      'None',
    [profile, selectedDealership]
  );

  const kpis = useMemo<KpiCard[]>(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);

    const dayMs = 24 * 60 * 60 * 1000;
    const weekStart = new Date(startToday);
    weekStart.setDate(startToday.getDate() - startToday.getDay());
    const prevWeekStart = new Date(weekStart.getTime() - 7 * dayMs);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const leadsToday = leads.filter((lead) => dateInRange(lead.createdAt, startToday, now)).length;
    const leadsYesterday = leads.filter((lead) => dateInRange(lead.createdAt, startYesterday, startToday)).length;

    const leadsWeek = leads.filter((lead) => dateInRange(lead.createdAt, weekStart, now)).length;
    const leadsPrevWeek = leads.filter((lead) => dateInRange(lead.createdAt, prevWeekStart, weekStart)).length;

    const appointmentsCurrent = countUpcomingAppointments(appointments, now, new Date(now.getTime() + 7 * dayMs));
    const appointmentsPrev = countUpcomingAppointments(
      appointments,
      new Date(now.getTime() - 7 * dayMs),
      now
    );

    const soldMonth = leads.filter((lead) => lead.status === 'SOLD' && dateInRange(lead.updatedAt, monthStart, now)).length;
    const soldPrevMonth = leads.filter((lead) => lead.status === 'SOLD' && dateInRange(lead.updatedAt, prevMonthStart, monthStart)).length;

    const responseDurations = leads
      .filter((lead) => lead.lastActivityAt)
      .map((lead) => {
        const created = new Date(lead.createdAt).getTime();
        const response = new Date(lead.lastActivityAt as string).getTime();
        return response > created ? (response - created) / 60000 : null;
      })
      .filter((minutes): minutes is number => minutes !== null);

    const avgResponse = responseDurations.length
      ? Math.round(responseDurations.reduce((total, minutes) => total + minutes, 0) / responseDurations.length)
      : null;

    return [
      { label: 'Leads Today', value: String(leadsToday), trend: getTrend(leadsToday, leadsYesterday), href: '/leads?range=today' },
      { label: 'Leads This Week', value: String(leadsWeek), trend: getTrend(leadsWeek, leadsPrevWeek), href: '/leads?range=week' },
      { label: 'Appointments', value: String(appointmentsCurrent), trend: getTrend(appointmentsCurrent, appointmentsPrev), href: '/appointments?range=week' },
      { label: 'Sold This Month', value: String(soldMonth), trend: getTrend(soldMonth, soldPrevMonth), href: '/leads?status=SOLD&range=month' },
      {
        label: 'Avg. First Response',
        value: avgResponse === null ? '—' : `${avgResponse} min`,
        trend: { value: null, direction: 'neutral' },
        href: '/leads?sla=first-response',
        subtitle: avgResponse === null ? 'Coming soon' : 'From lead activity timestamps'
      }
    ];
  }, [appointments, leads]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PageHeader
        title="Dashboard"
        subtitle="Executive-level visibility into dealership pipeline and response quality."
        actions={
          <div style={{ width: 300 }}>
            <Select
              value={selectedDealership}
              onChange={(event) => {
                setSelectedDealership(event.target.value);
                setSelectedDealershipId(event.target.value);
              }}
            >
              {profile?.dealerships.map((dealership) => (
                <option key={dealership.dealershipId} value={dealership.dealershipId}>
                  {dealership.dealershipName}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <SectionCard>
        <div className="kpi-grid">
          {kpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="kpi-card" aria-label={`Open ${kpi.label}`}>
              <small>{kpi.label}</small>
              <h2>{kpi.value}</h2>
              <small className={`kpi-trend ${kpi.trend.direction}`}>
                {kpi.trend.direction === 'up' ? '↑' : kpi.trend.direction === 'down' ? '↓' : '→'}{' '}
                {kpi.trend.value === null ? '—' : `${kpi.trend.value > 0 ? '+' : ''}${Math.round(kpi.trend.value)}%`}
              </small>
              {kpi.subtitle ? <small style={{ color: 'var(--muted-foreground)' }}>{kpi.subtitle}</small> : null}
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="System & Tenant Health">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div>
            <small>Selected dealership</small>
            <p>
              <strong>{currentDealership}</strong>
            </p>
          </div>
          <div>
            <small>API service</small>
            <p>
              <strong>{health?.service ?? 'Unknown'}</strong>
            </p>
          </div>
          <div>
            <small>Tenant /leads route</small>
            <p>
              <Badge>{leadRouteStatus}</Badge>
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
