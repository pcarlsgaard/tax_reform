import { useMemo, useState } from 'react';
import { Audit, Formula } from '../components/Audit';
import { LineChart } from '../components/LineChart';
import { MetricCard } from '../components/MetricCard';
import { dollars, percent } from '../components/format';
import { calculateHousehold, type FilingStatus, type HouseholdInput, type ReformSettings } from '../model';

export function Household({ settings }: { settings: ReformSettings }) {
  const [input, setInput] = useState<HouseholdInput>({ filingStatus: 'married', children: 2, cashWage: 100000 });
  const result = calculateHousehold(input, settings);
  const update = (patch: Partial<HouseholdInput>) => setInput({ ...input, ...patch });
  const chartPoints = useMemo(() => Array.from({ length: 61 }, (_, index) => {
    const cashWage = index * 500000 / 60;
    const row = calculateHousehold({ ...input, cashWage }, settings);
    return {
      x: cashWage,
      disposable: { a: row.currentDisposableResources, b: row.reformDisposableResources },
      average: { a: row.currentAverageRate, b: row.reformAverageRate },
      marginal: { a: row.currentMarginalRate, b: row.reformMarginalRate },
    };
  }), [input.filingStatus, input.children, settings]);

  return <main className="page-shell">
    <div className="view-intro"><div><span className="eyebrow">Household calculator</span><h1>Same employer cost, two tax systems</h1></div><p>Enter cash wages. Current law adds the employer payroll contribution to form employer compensation; if payroll taxes are replaced, that cost is assumed to become wage compensation under reform.</p></div>
    <section className="household-inputs">
      <label><span>Filing status</span><select value={input.filingStatus} onChange={(event) => update({ filingStatus: event.target.value as FilingStatus })}><option value="single">Single</option><option value="married">Married filing jointly</option></select></label>
      <label><span>Children</span><select value={input.children} onChange={(event) => update({ children: Number(event.target.value) })}>{[0,1,2,3,4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="wage-input"><span>Annual cash wage</span><div><b>$</b><input type="number" min="0" step="1000" value={input.cashWage} onChange={(event) => update({ cashWage: Number(event.target.value) })} /></div></label>
    </section>
    <div className="metric-grid household-metrics">
      <MetricCard label="Employer compensation" value={dollars(result.employerCompensation)} note="Cash wage + employer payroll tax"><Audit><Formula>{dollars(input.cashWage)} cash wage + {dollars(result.current.employerPayrollTax)} employer payroll = {dollars(result.employerCompensation)}</Formula></Audit></MetricCard>
      <MetricCard label="Current-law federal tax" value={dollars(result.current.totalFederalTax)} note={`Average rate ${percent(result.currentAverageRate)}`}><CurrentAudit result={result} /></MetricCard>
      <MetricCard label="Reform tax after credits" value={dollars(result.reformTaxAfterCredits)} note={`Average rate ${percent(result.reformAverageRate)}`}><ReformAudit result={result} /></MetricCard>
      <MetricCard label="Change in disposable resources" value={dollars(result.dollarChange)} note={result.percentChange == null ? 'Undefined at zero current resources' : percent(result.percentChange)} tone={result.dollarChange >= 0 ? 'good' : 'bad'} />
    </div>
    <section className="comparison-card"><div className="comparison-column current"><span>Current law</span><strong>{dollars(result.currentDisposableResources)}</strong><small>Disposable cash/resources</small></div><div className="comparison-arrow">→</div><div className="comparison-column reform"><span>Reform</span><strong>{dollars(result.reformDisposableResources)}</strong><small>Disposable cash/resources</small></div></section>
    <section className="table-card compact"><h2>Calculation detail</h2><div className="responsive-table"><table><thead><tr><th>Measure</th><th>Current law</th><th>Reform</th></tr></thead><tbody><tr><td>Relevant gross resource</td><td>{dollars(result.employerCompensation)}</td><td>{dollars(result.reformWageBase)} wage-tax base</td></tr><tr><td>Tax before household credits</td><td>{dollars(result.current.incomeTaxBeforeCredits + result.current.employeePayrollTax + result.current.employerPayrollTax)}</td><td>{dollars(result.reformTaxBeforeCredits)}</td></tr><tr><td>Adult credit</td><td>—</td><td>−{dollars(result.adultCredit)}</td></tr><tr><td>Child credit</td><td>CTC/ACTC below</td><td>−{dollars(result.childCredit)}</td></tr><tr><td>EITC</td><td>−{dollars(result.current.eitc)}</td><td>{settings.replacedTaxes.individualIncome ? 'replaced' : 'retained'}</td></tr><tr><td>CTC + ACTC</td><td>−{dollars(result.current.nonrefundableCtc + result.current.refundableCtc)}</td><td>{settings.replacedTaxes.individualIncome ? 'replaced' : 'retained'}</td></tr><tr><td>Average effective rate</td><td>{percent(result.currentAverageRate)}</td><td>{percent(result.reformAverageRate)}</td></tr><tr><td>Marginal effective rate</td><td>{percent(result.currentMarginalRate)}</td><td>{percent(result.reformMarginalRate)}</td></tr></tbody></table></div></section>
    <section className="chart-stack"><LineChart title="Disposable resources across cash wages" points={chartPoints.map((point) => ({ x: point.x, ...point.disposable }))} aLabel="Current law" bLabel="Reform" /><LineChart title="Average effective federal tax rate" points={chartPoints.map((point) => ({ x: point.x, ...point.average }))} aLabel="Current law" bLabel="Reform" percentAxis /><LineChart title="Marginal effective federal tax rate" points={chartPoints.map((point) => ({ x: point.x, ...point.marginal }))} aLabel="Current law" bLabel="Reform" percentAxis /></section>
    <p className="method-note">Static wage-only illustration. It assumes all adults are working-age, all children qualify for the CTC, no itemized deductions or nonwage income, and dollar-for-dollar conversion of repealed employer payroll taxes into compensation. It is not a microsimulation.</p>
  </main>;
}

function CurrentAudit({ result }: { result: ReturnType<typeof calculateHousehold> }) {
  const c = result.current;
  return <Audit><Formula>{dollars(c.incomeTaxBeforeCredits)} income tax before credits<br />− {dollars(c.nonrefundableCtc)} nonrefundable CTC<br />− {dollars(c.refundableCtc)} ACTC<br />− {dollars(c.eitc)} EITC<br />+ {dollars(c.employeePayrollTax)} employee payroll<br />+ {dollars(c.employerPayrollTax)} employer payroll<br />= {dollars(c.totalFederalTax)}</Formula></Audit>;
}

function ReformAudit({ result }: { result: ReturnType<typeof calculateHousehold> }) {
  return <Audit><Formula>{dollars(result.reformTaxBeforeCredits)} wage tax<br />− {dollars(result.adultCredit)} adult credit<br />− {dollars(result.childCredit)} child credit<br />+ {dollars(result.retainedCurrentTaxes)} retained current taxes<br />= {dollars(result.reformTaxAfterCredits)}</Formula></Audit>;
}
