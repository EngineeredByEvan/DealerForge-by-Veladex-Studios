import { TextareaHTMLAttributes } from 'react';

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return <textarea className={`textarea ${props.className ?? ''}`.trim()} {...props} />;
}
