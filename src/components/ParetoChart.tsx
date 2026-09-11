import { useMemo, useState } from 'react';
import frontierData from '../data/pareto_frontier_2025.json';
import { dollars, percent } from './format';

type MetricId = 'winnerShare' | 'meanAbsMtr' | 'mtrPreserved' | 'rate' | 'healthCost' | 'deficitReduction' | 'medianChange';

interface ChartPoint {
  id: string;
  label: string;
  winnerShare: number;
  meanAbsMtr: number;
  mtrPreserved: number;
  rate: number;
  healthCost: number;
  deficitReduction: number;
  medianChange: number;
  middleRate: number;
  adultHealthCredit: number;
  childHealthCredit: number;
  selected?: 'mtrPreservation' | 'balanced';
  live?: boolean;
}

export type ParetoLivePoint = Omit<ChartPoint, 'id' | 'label' | 'selected' | 'live'>;

const metrics: Record<MetricId, { label: string; short: string; format: (value: number) => string }> = {
  winnerShare: { label: 'ESI-covered people better off', short: 'ESI winners', format: (value) => percent(value, 1) },
  meanAbsMtr: { label: 'Mean absolute MTR movement', short: 'Mean |MTR movement|', format: (value) => `${(value * 100).toFixed(1)} pp` },
  mtrPreserved: { label: 'MTR within ±2 percentage points', short: 'MTR preserved', format: (value) => percent(value, 1) },
  rate: { label: 'Headline business / top wage rate', short: 'Top rate', format: (value) => percent(value, 1) },
  healthCost: { label: 'Total refundable health-credit cost', short: 'Health-credit cost', format: (value) => `$${value.toFixed(0)}B` },
  deficitReduction: { label: 'Static deficit reduction versus current law', short: 'Deficit reduction', format: (value) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(0)}B` },
  medianChange: { label: 'Median ESI household resource change', short: 'Median ESI change', format: dollars },
};

const raw = frontierData.points;
const staticPoints: ChartPoint[] = raw.map((point) => ({
  id: String(point.candidate_id),
  label: point.candidate_id === frontierData.selectedIds.mtrPreservation
    ? `MTR-preserving candidate ${point.candidate_id}`
    : point.candidate_id === frontierData.selectedIds.balanced
      ? `Balanced candidate ${point.candidate_id}`
      : `Candidate ${point.candidate_id}`,
  winnerShare: point.esi_winner_share,
  meanAbsMtr: point.mean_absolute_mtr_change,
  mtrPreserved: point.mtr_within_two_points_share,
  rate: point.rate,
  healthCost: point.total_health_credit_cost_billions,
  deficitReduction: point.deficit_reduction_billions,
  medianChange: point.esi_median_change_dollars,
  middleRate: point.middle_wage_rate,
  adultHealthCredit: point.adult_health_credit,
  childHealthCredit: point.child_health_credit,
  selected: point.candidate_id === frontierData.selectedIds.mtrPreservation
    ? 'mtrPreservation'
    : point.candidate_id === frontierData.selectedIds.balanced ? 'balanced' : undefined,
}));

function extent(values: number[]): [number, number] {
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (low === high) return [low - 1, high + 1];
  const pad = (high - low) * 0.08;
  return [low - pad, high + pad];
}

function rateColor(rate: number, minRate: number, maxRate: number): string {
  const share = maxRate === minRate ? 0.5 : (rate - minRate) / (maxRate - minRate);
  const hue = 176 - share * 150;
  return `hsl(${hue} 58% 43%)`;
}

export function ParetoChart({ live }: { live: ParetoLivePoint }) {
  const [xMetric, setXMetric] = useState<MetricId>('meanAbsMtr');
  const [yMetric, setYMetric] = useState<MetricId>('winnerShare');
  const points = useMemo<ChartPoint[]>(() => [
    ...staticPoints,
    { ...live, id: 'live', label: 'Live app policy', live: true },
  ], [live]);
  const x = metrics[xMetric];
  const y = metrics[yMetric];
  const [xMin, xMax] = extent(points.map((point) => point[xMetric]));
  const [yMin, yMax] = extent(points.map((point) => point[yMetric]));
  const minRate = Math.min(...staticPoints.map((point) => point.rate));
  const maxRate = Math.max(...staticPoints.map((point) => point.rate));
  const width = 820;
  const height = 470;
  const margin = { left: 84, right: 28, top: 24, bottom: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xPosition = (value: number) => margin.left + (value - xMin) / (xMax - xMin) * plotWidth;
  const yPosition = (value: number) => margin.top + (yMax - value) / (yMax - yMin) * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) => index / 4);

  return <section className="table-card compact pareto-card">
    <div className="section-heading pareto-heading"><div><span className="eyebrow">Live policy map</span><h2>Reference Pareto frontier</h2><p>{staticPoints.length} nondominated designs from {frontierData.candidateDraws.toLocaleString()} discrete draws. Move any reform or health-credit control to reposition the live diamond.</p></div><strong>{frontierData.referenceLabel}</strong></div>
    <div className="pareto-toolbar">
      <label><span>Horizontal axis</span><select value={xMetric} onChange={(event) => setXMetric(event.target.value as MetricId)}>{(Object.keys(metrics) as MetricId[]).filter((id) => id !== yMetric).map((id) => <option key={id} value={id}>{metrics[id].label}</option>)}</select></label>
      <label><span>Vertical axis</span><select value={yMetric} onChange={(event) => setYMetric(event.target.value as MetricId)}>{(Object.keys(metrics) as MetricId[]).filter((id) => id !== xMetric).map((id) => <option key={id} value={id}>{metrics[id].label}</option>)}</select></label>
      <div className="pareto-legend"><span className="pareto-live-key">Live policy</span><span className="pareto-balanced-key">Balanced candidate</span><span className="pareto-plan-key">MTR-preserving candidate</span><small>Color = top rate · size = health-credit cost</small></div>
    </div>
    <svg className="pareto-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${y.label} by ${x.label} for the Pareto frontier and live app policy`}>
      {ticks.map((share) => {
        const value = xMin + share * (xMax - xMin);
        const px = xPosition(value);
        return <g key={`x-${share}`}><line className="pareto-grid" x1={px} x2={px} y1={margin.top} y2={margin.top + plotHeight} /><text x={px} y={height - 38} textAnchor="middle">{x.format(value)}</text></g>;
      })}
      {ticks.map((share) => {
        const value = yMin + share * (yMax - yMin);
        const py = yPosition(value);
        return <g key={`y-${share}`}><line className="pareto-grid" x1={margin.left} x2={margin.left + plotWidth} y1={py} y2={py} /><text x={margin.left - 12} y={py + 3} textAnchor="end">{y.format(value)}</text></g>;
      })}
      <text className="pareto-axis-label" x={margin.left + plotWidth / 2} y={height - 7} textAnchor="middle">{x.short}</text>
      <text className="pareto-axis-label" transform={`translate(17 ${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle">{y.short}</text>
      {points.filter((point) => !point.live).map((point) => {
        const radius = 3 + Math.sqrt(Math.max(0, point.healthCost) / 500) * 4;
        return <circle key={point.id} className={`pareto-point ${point.selected ?? ''}`} cx={xPosition(point[xMetric])} cy={yPosition(point[yMetric])} r={radius} fill={rateColor(point.rate, minRate, maxRate)}><title>{point.label}\n{x.label}: {x.format(point[xMetric])}\n{y.label}: {y.format(point[yMetric])}\nTop / middle rate: {percent(point.rate, 1)} / {percent(point.middleRate, 1)}\nHealth credit: {dollars(point.adultHealthCredit)} adult / {dollars(point.childHealthCredit)} child\nTotal health credits: ${point.healthCost.toFixed(1)}B</title></circle>;
      })}
      <g className="pareto-live" transform={`translate(${xPosition(live[xMetric])} ${yPosition(live[yMetric])})`}><path d="M 0 -11 L 11 0 L 0 11 L -11 0 Z" /><title>Live app policy\n{x.label}: {x.format(live[xMetric])}\n{y.label}: {y.format(live[yMetric])}\nTop / middle rate: {percent(live.rate, 1)} / {percent(live.middleRate, 1)}\nHealth credit: {dollars(live.adultHealthCredit)} adult / {dollars(live.childHealthCredit)} child\nTotal health credits: ${live.healthCost.toFixed(1)}B</title></g>
    </svg>
    <p className="table-note">The reference frontier holds the static deficit unchanged as its fiscal floor and uses a broader search model that includes nonrefundable adult relief and zero-bracket alternatives. Its fiscal axis reports each discrete-rate candidate’s deficit reduction versus current law. The diamond is a live score for the app’s selected policy; it is a comparison marker, not a claim that the current sliders reproduce one of the searched candidates or remain nondominated.</p>
  </section>;
}
