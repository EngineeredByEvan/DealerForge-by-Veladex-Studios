'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTableShell } from '@/components/layout/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import {
  ReportsBreakdownDimension,
  ReportsBreakdownRow,
  ReportsFilters,
  ReportsSummary,
  ReportsTrendMetric,
  ReportsTrendPoint,
  fetchLeads,
  fetchReportsBreakdown,
  fetchReportsSummary,
  fetchReportsTrends
} from '@/lib/api';

function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60_000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ReportsPage(): JSX.Element {
  const range = useMemo(defaultRange, []);
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [source, setSource] = useState('');
  const [assignedUser, setAssignedUser] = useState('');
  const [status, setStatus] = useState('');
  const [leadType, setLeadType] = useState('');
  const [dimension, setDimension] = useState<ReportsBreakdownDimension>('source');
  const [metric, setMetric] = useState<ReportsTrendMetric>('leads');

  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [breakdown, setBreakdown] = useState<ReportsBreakdownRow[]>([]);
  const [trends, setTrends] = useState<ReportsTrendPoint[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters: ReportsFilters = {
    start: `${start}T00:00:00.000Z`,
    end: `${end}T23:59:59.999Z`,
    source: source || undefined,
    assignedUser: assignedUser || undefined,
    status: status || undefined,
    leadType: leadType || undefined
  };

  useEffect(() => {
    void fetchLeads()
      .then((leads) => {
        setSources(Array.from(new Set(leads.map((lead) => lead.source?.name).filter((value): value is string => Boolean(value)))));
        setUsers(Array.from(new Set(leads.map((lead) => lead.assignedToUserId).filter((value): value is string => Boolean(value)))));
      })
      .catch(() => {
        setSources([]);
        setUsers([]);
      });
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const [summaryRes, breakdownRes, trendsRes] = await Promise.all([
        fetchReportsSummary(filters),
        fetchReportsBreakdown(dimension, filters),
        fetchReportsTrends(metric, filters)
      ]);
      setSummary(summaryRes);
      setBreakdown(breakdownRes);
      setTrends(trendsRes);
      setError(null);
    } catch {
      setError('Unable to load reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, source, assignedUser, status, leadType, dimension, metric]);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <PageHeader title="Reports" subtitle="Operator-focused performance analytics from event logs." />
      {error ? <p className="error">{error}</p> : null}

      <SectionCard title="Filters">
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          <Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          <Select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            {sources.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
          <Select value={assignedUser} onChange={(event) => setAssignedUser(event.target.value)}>
            <option value="">All assigned users</option>
            {users.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
          <Input placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
          <Input placeholder="Lead type" value={leadType} onChange={(event) => setLeadType(event.target.value)} />
          <Button onClick={() => void load()}>Refresh</Button>
        </div>
      </SectionCard>

      <SectionCard title="KPIs">
        <div className="kpi-grid">
          <div className="kpi-card"><small>Total Leads</small><h2>{summary?.total_leads ?? '—'}</h2></div>
          <div className="kpi-card"><small>Appointments Set</small><h2>{summary?.appointments_set ?? '—'}</h2></div>
          <div className="kpi-card"><small>Appointments Showed</small><h2>{summary?.appointments_showed ?? '—'}</h2></div>
          <div className="kpi-card"><small>Show Rate</small><h2>{summary ? percent(summary.show_rate) : '—'}</h2></div>
          <div className="kpi-card"><small>Appointment Rate</small><h2>{summary ? percent(summary.appointment_rate) : '—'}</h2></div>
          <div className="kpi-card"><small>Sold Count</small><h2>{summary?.sold_count ?? '—'}</h2></div>
          <div className="kpi-card"><small>Close Rate</small><h2>{summary ? percent(summary.close_rate) : '—'}</h2></div>
        </div>
      </SectionCard>

      <SectionCard title="Trends">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ maxWidth: 240 }}>
            <Select value={metric} onChange={(event) => setMetric(event.target.value as ReportsTrendMetric)}>
              <option value="leads">Leads</option>
              <option value="appointments">Appointments</option>
              <option value="sold">Sold</option>
            </Select>
          </div>
          {loading ? (
            <div className="table-skeletons"><div className="skeleton" /></div>
          ) : trends.length === 0 ? (
            <div className="table-empty">No trend data for selected filters.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {trends.map((point) => (
                <div key={point.period} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 50px', gap: 10, alignItems: 'center' }}>
                  <small>{new Date(point.period).toLocaleDateString()}</small>
                  <div style={{ background: 'var(--border)', borderRadius: 8, height: 10 }}>
                    <div style={{ width: `${Math.max(4, point.value * 8)}px`, background: 'var(--primary)', height: '100%', borderRadius: 8 }} />
                  </div>
                  <small>{point.value}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Breakdown">
        <DataTableShell
          loading={loading}
          empty={!loading && breakdown.length === 0}
          toolbar={<div style={{ maxWidth: 240 }}><Select value={dimension} onChange={(event) => setDimension(event.target.value as ReportsBreakdownDimension)}><option value="source">Source</option><option value="assignedUser">Assigned User</option><option value="status">Status</option></Select></div>}
          emptyState={<div>No breakdown data for selected filters.</div>}
          pagination={<span>Rows: {breakdown.length}</span>}
        >
          <Table>
            <thead>
              <tr><th>{dimension}</th><th>Leads</th><th>Appt Set</th><th>Appt Showed</th><th>Sold</th><th>Appt Rate</th><th>Show Rate</th><th>Close Rate</th></tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.key}><td>{row.key}</td><td>{row.total_leads}</td><td>{row.appointments_set}</td><td>{row.appointments_showed}</td><td>{row.sold_count}</td><td>{percent(row.appointment_rate)}</td><td>{percent(row.show_rate)}</td><td>{percent(row.close_rate)}</td></tr>
              ))}
            </tbody>
          </Table>
        </DataTableShell>
      </SectionCard>
    </div>
  );
}
