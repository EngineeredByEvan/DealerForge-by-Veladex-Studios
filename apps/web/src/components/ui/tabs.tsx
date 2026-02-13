import { ReactNode } from 'react';

export function Tabs({ children }: { children: ReactNode }): JSX.Element { return <div>{children}</div>; }
export function TabsList({ children }: { children: ReactNode }): JSX.Element { return <div style={{ display: 'flex', gap: 8 }}>{children}</div>; }
export function TabsTrigger({ children }: { children: ReactNode }): JSX.Element { return <button className="btn btn-secondary">{children}</button>; }
export function TabsContent({ children }: { children: ReactNode }): JSX.Element { return <div>{children}</div>; }
