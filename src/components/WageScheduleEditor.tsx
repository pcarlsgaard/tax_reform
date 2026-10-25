import { RangeField, SelectField } from './Controls';
import { percent } from './format';
import { marginalProtectionPresets, type ReformSettings, type WageBracket } from '../model';

export function WageScheduleEditor({ settings, update }: {
  settings: ReformSettings;
  update: (patch: Partial<ReformSettings>) => void;
}) {
  const brackets = settings.progressiveWageBrackets;
  const choice = brackets ? String(brackets.length) : 'legacy';
  const setBand = (index: number, patch: Partial<WageBracket>) => {
    if (!brackets) return;
    update({ progressiveWageBrackets: brackets.map((band, i) => i === index ? { ...band, ...patch } : band) });
  };
  return <div className="control-group">
    <span>Progressive wage schedule</span>
    <SelectField label="Statutory wage rates" value={choice} options={[
      { value: '3', label: '3 rates · simple' },
      { value: '4', label: '4 rates · marginal-rate protection' },
      { value: '5', label: '5 rates · separate low-income rate' },
      { value: 'legacy', label: 'Original bracket schedule' },
    ]} onChange={(value) => update({
      progressiveWageBrackets: value === 'legacy' ? null
        : marginalProtectionPresets[Number(value) as 3 | 4 | 5].map(b => ({ ...b })),
    })} hint="Brackets are per adult, doubled for joint returns. Business cash flow retains its own headline rate." />
    {brackets ? <>
      <p className="control-note"><strong>{brackets.map(b => percent(b.rate, 1)).join(' / ')}</strong> · starts at {brackets.slice(0, -1).map(b => `$${(b.upperPerAdult ?? 0).toLocaleString()}`).join(', ')} per adult. The earned adult credit reduces the first marginal rate by its phase-in rate while active.</p>
      <details className="wage-bracket-details">
        <summary>Customize rates and thresholds</summary>
        {brackets.map((band, index) => {
          const last = index === brackets.length - 1;
          const prevUpper = index === 0 ? 0 : brackets[index - 1].upperPerAdult ?? 0;
          const nextUpper = last || index === brackets.length - 2
            ? 500000 : brackets[index + 1].upperPerAdult ?? 500000;
          const minRate = index === 0 ? 0 : brackets[index - 1].rate;
          const maxRate = last ? 0.45 : brackets[index + 1].rate;
          return <div className="control-group" key={index}>
            <span>Band {index + 1}{last ? ' · highest' : ''}</span>
            <RangeField label="Wage rate" value={band.rate} min={minRate} max={maxRate} step={0.005}
              display={percent(band.rate, 1)} onChange={(rate) => setBand(index, { rate })} />
            {!last && <RangeField label="Upper threshold / adult" value={band.upperPerAdult ?? 0}
              min={prevUpper + 5000} max={Math.max(prevUpper + 5000, nextUpper - 5000)} step={5000}
              display={`$${(band.upperPerAdult ?? 0).toLocaleString()}`}
              onChange={(upperPerAdult) => setBand(index, { upperPerAdult })} />}
          </div>;
        })}
      </details>
    </> : <>
      <RangeField label="Zero-rate ceiling / adult" value={settings.progressiveZeroBracketPerAdult} min={0} max={100000} step={1000} display={`$${settings.progressiveZeroBracketPerAdult.toLocaleString()}`} onChange={(progressiveZeroBracketPerAdult) => update({ progressiveZeroBracketPerAdult })} />
      <RangeField label="Top-rate threshold / adult" value={settings.progressiveTopBracketPerAdult} min={25000} max={300000} step={5000} display={`$${settings.progressiveTopBracketPerAdult.toLocaleString()}`} onChange={(progressiveTopBracketPerAdult) => update({ progressiveTopBracketPerAdult })} />
      <RangeField label="Middle wage rate" value={Math.min(settings.rate, settings.progressiveMiddleRate)} min={0} max={settings.rate} step={0.005} display={percent(Math.min(settings.rate, settings.progressiveMiddleRate))} onChange={(progressiveMiddleRate) => update({ progressiveMiddleRate })} />
      <label className="control-note"><input type="checkbox" checked={settings.progressiveIntermediateStartPerAdult !== null} onChange={(event) => update(event.target.checked
        ? { progressiveIntermediateStartPerAdult: 75000, progressiveTopBracketPerAdult: 200000, progressiveIntermediateRate: 0.30 }
        : { progressiveIntermediateStartPerAdult: null })} /> Add intermediate wage bracket</label>
      {settings.progressiveIntermediateStartPerAdult !== null && <>
        <RangeField label="Intermediate starts / adult" value={settings.progressiveIntermediateStartPerAdult} min={0} max={300000} step={5000} display={`$${settings.progressiveIntermediateStartPerAdult.toLocaleString()}`} onChange={(progressiveIntermediateStartPerAdult) => update({ progressiveIntermediateStartPerAdult })} />
        <RangeField label="Intermediate wage rate" value={settings.progressiveIntermediateRate} min={settings.progressiveMiddleRate} max={settings.rate} step={0.005} display={percent(settings.progressiveIntermediateRate)} onChange={(progressiveIntermediateRate) => update({ progressiveIntermediateRate })} />
      </>}
    </>}
  </div>;
}
