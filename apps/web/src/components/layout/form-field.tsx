import { ReactNode } from 'react';

export function FormField({
  label,
  htmlFor,
  description,
  hint,
  error,
  children
}: {
  label: string;
  htmlFor: string;
  description?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className="form-field" htmlFor={htmlFor}>
      <div className="form-field-head">
        <span className="form-field-label">{label}</span>
        {hint ? <span className="form-field-hint">{hint}</span> : null}
      </div>
      {description ? <span className="form-field-description">{description}</span> : null}
      {children}
      {error ? <span className="form-field-error">{error}</span> : null}
    </label>
  );
}
