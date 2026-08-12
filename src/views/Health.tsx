import { useMemo, useState } from 'react';
import { Audit, Formula } from '../components/Audit';
import { MetricCard } from '../components/MetricCard';
import { dollars, percent } from '../components/format';
import {
  calculateHealthAnalysis,
  defaultHealthPolicySettings,
  healthSnapshot,
  type HealthDistributionSummary,
  type HealthPolicySettings,
  type HealthRecipientScope,
  type HealthRedistributionRule,
  type ReformSettings,
} from '../model';

const billions = (value: number, digits = 1) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(digits)}B`;
const millionsPeople = (value: number) => `${value.toFixed(1)}M`;

export function Health({ settings }: { settings: ReformSettings }) {
  const [policy, setPolicy] = useState<HealthPolicySettings>(defaultHealthPolicySettings);
  const result = useMemo(() => calculateHealthAnalysis(settings, policy), [settings, policy]);
  const update = (patch: Partial<HealthPolicySettings>) => setPolicy({ ...policy, ...patch });

  return <main className="page-shell health-page">
    <div className="view-intro"><div><span className="eyebrow">ESI transition · linked CPS microdata</span><h1>Cash out employer health benefits and test who wins</h1></div><p>This experiment ends the employer-health tax exclusion, redistributes employer contributions as wages, replaces ESI with each person’s ACA benchmark premium, and applies a fixed refundable credit. It uses the reform selected in the Designer.</p></div>

    <div className="health-layout">
      <aside className="control-panel health-controls">
        <span className="eyebrow">Policy controls</span><h2>ESI cash-out design</h2>
        <RangeControl label="Health credit per covered person" value={policy.healthCreditPerPerson} min={0} max={2000} step={100} display={dollars(policy.healthCreditPerPerson)} onChange={(healthCreditPerPerson) => update({ healthCreditPerPerson })} hint="Refundable and capped at the household benchmark premium." />
        <label className="select-field"><span>Employer contribution redistribution</span><select value={policy.redistributionRule} onChange={(event) => update({ redistributionRule: event.target.value as HealthRedistributionRule })}><option value="nationalEqual">Equal national wage</option><option value="employerCellEqual">Equal within sector / firm-size cells</option><option value="ownContribution">Convert own imputed contribution</option></select><small className="control-hint">The cell rule approximates within-employer redistribution; ASEC has no employer identifier.</small></label>
        <label className="select-field"><span>Workers receiving redistributed wages</span><select disabled={policy.redistributionRule === 'ownContribution'} value={policy.recipientScope} onChange={(event) => update({ recipientScope: event.target.value as HealthRecipientScope })}><option value="policyholders">ESI policyholder workers</option><option value="coveredWorkers">All ESI-covered workers</option></select><small className="control-hint">The policyholder wage is already shared in its tax unit's resources. The broader sensitivity gives a separate allocation to each wage-earning spouse or other worker covered as a dependent.</small></label>
        <RangeControl label="Employer health contribution passed to wages" value={policy.employerHealthPassThroughRate} min={0} max={1} step={0.05} display={percent(policy.employerHealthPassThroughRate, 0)} onChange={(employerHealthPassThroughRate) => update({ employerHealthPassThroughRate })} />
        <RangeControl label="Repealed employer FICA passed to wages" value={policy.employerFicaPassThroughRate} min={0} max={1} step={0.05} display={percent(policy.employerFicaPassThroughRate, 0)} onChange={(employerFicaPassThroughRate) => update({ employerFicaPassThroughRate })} disabled={!settings.replacedTaxes.payroll} hint={settings.replacedTaxes.payroll ? 'Matches the reform-side incidence convention used in Social spending.' : 'Disabled because payroll taxes are not selected for replacement.'} />
        <RangeControl label="Current employee premium paid pre-tax" value={policy.employeePremiumPreTaxShare} min={0} max={1} step={0.05} display={percent(policy.employeePremiumPreTaxShare, 0)} onChange={(employeePremiumPreTaxShare) => update({ employeePremiumPreTaxShare })} hint="Reform premiums are always paid after tax in this experiment." />
        <RangeControl label="Benchmark premium factor" value={policy.benchmarkPremiumScale} min={0.8} max={1.3} step={0.01} display={percent(policy.benchmarkPremiumScale, 0)} onChange={(benchmarkPremiumScale) => update({ benchmarkPremiumScale })} hint="103% converts the HIPM 2024 benchmark to CMS's average 2025 change." />
      </aside>

      <div className="health-results">
        <div className="metric-grid health-metrics">
          <MetricCard label="Covered people better off" value={percent(result.winnerCoveredPeopleShare)} note={`${millionsPeople(result.coveredPeopleMillions)} nonelderly ESI lives in scope`} tone={result.winnerCoveredPeopleShare >= 2 / 3 ? 'good' : 'bad'} />
          <MetricCard label="Median annual change" value={dollars(result.medianDollarChange)} note={`P10 ${dollars(result.p10DollarChange)} · P90 ${dollars(result.p90DollarChange)}`} tone={result.medianDollarChange >= 0 ? 'good' : 'bad'} />
          <MetricCard label="Employer health wage" value={dollars(result.averageHealthWagePerRecipient)} note={`${billions(result.allocatedHealthWagesBillions)} allocated to selected recipients`} tone="accent" />
          <MetricCard label="Fixed-credit cost" value={billions(result.healthCreditCostBillions)} note={`${dollars(policy.healthCreditPerPerson)} per covered person, premium-capped`} />
          <MetricCard label="Rate increment to finance credit" value={`${(result.healthCreditFinancingRateIncrease * 100).toFixed(2)} pp`} note="Static addition to the selected reform's rate-adjusted base" />
          <MetricCard label="Benchmark premium pool" value={billions(result.benchmarkPremiumBillions)} note="Second-lowest-cost Silver, before the fixed credit" />
          <MetricCard label="Aggregate resource change" value={billions(result.aggregateResourceChangeBillions)} note="Reform minus current disposable cash after premiums" tone={result.aggregateResourceChangeBillions >= 0 ? 'good' : 'bad'} />
        </div>

        <section className="table-card compact health-identity">
          <div className="section-heading"><div><span className="eyebrow">Household identity</span><h2>What is compared</h2><p>Coverage is held conceptually constant; current ESI and reform benchmark insurance are both treated as purchased.</p></div><strong>{percent(result.winnerTaxUnitShare)} of tax units win</strong></div>
          <div className="two-column"><Formula>Current law<br />cash wages<br />− income tax before credits<br />− employee payroll tax<br />+ EITC / CTC<br />− employee ESI premium</Formula><Formula>Reform<br />cash wages + FICA pass-through + health wage<br />− reform and retained tax before credits<br />+ adult / child / retained credits<br />+ fixed health credit<br />− ACA benchmark premium</Formula></div>
          <p className="table-note">The redistributed employer-health wage is fully taxable even if the Designer exempts the remaining combined pension-and-insurance supplement. Reclassification does not enlarge the macro compensation base: employer health is already inside the simulator’s taxable compensation total.</p>
        </section>

        <section className="table-card compact">
          <div className="section-heading"><div><span className="eyebrow">Political feasibility</span><h2>Credit required to hold people harmless</h2><p>Weighted across ESI-covered people. A household is held harmless when its after-premium disposable resources do not fall.</p></div></div>
          <div className="responsive-table"><table><thead><tr><th>Target share no worse off</th><th>Required credit per covered person</th><th>Within $0–$2,000 range?</th></tr></thead><tbody>{result.creditTargets.map((target) => <tr key={target.targetShare}><td>{percent(target.targetShare, 0)}</td><td>{target.requiredCreditPerPerson == null ? 'Not attainable with premium-capped credit' : dollars(target.requiredCreditPerPerson)}</td><td className={target.attainableWithinSlider ? 'good-text' : 'bad-text'}>{target.attainableWithinSlider ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
        </section>

        <DistributionTable title="Results by ESI cash-wage decile" rows={result.byIncomeDecile} />
        <div className="two-column health-breakdowns"><DistributionTable title="Results by current ESI tier" rows={result.byPlanTier} /><DistributionTable title="Results by policyholder age" rows={result.byAgeBand} /></div>

        <section className="table-card compact">
          <div className="section-heading"><div><span className="eyebrow">Data reconciliation</span><h2>Premium and wage pools</h2><p>Weighted browser cells; rounding explains small allocation differences.</p></div></div>
          <div className="responsive-table"><table><thead><tr><th>Item</th><th>Annual amount</th><th>Treatment</th></tr></thead><tbody>
            <tr><td>Current employee ESI premiums</td><td>{billions(result.employeePremiumBillions)}</td><td>{percent(result.employeePremiumShare)} of combined premium resources; ASEC variation raked to MEPS-IC</td></tr>
            <tr><td>Current employer ESI contribution pool</td><td>{billions(result.employerContributionPoolBillions)}</td><td>{percent(result.employerPremiumShare)} of combined premium resources; MEPS-IC imputation reconciled to BEA</td></tr>
            <tr className="subtotal"><td>Current combined premium resources</td><td>{billions(result.employeePremiumBillions + result.employerContributionPoolBillions)}</td><td>Employee + employer</td></tr>
            <tr><td>Replacement benchmark premiums</td><td>{billions(result.benchmarkPremiumBillions)}</td><td>HIPM SLCSP × selected factor</td></tr>
            <tr><td>Employer contributions allocated as wages</td><td>{billions(result.allocatedHealthWagesBillions)}</td><td>{percent(policy.employerHealthPassThroughRate, 0)} pass-through</td></tr>
            <tr><td>Allocation gap</td><td>{billions(result.employerWageAllocationGapBillions, 2)}</td><td>Analytical-cell rounding</td></tr>
            <tr><td>Modeled wage tax attributable to health transfer</td><td>{billions(result.healthTransferWageTaxBillions)}</td><td>Memorandum; already represented in macro taxable compensation</td></tr>
            <tr><td>Fixed refundable health credits</td><td>{billions(result.healthCreditCostBillions)}</td><td>New federal outlay / negative tax</td></tr>
            <tr><td>Static rate increment to finance credits</td><td>{(result.healthCreditFinancingRateIncrease * 100).toFixed(2)} percentage points</td><td>Credit cost ÷ selected reform's rate-adjusted national base</td></tr>
          </tbody></table></div>
          <Audit title="Source and imputation audit"><Formula>
            {healthSnapshot.sample.samplePersons.toLocaleString()} ASEC people · {healthSnapshot.sample.healthTaxUnits.toLocaleString()} affected sample tax units · {healthSnapshot.browserReconciliation.analyticalCells.toLocaleString()} anonymous browser cells<br /><br />
            HIPM linkage: {percent(healthSnapshot.sample.hipmMatchRate)} · wage scale to 2025 BEA: {healthSnapshot.calibration.cashWageScaleToBea2025.toFixed(4)} · employer contribution scale to BEA: {healthSnapshot.calibration.employerContributionScaleToBea.toFixed(4)} · employee premium scale to MEPS: {healthSnapshot.calibration.employeePremiumScaleToMeps2025.toFixed(4)}<br /><br />
            Projected 2025 BEA group health: {billions(healthSnapshot.calibration.projectedBeaGroupHealth2025Billions)}; nonelderly transition share: {billions(healthSnapshot.calibration.nonelderlyTransitionEmployerPoolBillions)}. The 2025 group-health detail is projected from BEA's 2024 component using growth in the checked-in combined pension-and-insurance supplement.
          </Formula></Audit>
        </section>

        <section className="content-card health-limitations"><h2>Interpret the result as a static incidence test</h2><p>The linked microdata captures age, family structure, wages, plan tier, employee premiums, and local benchmark premiums. It cannot identify coworkers or literal employers, so the cell-equal rule is an approximation. Silver benchmark coverage may have higher cost sharing or narrower networks than current ESI, and moving the whole ESI population could change individual-market premiums. Those are not included in the winner calculation.</p><ul><li><strong>CPS ASEC and HIPM</strong><span><a href={healthSnapshot.source.asec.url} target="_blank" rel="noreferrer">2025 ASEC archive</a> · <a href={healthSnapshot.source.hipm.dictionaryUrl} target="_blank" rel="noreferrer">HIPM documentation</a></span></li><li><strong>MEPS-IC</strong><span><a href={healthSnapshot.source.mepsPrivate.url} target="_blank" rel="noreferrer">2025 private employer costs</a> · <a href={healthSnapshot.source.mepsPublic.url} target="_blank" rel="noreferrer">2024 state/local costs</a></span></li><li><strong>BEA and CMS</strong><span><a href={healthSnapshot.source.bea.url} target="_blank" rel="noreferrer">Employer group-health control</a> · <a href={healthSnapshot.source.cmsBenchmarkTrend.url} target="_blank" rel="noreferrer">2025 benchmark-premium trend</a></span></li></ul></section>
      </div>
    </div>
  </main>;
}

function RangeControl({ label, value, min, max, step, display, onChange, hint, disabled = false }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void; hint?: string; disabled?: boolean }) {
  return <label className="control-field"><span className="control-heading"><span>{label}</span><strong>{display}</strong></span><input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />{hint && <small className="control-hint">{hint}</small>}</label>;
}

function DistributionTable({ title, rows }: { title: string; rows: HealthDistributionSummary[] }) {
  return <section className="table-card compact health-distribution"><h2>{title}</h2><div className="responsive-table"><table><thead><tr><th>Group</th><th>Covered people</th><th>Better off</th><th>Avg health wage / unit</th><th>Avg current premium / unit</th><th>Avg benchmark / unit</th><th>Avg annual change / unit</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.label}</td><td>{millionsPeople(row.coveredPeopleMillions)}</td><td className={row.winnerShare >= 0.5 ? 'good-text' : 'bad-text'}>{percent(row.winnerShare)}</td><td>{dollars(row.averageHealthWage)}</td><td>{dollars(row.averageEmployeePremium)}</td><td>{dollars(row.averageBenchmarkPremium)}</td><td className={row.averageDollarChange >= 0 ? 'good-text' : 'bad-text'}>{dollars(row.averageDollarChange)}</td></tr>)}</tbody></table></div></section>;
}
