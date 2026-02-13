import { ReactNode } from 'react';

export function FormSection({ children }: { children: ReactNode }): JSX.Element {
  return <div className="form-grid">{children}</div>;
}
