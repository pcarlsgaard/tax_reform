import { dollars, percent } from './format';

interface Point { x: number; a: number; b: number }

export function LineChart({ points, title, aLabel, bLabel, percentAxis = false }: {
  points: Point[];
  title: string;
  aLabel: string;
  bLabel: string;
  percentAxis?: boolean;
}) {
  const width = 760;
  const height = 260;
  const pad = { left: 78, right: 20, top: 20, bottom: 42 };
  const xs = points.map((point) => point.x);
  const ys = points.flatMap((point) => [point.a, point.b]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const rawMin = Math.min(...ys, 0);
  const rawMax = Math.max(...ys, 0);
  const yPad = Math.max((rawMax - rawMin) * 0.08, 0.01);
  const yMin = rawMin - yPad;
  const yMax = rawMax + yPad;
  const sx = (x: number) => pad.left + ((x - xMin) / Math.max(1, xMax - xMin)) * (width - pad.left - pad.right);
  const sy = (y: number) => pad.top + ((yMax - y) / Math.max(1e-9, yMax - yMin)) * (height - pad.top - pad.bottom);
  const path = (key: 'a' | 'b') => points.map((point, index) => `${index ? 'L' : 'M'}${sx(point.x).toFixed(1)},${sy(point[key]).toFixed(1)}`).join(' ');
  const formatY = (value: number) => percentAxis ? percent(value, 0) : dollars(value);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="line-chart">
      <figcaption>{title}</figcaption>
      <div className="chart-legend"><span className="legend-a">{aLabel}</span><span className="legend-b">{bLabel}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {ticks.map((tick) => {
          const yValue = yMin + (yMax - yMin) * tick;
          const y = sy(yValue);
          return <g key={`y-${tick}`}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="grid-line" /><text x={pad.left - 10} y={y + 4} textAnchor="end">{formatY(yValue)}</text></g>;
        })}
        {ticks.map((tick) => {
          const xValue = xMin + (xMax - xMin) * tick;
          const x = sx(xValue);
          return <text key={`x-${tick}`} x={x} y={height - 14} textAnchor="middle">{dollars(xValue)}</text>;
        })}
        <line x1={pad.left} x2={width - pad.right} y1={sy(0)} y2={sy(0)} className="zero-line" />
        <path d={path('a')} className="series-a" />
        <path d={path('b')} className="series-b" />
      </svg>
    </figure>
  );
}
