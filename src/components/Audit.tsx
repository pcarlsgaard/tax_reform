import type { ReactNode } from 'react';

export function Audit({ title = 'Audit calculation', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="audit">
      <summary>{title}</summary>
      <div className="audit-body">{children}</div>
    </details>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <div className="formula">{children}</div>;
}
