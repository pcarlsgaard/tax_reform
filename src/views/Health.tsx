import { Audit, Formula } from '../components/Audit';
import { MetricCard } from '../components/MetricCard';
import { ParetoChart } from '../components/ParetoChart';
import { dollars, percent } from '../components/format';
import {
  healthSnapshot,
  nongroupHealthSnapshot,
  type HealthAnalysis,
  type HealthDistributionSummary,
  type HealthPolicySettings,
  type HealthRecipientScope,
  type HealthRedistributionRule,
  type MacroResult,
  type ReformSettings,
} from '../model';

const billions = (value: number, digits = 1) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(digits)}B`;
const millionsPeople = (value: number) => `${value.toFixed(1)}M`;

export function Health({ settings, policy, setPolicy, result, macro }: { settings: ReformSettings; policy: HealthPolicySettings; setPolicy: (value: HealthPolicySettings) => void; result: HealthAnalysis; macro: MacroResult }) {
  const update = (patch: Partial<HealthPolicySettings>) => setPolicy({ ...policy, ...patch });
  const nearTermFiscalGap = macro.adjustedSurplusDeficit - macro.gdp * 0.016;
  const liveParetoPoint = {
    winnerShare: result.winnerCoveredPeopleShare,
    meanAbsMtr: result.meanAbsoluteMtrChange,
    mtrPreserved: result.mtrWithinTwoPointsShare,
    rate: settings.rate,
    healthCost: result.totalHealthCreditCostBillions,
    fiscalGap: nearTermFiscalGap,
    medianChange: result.medianDollarChange,
    middleRate: settings.wageTaxMode === 'flat'
      ? settings.rate
      : Math.min(settings.rate, settings.progressiveMiddleRate),
    adultHealthCredit: policy.adultHealthCredit,
    childHealthCredit: policy.childHealthCredit,
  };

  return <main className="page-shell health-page">
    <div className="view-intro"><div><span className="eyebrow">ESI transition · linked CPS microdata</span><h1>Cash out employer health benefits and test who wins</h1></div><p>The employer pool is redistributed equally among ESI policyholder workers, and the same premium-capped refundable credit is extended to qualifying nongroup and newly insured people. Adult and child amounts are separate.</p></div>

    <div className="health-layout">
      <aside className="control-panel health-controls">
        <span className="eyebrow">Policy controls</span><h2>Insurance credit</h2>
        <RangeControl label="Refundable adult health credit" value={policy.adultHealthCredit} min={0} max={3500} step={250} display={dollars(policy.adultHealthCredit)} onChange={(adultHealthCredit) => update({ adultHealthCredit })} hint="Per covered adult; the household total is capped at its benchmark premium." />
        <RangeControl label="Refundable child health credit" value={policy.childHealthCredit} min={0} max={1500} step={250} display={dollars(policy.childHealthCredit)} onChange={(childHealthCredit) => update({ childHealthCredit })} hint="Per covered child, separately adjustable because child premiums are generally lower." />
        <RangeControl label="Uninsured enrollment take-up" value={policy.uninsuredTakeUpRate} min={0} max={1} step={0.05} display={percent(policy.uninsuredTakeUpRate, 0)} onChange={(uninsuredTakeUpRate) => update({ uninsuredTakeUpRate })} hint="Share of the full credit cost for currently uninsured people who enroll." />
        <details className="control-disclosure"><summary>Advanced transition assumptions</summary><div>
          <label className="select-field"><span>Employer contribution redistribution</span><select value={policy.redistributionRule} onChange={(event) => update({ redistributionRule: event.target.value as HealthRedistributionRule })}><option value="nationalEqual">Equal national wage</option><option value="employerCellEqual">Equal within sector / firm-size cells</option><option value="ownContribution">Convert own imputed contribution</option></select><small className="control-hint">The searched plans use equal national dollars among ESI policyholder workers.</small></label>
          <label className="select-field"><span>Workers receiving redistributed wages</span><select disabled={policy.redistributionRule === 'ownContribution'} value={policy.recipientScope} onChange={(event) => update({ recipientScope: event.target.value as HealthRecipientScope })}><option value="policyholders">ESI policyholder workers</option><option value="coveredWorkers">All ESI-covered workers</option></select><small className="control-hint">A spouse covered through the policyholder shares the resulting resources through the tax unit; this does not require a second wage allocation.</small></label>
          <RangeControl label="Employer health contribution passed to wages" value={policy.employerHealthPassThroughRate} min={0} max={1} step={0.05} display={percent(policy.employerHealthPassThroughRate, 0)} onChange={(employerHealthPassThroughRate) => update({ employerHealthPassThroughRate })} />
          <RangeControl label="Repealed employer FICA passed to wages" value={policy.employerFicaPassThroughRate} min={0} max={1} step={0.05} display={percent(policy.employerFicaPassThroughRate, 0)} onChange={(employerFicaPassThroughRate) => update({ employerFicaPassThroughRate })} disabled={!settings.replacedTaxes.payroll} />
          <RangeControl label="Current employee premium paid pre-tax" value={policy.employeePremiumPreTaxShare} min={0} max={1} step={0.05} display={percent(policy.employeePremiumPreTaxShare, 0)} onChange={(employeePremiumPreTaxShare) => update({ employeePremiumPreTaxShare })} />
          <RangeControl label="Benchmark premium factor" value={policy.benchmarkPremiumScale} min={0.8} max={1.3} step={0.01} display={percent(policy.benchmarkPremiumScale, 0)} onChange={(benchmarkPremiumScale) => update({ benchmarkPremiumScale })} hint="103% converts the HIPM 2024 benchmark to CMS's average 2025 change." />
        </div></details>
      </aside>

      <div className="health-results">
        <div className="metric-grid health-metrics">
          <MetricCard label="Covered people better off" value={percent(result.winnerCoveredPeopleShare)} note={`${millionsPeople(result.coveredPeopleMillions)} nonelderly ESI lives in scope`} tone={result.winnerCoveredPeopleShare >= 2 / 3 ? 'good' : 'bad'} />
          <MetricCard label="Median annual change" value={dollars(result.medianDollarChange)} note={`P10 ${dollars(result.p10DollarChange)} · P90 ${dollars(result.p90DollarChange)}`} tone={result.medianDollarChange >= 0 ? 'good' : 'bad'} />
          <MetricCard label="Employer health wage" value={dollars(result.averageHealthWagePerRecipient)} note={`${billions(result.allocatedHealthWagesBillions)} allocated to selected recipients`} tone="accent" />
          <MetricCard label="Total health-credit cost" value={billions(result.totalHealthCreditCostBillions)} note={`${billions(result.healthCreditCostBillions)} ESI · ${billions(result.nongroupExtensionCostBillions)} nongroup / uninsured`} />
          <MetricCard label="Rate increment to finance credit" value={`${(result.healthCreditFinancingRateIncrease * 100).toFixed(2)} pp`} note="Static addition to the selected reform's rate-adjusted base" />
          <MetricCard label="Mean absolute MTR movement" value={`${(result.meanAbsoluteMtrChange * 100).toFixed(1)} pp`} note={`${percent(result.mtrWithinTwoPointsShare)} of ESI-covered people stay within ±2 pp`} tone="accent" />
          <MetricCard label="Benchmark premium pool" value={billions(result.benchmarkPremiumBillions)} note="Second-lowest-cost Silver, before the fixed credit" />
          <MetricCard label="Aggregate resource change" value={billions(result.aggregateResourceChangeBillions)} note="Reform minus current disposable cash after premiums" tone={result.aggregateResourceChangeBillions >= 0 ? 'good' : 'bad'} />
        </div>

        <ParetoChart live={liveParetoPoint} />

        <section className="table-card compact health-identity">
          <div className="section-heading"><div><span className="eyebrow">Household identity</span><h2>What is compared</h2><p>Coverage is held conceptually constant; current ESI and reform benchmark insurance are both treated as purchased.</p></div><strong>{percent(result.winnerTaxUnitShare)} of tax units win</strong></div>
          <div className="two-column"><Formula>Current law<br />cash wages<br />− income tax before credits<br />− employee payroll tax<br />+ EITC / CTC<br />− employee ESI premium</Formula><Formula>Reform<br />cash wages + FICA pass-through + health wage<br />− reform and retained tax before credits<br />+ adult / child / retained credits<br />+ fixed health credit<br />− ACA benchmark premium</Formula></div>
          <p className="table-note">The Designer now scores employer health separately from pension and other insurance. The selected employer-health exemption share applies to the converted health compensation in this incidence view; reclassification does not enlarge total compensation.</p>
        </section>

        <section className="table-card compact">
          <div className="section-heading"><div><span className="eyebrow">Federal cost</span><h2>Who receives the premium-credit floor</h2><p>The same adult/child schedule applies across coverage sources. Existing APTC is topped up only when below the proposed premium-capped credit.</p></div><strong>{billions(result.totalHealthCreditCostBillions)} total</strong></div>
          <div className="responsive-table"><table><thead><tr><th>Coverage group</th><th>Incremental annual cost</th><th>Policy treatment</th></tr></thead><tbody>
            <tr><td>People transitioning from ESI</td><td>{billions(result.healthCreditCostBillions)}</td><td>Full adult/child credit, benchmark-capped</td></tr>
            <tr><td>Nongroup coverage without positive APTC</td><td>{billions(result.nongroupNoAptcCostBillions)}</td><td>Full credit floor</td></tr>
            <tr><td>Current APTC below the proposed floor</td><td>{billions(result.nongroupAptcFloorTopUpCostBillions)}</td><td>Top-up only</td></tr>
            <tr><td>Currently uninsured people induced to enroll</td><td>{billions(result.uninsuredInducedEnrollmentCostBillions)}</td><td>{percent(policy.uninsuredTakeUpRate, 0)} of {billions(result.uninsuredFullTakeUpCostBillions)} full take-up cost</td></tr>
            <tr className="total"><td>Total refundable health credit</td><td>{billions(result.totalHealthCreditCostBillions)}</td><td>Included in Designer and National revenue</td></tr>
          </tbody></table></div>
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
            <tr><td>Refundable health credits for ESI transition</td><td>{billions(result.healthCreditCostBillions)}</td><td>{dollars(policy.adultHealthCredit)} adult / {dollars(policy.childHealthCredit)} child, premium-capped</td></tr>
            <tr><td>Nongroup and induced-enrollment extension</td><td>{billions(result.nongroupExtensionCostBillions)}</td><td>Unsubsidized floor + APTC top-ups + take-up</td></tr>
            <tr><td>Static rate increment to finance credits</td><td>{(result.healthCreditFinancingRateIncrease * 100).toFixed(2)} percentage points</td><td>Credit cost ÷ selected reform's rate-adjusted national base</td></tr>
          </tbody></table></div>
          <Audit title="Source and imputation audit"><Formula>
            {healthSnapshot.sample.samplePersons.toLocaleString()} ASEC people · {healthSnapshot.sample.healthTaxUnits.toLocaleString()} affected sample tax units · {healthSnapshot.browserReconciliation.analyticalCells.toLocaleString()} anonymous browser cells<br /><br />
            HIPM linkage: {percent(healthSnapshot.sample.hipmMatchRate)} · wage scale to 2025 BEA: {healthSnapshot.calibration.cashWageScaleToBea2025.toFixed(4)} · employer contribution scale to BEA: {healthSnapshot.calibration.employerContributionScaleToBea.toFixed(4)} · employee premium scale to MEPS: {healthSnapshot.calibration.employeePremiumScaleToMeps2025.toFixed(4)}<br /><br />
            Projected 2025 BEA group health: {billions(healthSnapshot.calibration.projectedBeaGroupHealth2025Billions)}; nonelderly transition share: {billions(healthSnapshot.calibration.nonelderlyTransitionEmployerPoolBillions)}. The 2025 group-health detail is projected from BEA's 2024 component using growth in the checked-in combined pension-and-insurance supplement.
            <br /><br />Nongroup extension: {nongroupHealthSnapshot.statusCodes['1']}; {nongroupHealthSnapshot.statusCodes['2']}; and {nongroupHealthSnapshot.statusCodes['3']}.
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
