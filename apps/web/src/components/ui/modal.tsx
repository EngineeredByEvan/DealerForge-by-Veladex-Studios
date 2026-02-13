import { ReactNode } from 'react';
import { Button } from './button';

export function Modal({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={() => onOpenChange(false)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
        {children}
      </div>
    </div>
  );
}
