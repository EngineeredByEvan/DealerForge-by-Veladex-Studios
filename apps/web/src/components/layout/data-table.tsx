import { ReactNode } from 'react';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';
import { TableContainer } from '@/components/ui/table';

export function DataTableShell({
  loading,
  empty,
  toolbar,
  emptyState,
  pagination,
  children
}: {
  loading: boolean;
  empty: boolean;
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  pagination?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="table-shell">
      <div className="table-toolbar">{toolbar}</div>
      {loading ? (
        <div className="table-skeletons">{Array.from({ length: 6 }).map((_, idx) => <SkeletonLoader key={idx} />)}</div>
      ) : empty ? (
        <div className="table-empty">{emptyState ?? 'No records found.'}</div>
      ) : (
        <>
          <TableContainer>{children}</TableContainer>
          <div className="table-pagination">{pagination ?? <span>Page 1 of 1</span>}</div>
        </>
      )}
    </div>
  );
}
