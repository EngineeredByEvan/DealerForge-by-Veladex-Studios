import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export function SectionCard({ title, children }: { title?: string; children: ReactNode }): JSX.Element {
  return <Card>{title ? <h2 className="section-title">{title}</h2> : null}{children}</Card>;
}
