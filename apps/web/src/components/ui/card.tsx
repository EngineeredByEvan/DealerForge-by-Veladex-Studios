import { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={`card ${className}`.trim()} {...props} />;
}
