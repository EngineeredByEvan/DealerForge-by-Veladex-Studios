import { HTMLAttributes, TableHTMLAttributes } from 'react';

export function TableContainer(props: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={`table-wrap ${props.className ?? ''}`.trim()} {...props} />;
}

export function Table(props: TableHTMLAttributes<HTMLTableElement>): JSX.Element {
  return <table className={`table ${props.className ?? ''}`.trim()} {...props} />;
}
