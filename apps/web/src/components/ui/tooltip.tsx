import { ReactNode } from 'react';

export function Tooltip({ children }: { content: string; children: ReactNode }): JSX.Element {
  return <>{children}</>;
}
