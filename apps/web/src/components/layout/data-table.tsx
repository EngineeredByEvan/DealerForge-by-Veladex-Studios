import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';
import { TableContainer } from '@/components/ui/table';

export function DataTableShell({ loading, empty, toolbar, children }: { loading: boolean; empty: boolean; toolbar?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input placeholder="Search records" readOnly style={{ maxWidth: 320 }} />
        {toolbar}
      </div>
      {loading ? <div style={{ display: 'grid', gap: 8 }}>{Array.from({ length: 5 }).map((_, idx) => <SkeletonLoader key={idx} />)}</div> : empty ? <div className="card" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--muted-foreground)' }}>No records found.</div> : <TableContainer>{children}</TableContainer>}
    </div>
  );
}
