import type { ReactNode } from 'react';

export function MetricCard({ label, value, note, tone = 'neutral', children }: {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'good' | 'bad' | 'accent';
  children?: ReactNode;
}) {
  return (
    <section className={`metric-card ${tone}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {note && <p className="metric-note">{note}</p>}
      {children}
    </section>
  );
}
