import { ReactNode, useState } from 'react';

export function DropdownMenu({ trigger, children }: { trigger: ReactNode; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  return <div style={{ position: 'relative' }}><div onClick={() => setOpen((v) => !v)}>{trigger}</div>{open ? <div className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', padding: 6, minWidth: 160 }}>{children}</div> : null}</div>;
}

export function DropdownItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }): JSX.Element {
  return <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={onSelect}>{children}</button>;
}
