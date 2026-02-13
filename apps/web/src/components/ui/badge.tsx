import { HTMLAttributes } from 'react';

export function Badge({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return <span className={`badge ${className}`.trim()} {...props} />;
}
