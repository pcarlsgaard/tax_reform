import { useMemo, useState } from 'react';
import { Audit, Formula } from '../components/Audit';
import { LineChart } from '../components/LineChart';
import { MetricCard } from '../components/MetricCard';
import { dollars, percent } from '../components/format';
import {
  calculateHousehold,
  calculateTaxWedgeTable,
  OECD_US_AVERAGE_WAGE_2025,
  type FilingStatus,
  type HouseholdInput,
  type ReformSettings,
} from '../model';

export function Household({ settings }: { settings: ReformSettings }) {
  const [input, setInput] = useState<HouseholdInput>({ filingStatus: 'married', children: 2, cashWage: 100000, secondaryCashWage: 0 });
  const [chartMax, setChartMax] = useState(150000);
  const [chartScale, setChartScale] = useState<'linear' | 'focus'>('focus');
  const [averageWage, setAverageWage] = useState(OECD_US_AVERAGE_WAGE_2025);
  const result = calculateHousehold(input, settings);
  const update = (patch: Partial<HouseholdInput>) => setInput({ ...input, ...patch });
  const chartPoints = useMemo(() => Array.from({ length: 181 }, (_, index) => {
    const share = index / 180;
    const cashWage = (chartScale === 'focus' ? share ** 2 : share) * chartMax;
    const row = calculateHousehold({ ...input, cashWage }, settings);
    return {
      x: cashWage,
      disposable: { a: row.currentDisposableResources, b: row.reformDisposableResources },
      change: { a: 0, b: row.dollarChange },
      average: { a: row.currentAverageRate, b: row.reformAverageRate },
      marginal: { a: row.currentMarginalRate, b: row.reformMarginalRate },
    };
  }), [input.filingStatus, input.children, input.secondaryCashWage, chartMax, chartScale, settings]);
  const wedgeRows = useMemo(() => calculateTaxWedgeTable(settings, averageWage), [settings, averageWage]);

  return <main className="page-shell household-page">
    <div className="view-intro"><div><span className="eyebrow">Household calculator · 2025 law</span><h1>Same employer cost, two tax systems</h1></div><p>Enter each earner’s cash wage. Current law adds employer payroll contributions to form employer compensation; if payroll taxes are replaced, that employer cost becomes wage compensation under reform.</p></div>
    <section className={`household-inputs ${input.filingStatus === 'married' ? 'four-up' : ''}`}>
      <label><span>Filing status</span><select value={input.filingStatus} onChange={(event) => update({ filingStatus: event.target.value as FilingStatus })}><option value="single">Single</option><option value="married">Married filing jointly</option></select></label>
      <label><span>Children</span><select value={input.children} onChange={(event) => update({ children: Number(event.target.value) })}>{[0,1,2,3,4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <WageInput label="Primary cash wage" value={input.cashWage} onChange={(cashWage) => update({ cashWage })} />
      {input.filingStatus === 'married' && <WageInput label="Spouse cash wage" value={input.secondaryCashWage ?? 0} onChange={(secondaryCashWage) => update({ secondaryCashWage })} />}
    </section>
    <div className="metric-grid household-metrics">
      <MetricCard label="Employer compensation" value={dollars(result.employerCompensation)} note="Cash wages + employer payroll tax"><Audit><Formula>{dollars(result.totalCashWage)} cash wages + {dollars(result.current.employerPayrollTax)} employer payroll = {dollars(result.employerCompensation)}</Formula></Audit></MetricCard>
      <MetricCard label="Current-law federal tax" value={dollars(result.current.totalFederalTax)} note={`Average rate ${percent(result.currentAverageRate)}`}><CurrentAudit result={result} /></MetricCard>
      <MetricCard label="Reform tax after credits" value={dollars(result.reformTaxAfterCredits)} note={`Average rate ${percent(result.reformAverageRate)}`}><ReformAudit result={result} settings={settings} /></MetricCard>
      <MetricCard label="Change in disposable resources" value={dollars(result.dollarChange)} note={result.percentChange == null ? 'Undefined at zero current resources' : percent(result.percentChange)} tone={result.dollarChange >= 0 ? 'good' : 'bad'} />
    </div>
    <section className="comparison-card"><div className="comparison-column current"><span>Current law</span><strong>{dollars(result.currentDisposableResources)}</strong><small>Disposable cash/resources</small></div><div className="comparison-arrow">→</div><div className="comparison-column reform"><span>Reform</span><strong>{dollars(result.reformDisposableResources)}</strong><small>Disposable cash/resources</small></div></section>
    <section className="table-card compact"><h2>Calculation detail</h2><div className="responsive-table"><table><thead><tr><th>Measure</th><th>Current law</th><th>Reform</th></tr></thead><tbody><tr><td>Relevant gross resource</td><td>{dollars(result.employerCompensation)}</td><td>{dollars(result.reformWageBase)} wage-tax base</td></tr><tr><td>Tax before household credits</td><td>{dollars(result.current.incomeTaxBeforeCredits + result.current.employeePayrollTax + result.current.employerPayrollTax)}</td><td>{dollars(result.reformTaxBeforeCredits)}</td></tr><tr><td>Adult credit</td><td>—</td><td>−{dollars(result.adultCredit)} of {dollars(result.adultCreditMaximum)} maximum</td></tr><tr><td>Child credit</td><td>CTC/ACTC below</td><td>−{dollars(result.childCredit)} flat, refundable</td></tr><tr><td>EITC</td><td>−{dollars(result.current.eitc)}</td><td>{settings.replacedTaxes.individualIncome ? 'replaced' : 'retained'}</td></tr><tr><td>CTC + ACTC</td><td>−{dollars(result.current.nonrefundableCtc + result.current.refundableCtc)}</td><td>{settings.replacedTaxes.individualIncome ? 'replaced' : 'retained'}</td></tr><tr><td>Average effective rate</td><td>{percent(result.currentAverageRate)}</td><td>{percent(result.reformAverageRate)}</td></tr><tr><td>Local marginal rate</td><td>{percent(result.currentMarginalRate)}</td><td>{percent(result.reformMarginalRate)}</td></tr></tbody></table><p className="table-note">Local marginal rates use a centered $1,000 earnings window so statutory $50-per-$1,000 CTC steps appear as their economic phaseout wedge rather than one-dollar spikes.</p></div></section>

    <section className="chart-toolbar"><div><h2>Trace household results across earnings</h2><p>The default $150,000 range and focused income axis make low- and middle-income changes visible. Charts hold the selected spouse wage and household type fixed.</p></div><div className="chart-scale-controls"><label><span>Primary wage range</span><select value={chartMax} onChange={(event) => setChartMax(Number(event.target.value))}><option value={100000}>$100,000</option><option value={150000}>$150,000</option><option value={250000}>$250,000</option><option value={500000}>$500,000</option><option value={1000000}>$1,000,000</option></select></label><label><span>Horizontal scale</span><select value={chartScale} onChange={(event) => setChartScale(event.target.value as 'linear' | 'focus')}><option value="focus">Lower-income focus</option><option value="linear">Linear</option></select></label></div></section>
    <section className="chart-stack"><LineChart title="Gain or loss in disposable resources" points={chartPoints.map((point) => ({ x: point.x, ...point.change }))} aLabel="No change" bLabel="Reform minus current law" xScale={chartScale} /><LineChart title="Disposable resources across primary cash wages" points={chartPoints.map((point) => ({ x: point.x, ...point.disposable }))} aLabel="Current law" bLabel="Reform" xScale={chartScale} /><LineChart title="Average effective federal tax rate" points={chartPoints.map((point) => ({ x: point.x, ...point.average }))} aLabel="Current law" bLabel="Reform" percentAxis xScale={chartScale} /><LineChart title="Local marginal federal tax rate · $1,000 window" points={chartPoints.map((point) => ({ x: point.x, ...point.marginal }))} aLabel="Current law" bLabel="Reform" percentAxis xScale={chartScale} /></section>

    <section className="table-card wedge-table">
      <div className="section-heading"><div><span className="eyebrow">Eight standard family types</span><h2>OECD-style federal tax wedges</h2><p>Federal income and payroll taxes minus refundable credits, divided by employer compensation.</p></div><label className="reference-wage"><span>2025 average wage</span><div><b>$</b><input type="number" min="10000" step="1000" value={averageWage} onChange={(event) => setAverageWage(Math.max(0, Number(event.target.value)))} /></div></label></div>
      <div className="responsive-table"><table><thead><tr><th>Family / earnings pattern</th><th>Primary wage</th><th>Spouse wage</th><th>Employer compensation</th><th>Current after-tax income</th><th>Reform after-tax income</th><th>Income change</th><th>Current wedge</th><th>Reform wedge</th><th>Wedge change</th></tr></thead><tbody>{wedgeRows.map((row) => <tr key={row.id}><td>{row.label}</td><td>{dollars(row.primaryWage)}</td><td>{row.secondaryWage ? dollars(row.secondaryWage) : '—'}</td><td>{dollars(row.employerCompensation)}</td><td>{dollars(row.currentAfterTaxIncome)}</td><td>{dollars(row.reformAfterTaxIncome)}</td><td className={row.afterTaxIncomeChange >= 0 ? 'good-text' : 'bad-text'}>{dollars(row.afterTaxIncomeChange)}</td><td>{percent(row.currentWedge)}</td><td>{percent(row.reformWedge)}</td><td className={row.changePercentagePoints <= 0 ? 'good-text' : 'bad-text'}>{row.changePercentagePoints.toFixed(1)} pp</td></tr>)}</tbody></table><p className="table-note">After-tax income here means employer compensation minus modeled federal tax, including refundable credits. It is the same disposable-resource measure used in the household comparison.</p></div>
      <Audit title="What this table does and does not reproduce"><Formula>The eight earnings patterns and $73,520 reference wage follow OECD Taxing Wages 2026 for the United States. This simulator reports its own federal-only wedge from the simplified wage engine; it does not copy OECD results and excludes state/local taxes, unemployment insurance, nonwage income, and special deductions.</Formula></Audit>
    </section>
    <p className="method-note">Static wage-only illustration. It assumes all adults are working-age, all children qualify for the CTC, no itemized deductions or nonwage income, and dollar-for-dollar conversion of repealed employer payroll taxes into compensation. It is not a microsimulation.</p>
  </main>;
}

function WageInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="wage-input"><span>{label}</span><div><b>$</b><input type="number" min="0" step="1000" value={value} onChange={(event) => onChange(Number(event.target.value))} /></div></label>;
}

function CurrentAudit({ result }: { result: ReturnType<typeof calculateHousehold> }) {
  const c = result.current;
  return <Audit><Formula>{dollars(c.incomeTaxBeforeCredits)} income tax before credits<br />− {dollars(c.nonrefundableCtc)} nonrefundable CTC<br />− {dollars(c.refundableCtc)} ACTC<br />− {dollars(c.eitc)} EITC<br />+ {dollars(c.employeePayrollTax)} employee payroll<br />+ {dollars(c.employerPayrollTax)} employer payroll<br />= {dollars(c.totalFederalTax)}</Formula></Audit>;
}

function ReformAudit({ result, settings }: { result: ReturnType<typeof calculateHousehold>; settings: ReformSettings }) {
  return <Audit><Formula>{dollars(result.reformTaxBeforeCredits)} {settings.wageTaxMode} wage tax<br />− {dollars(result.adultCredit)} adult credit ({settings.adultCreditMode})<br />− {dollars(result.childCredit)} child credit<br />+ {dollars(result.retainedCurrentTaxes)} retained current taxes<br />= {dollars(result.reformTaxAfterCredits)}</Formula></Audit>;
}
