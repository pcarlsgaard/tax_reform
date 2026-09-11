import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { dollars, percent } from './format';

interface Point { x: number; a: number; b: number; c?: number }

export function LineChart({ points, title, aLabel, bLabel, cLabel, percentAxis = false, xScale = 'linear', yDomain }: {
  points: Point[];
  title: string;
  aLabel: string;
  bLabel: string;
  cLabel?: string;
  percentAxis?: boolean;
  xScale?: 'linear' | 'focus';
  yDomain?: [number, number];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 1100;
  const height = 390;
  const pad = { left: 92, right: 32, top: 28, bottom: 56 };
  const xs = points.map((point) => point.x);
  const ys = points.flatMap((point) => point.c == null ? [point.a, point.b] : [point.a, point.b, point.c]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const rawMin = Math.min(...ys, 0);
  const rawMax = Math.max(...ys, 0);
  const yPad = Math.max((rawMax - rawMin) * 0.08, 0.01);
  const yMin = yDomain?.[0] ?? rawMin - yPad;
  const yMax = yDomain?.[1] ?? rawMax + yPad;
  const normalizedX = (x: number) => Math.max(0, Math.min(1, (x - xMin) / Math.max(1, xMax - xMin)));
  const xTransform = (share: number) => xScale === 'focus' ? Math.sqrt(share) : share;
  const xInverse = (share: number) => xScale === 'focus' ? share ** 2 : share;
  const sx = (x: number) => pad.left + xTransform(normalizedX(x)) * (width - pad.left - pad.right);
  const sy = (y: number) => {
    const visibleY = Math.max(yMin, Math.min(yMax, y));
    return pad.top + ((yMax - visibleY) / Math.max(1e-9, yMax - yMin)) * (height - pad.top - pad.bottom);
  };
  const path = (key: 'a' | 'b' | 'c') => points.map((point, index) => `${index ? 'L' : 'M'}${sx(point.x).toFixed(1)},${sy(point[key] ?? 0).toFixed(1)}`).join(' ');
  const formatY = (value: number) => percentAxis ? percent(value, 1) : dollars(value);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const active = hovered == null ? null : points[hovered];

  const trace = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = (event.clientX - rect.left) / rect.width * width;
    const share = (viewX - pad.left) / (width - pad.left - pad.right);
    const index = Math.round(Math.max(0, Math.min(1, share)) * (points.length - 1));
    setHovered(index);
  };

  const hasThirdSeries = Boolean(cLabel) && points.some((point) => point.c != null);
  const tooltipWidth = 270;
  const tooltipX = active ? Math.min(width - pad.right - tooltipWidth, Math.max(pad.left, sx(active.x) + 14)) : 0;

  return (
    <figure className="line-chart">
      <figcaption>{title}</figcaption>
      <div className="chart-legend"><span className="legend-a">{aLabel}</span><span className="legend-b">{bLabel}</span>{hasThirdSeries && <span className="legend-c">{cLabel}</span>}<small>Move across the chart to trace values</small></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} onPointerMove={trace} onPointerLeave={() => setHovered(null)}>
        {ticks.map((tick) => {
          const yValue = yMin + (yMax - yMin) * tick;
          const y = sy(yValue);
          return <g key={`y-${tick}`}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="grid-line" /><text x={pad.left - 12} y={y + 4} textAnchor="end">{formatY(yValue)}</text></g>;
        })}
        {ticks.map((tick) => {
          const xValue = xMin + (xMax - xMin) * xInverse(tick);
          const x = sx(xValue);
          return <text key={`x-${tick}`} x={x} y={height - 18} textAnchor="middle">{dollars(xValue)}</text>;
        })}
        <line x1={pad.left} x2={width - pad.right} y1={sy(0)} y2={sy(0)} className="zero-line" />
        <path d={path('a')} className="series-a" />
        <path d={path('b')} className="series-b" />
        {hasThirdSeries && <path d={path('c')} className="series-c" />}
        {active && <g className="chart-trace">
          <line x1={sx(active.x)} x2={sx(active.x)} y1={pad.top} y2={height - pad.bottom} />
          <circle cx={sx(active.x)} cy={sy(active.a)} r="5" className="point-a" />
          <circle cx={sx(active.x)} cy={sy(active.b)} r="5" className="point-b" />
          {hasThirdSeries && active.c != null && <circle cx={sx(active.x)} cy={sy(active.c)} r="5" className="point-c" />}
          <g transform={`translate(${tooltipX},${pad.top + 8})`}>
            <rect width={tooltipWidth} height={hasThirdSeries ? 104 : 82} rx="9" />
            <text x="12" y="20" className="trace-wage">Cash wage {dollars(active.x)}</text>
            <text x="12" y="44" className="trace-a">{aLabel}: {formatY(active.a)}</text>
            <text x="12" y="66" className="trace-b">{bLabel}: {formatY(active.b)}</text>
            {hasThirdSeries && active.c != null && <text x="12" y="88" className="trace-c">{cLabel}: {formatY(active.c)}</text>}
          </g>
        </g>}
      </svg>
    </figure>
  );
}
