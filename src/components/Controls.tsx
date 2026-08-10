import type { ReactNode } from 'react';

export function RangeField({ label, value, min, max, step, display, onChange, hint }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
  hint?: ReactNode;
}) {
  return (
    <label className="control-field">
      <span className="control-heading"><span>{label}</span><strong>{display}</strong></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
      {hint && <span className="control-hint">{hint}</span>}
    </label>
  );
}

export function NumberField({ label, value, min = 0, step = 1000, suffix, onChange }: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div><input type="number" value={value} min={min} step={step} onChange={(event) => onChange(Number(event.target.value))} />{suffix && <em>{suffix}</em>}</div>
    </label>
  );
}
