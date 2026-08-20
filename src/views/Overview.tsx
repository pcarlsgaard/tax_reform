import { Audit, Formula } from '../components/Audit';
import { RangeField, SelectField } from '../components/Controls';
import { MetricCard } from '../components/MetricCard';
import { dollars, moneyB, percent } from '../components/format';
import {
  microdata2025,
  type AdultCreditAuditBucketId,
  type AdultCreditMode,
  type MacroResult,
  type ReformSettings,
  type ReplacedTax,
  type WageTaxMode,
} from '../model';

const taxLabels: Record<ReplacedTax, string> = {
  individualIncome: 'Individual income tax',
  payroll: 'Payroll taxes',
  corporateIncome: 'Corporate income tax',
  customs: 'Customs duties',
};

const adultCreditBucketLabels: Record<AdultCreditAuditBucketId, string> = {
  noEligibleAdult: 'No credit-eligible adult',
  zeroCompensation: 'Zero compensation',
  phaseIn: 'Phase-in only',
  fullCredit: 'Full-credit plateau',
  phaseInPhaseOutOverlap: 'Phase-in and phaseout overlap',
  phaseOut: 'Partial credit in phaseout',
  fullyPhasedOut: 'Credit fully phased out',
  noCreditUnderSchedule: 'Zero credit for another reason',
  universalCredit: 'Universal credit',
};

const billions = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`;
const countMillions = (value: number) => `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;

export function Overview({ settings, setSettings, result }: { settings: ReformSettings; setSettings: (value: ReformSettings) => void; result: MacroResult }) {
  const hasFiscalSavings = result.totalFederalSavings > 0;
  const update = (patch: Partial<ReformSettings>) => setSettings({ ...settings, ...patch });
  const toggleTax = (key: ReplacedTax) => update({ replacedTaxes: { ...settings.replacedTaxes, [key]: !settings.replacedTaxes[key] } });

  return (
    <div className="view-grid overview-view">
      <aside className="control-panel">
        <div className="eyebrow">Design the reform</div>
        <h2>Policy settings</h2>
        <SelectField label="Wage-side structure" value={settings.wageTaxMode} options={[{ value: 'flat', label: 'Flat X tax' }, { value: 'progressive', label: 'Progressive X tax' }]} onChange={(wageTaxMode) => update({ wageTaxMode: wageTaxMode as WageTaxMode })} hint="The business cash-flow rate remains the headline rate." />
        <RangeField label="Statutory tax rate" value={settings.rate} min={0.10} max={0.45} step={0.005} display={percent(settings.rate)} onChange={(rate) => update({ rate })} />
        {settings.wageTaxMode === 'progressive' && <div className="control-group">
          <span>Progressive wage schedule</span>
          <RangeField label="Zero-rate ceiling / adult" value={settings.progressiveZeroBracketPerAdult} min={0} max={100000} step={1000} display={`$${settings.progressiveZeroBracketPerAdult.toLocaleString()}`} onChange={(progressiveZeroBracketPerAdult) => update({ progressiveZeroBracketPerAdult })} />
          <RangeField label="Top-rate threshold / adult" value={settings.progressiveTopBracketPerAdult} min={25000} max={300000} step={5000} display={`$${settings.progressiveTopBracketPerAdult.toLocaleString()}`} onChange={(progressiveTopBracketPerAdult) => update({ progressiveTopBracketPerAdult })} />
          <RangeField label="Middle wage rate" value={Math.min(settings.rate, settings.progressiveMiddleRate)} min={0} max={settings.rate} step={0.005} display={percent(Math.min(settings.rate, settings.progressiveMiddleRate))} onChange={(progressiveMiddleRate) => update({ progressiveMiddleRate })} hint="Direct statutory rate in 0.5 percentage-point increments." />
          <p className="control-note">CPS microdata imply an average wage rate equal to <strong>{percent(result.microdataAverageWageRateShare)}</strong> of the business rate for this schedule.</p>
        </div>}
        <SelectField label="Adult credit structure" value={settings.adultCreditMode} options={[{ value: 'earned', label: 'EITC-like phase-in/out' }, { value: 'universal', label: 'Universal flat credit' }]} onChange={(adultCreditMode) => update({ adultCreditMode: adultCreditMode as AdultCreditMode })} />
        <RangeField label="Maximum adult credit" value={settings.adultCredit} min={0} max={12000} step={100} display={`$${settings.adultCredit.toLocaleString()}`} onChange={(adultCredit) => update({ adultCredit })} hint="Maximum per adult; fully refundable." />
        {settings.adultCreditMode === 'earned' && <div className="control-group">
          <span>Adult credit calibration</span>
          <RangeField label="Phase-in rate" value={settings.adultCreditPhaseInRate} min={0} max={1} step={0.01} display={percent(settings.adultCreditPhaseInRate)} onChange={(adultCreditPhaseInRate) => update({ adultCreditPhaseInRate })} />
          <RangeField label="Phase-out starts / adult" value={settings.adultCreditPhaseOutStartPerAdult} min={0} max={200000} step={2500} display={`$${settings.adultCreditPhaseOutStartPerAdult.toLocaleString()}`} onChange={(adultCreditPhaseOutStartPerAdult) => update({ adultCreditPhaseOutStartPerAdult })} />
          <RangeField label="Phase-out rate" value={settings.adultCreditPhaseOutRate} min={0} max={0.50} step={0.005} display={percent(settings.adultCreditPhaseOutRate)} onChange={(adultCreditPhaseOutRate) => update({ adultCreditPhaseOutRate })} />
        </div>}
        <RangeField label="Adult-credit take-up" value={settings.adultCreditTakeUpRate} min={0} max={1} step={0.01} display={percent(settings.adultCreditTakeUpRate)} onChange={(adultCreditTakeUpRate) => update({ adultCreditTakeUpRate })} hint="Aggregate participation assumption applied after the CPS statutory eligibility score; individual examples show statutory eligibility." />
        <RangeField label="Child credit" value={settings.childCredit} min={0} max={12000} step={100} display={`$${settings.childCredit.toLocaleString()}`} onChange={(childCredit) => update({ childCredit })} hint="Fully refundable; one per person under 18." />
        <RangeField label="Noncompliance" value={settings.noncomplianceRate} min={0} max={0.30} step={0.005} display={percent(settings.noncomplianceRate)} onChange={(noncomplianceRate) => update({ noncomplianceRate })} />
        <RangeField label="Other broad exemptions" value={settings.exemptionShare} min={0} max={0.30} step={0.005} display={percent(settings.exemptionShare)} onChange={(exemptionShare) => update({ exemptionShare })} hint="Share removed from every otherwise-compliant component before the named compensation exemptions." />
        <div className="control-group">
          <span>Compensation exemptions</span>
          <RangeField label="Cash wages exempt" value={settings.cashWageExemptionShare} min={0} max={1} step={0.01} display={percent(settings.cashWageExemptionShare)} onChange={(cashWageExemptionShare) => update({ cashWageExemptionShare })} />
          <RangeField label="Employer social insurance exempt" value={settings.employerSocialInsuranceExemptionShare} min={0} max={1} step={0.01} display={percent(settings.employerSocialInsuranceExemptionShare)} onChange={(employerSocialInsuranceExemptionShare) => update({ employerSocialInsuranceExemptionShare })} />
          <RangeField label="Employer health insurance exempt" value={settings.employerHealthInsuranceExemptionShare} min={0} max={1} step={0.01} display={percent(settings.employerHealthInsuranceExemptionShare)} onChange={(employerHealthInsuranceExemptionShare) => update({ employerHealthInsuranceExemptionShare })} hint="The ESI exclusion is now independent of pensions." />
          <RangeField label="Employer pension / other insurance exempt" value={settings.employerPensionOtherInsuranceExemptionShare} min={0} max={1} step={0.01} display={percent(settings.employerPensionOtherInsuranceExemptionShare)} onChange={(employerPensionOtherInsuranceExemptionShare) => update({ employerPensionOtherInsuranceExemptionShare })} hint="All four compensation components are fully taxable by default." />
        </div>
        <fieldset className="tax-checks"><legend>Existing taxes replaced</legend>{(Object.keys(taxLabels) as ReplacedTax[]).map((key) => <label key={key}><input type="checkbox" checked={settings.replacedTaxes[key]} onChange={() => toggleTax(key)} /><span>{taxLabels[key]}</span></label>)}</fieldset>
      </aside>

      <main className="results-panel">
        <div className="view-intro"><div><span className="eyebrow">2025 provisional static baseline</span><h1>A consumption tax you can audit</h1></div><p>The model separates the economic base, compliance, policy carve-outs, credits, and the receipts being replaced. Every number below is a direct identity.</p></div>
        <div className="metric-grid">
          <MetricCard label="Final taxable base" value={moneyB(result.taxableBase)} note={`${percent(result.basePercentGdp)} of GDP`} tone="accent"><MacroBaseAudit result={result} /></MetricCard>
          <MetricCard label="Gross collections" value={moneyB(result.grossRevenue)} note={`${percent(result.grossRevenuePercentGdp)} of GDP`}><Audit><Formula>{moneyB(result.rateAdjustedBase)} rate-adjusted base × {percent(settings.rate)} = {moneyB(result.grossRevenue)}</Formula></Audit></MetricCard>
          <MetricCard label="Refundable credits" value={moneyB(result.adultCreditCost + result.childCreditCost + result.insuranceCreditCost)} note={`${percent(result.creditCostPercentGdp)} of GDP`}><Audit><Formula>{moneyB(result.adultCreditStatutoryCost)} statutory adult eligibility × {percent(result.adultCreditTakeUpRate)} take-up = {moneyB(result.adultCreditCost)} adult credits<br />+ {moneyB(result.childCreditCost)} child credits<br />+ {moneyB(result.insuranceCreditCost)} premium-purchase credits</Formula></Audit></MetricCard>
          <MetricCard label="Net federal revenue" value={moneyB(result.netRevenue)} note={`${percent(result.netRevenuePercentGdp)} of GDP · adjusted target ${percent(result.adjustedTargetRevenuePercentGdp)}`} tone={result.adjustedSurplusDeficit >= 0 ? 'good' : 'bad'}><RevenueAudit result={result} /></MetricCard>
          <MetricCard label={result.adjustedSurplusDeficit >= 0 ? 'Adjusted static surplus' : 'Adjusted static deficit'} value={moneyB(result.adjustedSurplusDeficit)} note={`${percent(result.adjustedSurplusDeficitPercentGdp)} of GDP${hasFiscalSavings ? ` · ${moneyB(result.totalFederalSavings)} total savings` : ''}`} tone={result.adjustedSurplusDeficit >= 0 ? 'good' : 'bad'} />
          <MetricCard label="Revenue-neutral rate" value={percent(result.adjustedRevenueNeutralRate, 2)} note={hasFiscalSavings ? `Before fiscal savings ${percent(result.revenueNeutralRate, 2)}` : 'Solved algebraically'} tone="accent"><Audit><Formula>{hasFiscalSavings && <>{moneyB(result.targetRevenue)} original target<br />− {moneyB(result.refundableTaxCreditOutlaySavings)} automatic refundable EITC/CTC outlay savings<br />− {moneyB(result.federalTransferSavings)} selected external-program savings<br />= {moneyB(result.adjustedTargetRevenue)} adjusted target.<br /><br /></>}({moneyB(result.adjustedTargetRevenue)} + {moneyB(result.adultCreditCost + result.childCreditCost + result.insuranceCreditCost)}) ÷ {moneyB(result.rateAdjustedBase)} rate-adjusted base = {percent(result.adjustedRevenueNeutralRate, 2)}</Formula></Audit></MetricCard>
        </div>
        <AdultCreditAuditPanel result={result} settings={settings} />
        <Flow result={result} />
        <section className="concept-note"><span className="eyebrow">Canonical implementation</span><h2>{settings.wageTaxMode === 'flat' ? 'Flat-rate' : 'Progressive'} X tax / DBCFT presentation</h2><p>Businesses pay the headline rate on destination-based cash flow after wages and new investment. Households pay either that same flat rate or the selected progressive wage schedule, then receive refundable adult and child credits. This is economically related to a broad VAT, but the statutory collection and household presentation are not treated as interchangeable.</p></section>
      </main>
    </div>
  );
}

function AdultCreditAuditPanel({ result, settings }: { result: MacroResult; settings: ReformSettings }) {
  const audit = result.adultCreditAudit;
  const controls = microdata2025.compensationControlsBillions;
  const rows = audit.buckets.filter((row) => row.taxUnitsMillions > 0
    || (row.id === 'phaseInPhaseOutOverlap' && audit.phaseInPhaseOutOverlap));
  const scheduleSummary = settings.adultCreditMode === 'universal'
    ? `Every credit-eligible adult receives ${dollars(settings.adultCredit)} regardless of compensation.`
    : `Maximum phase-in at ${audit.fullPhaseInCompensationPerAdult === null ? 'not reached' : `${dollars(audit.fullPhaseInCompensationPerAdult)} per adult`}; phaseout starts at ${dollars(audit.phaseOutStartCompensationPerAdult)} per adult; ${audit.zeroCreditCompensationPerAdult === null ? 'the selected schedule has no finite phaseout endpoint' : `credit reaches zero at ${dollars(audit.zeroCreditCompensationPerAdult)} per adult`}.`;

  return <section className="table-card compact adult-credit-audit">
    <div className="section-heading"><div><span className="eyebrow">Live CPS rescore</span><h2>Adult-credit cost audit</h2><p>Every slider change reruns the selected schedule over all aggregated CPS tax-unit cells.</p></div><strong>{billions(result.adultCreditCost)} budget cost</strong></div>
    <div className="credit-audit-summary">
      <div><span>Statutory eligibility</span><strong>{billions(result.adultCreditStatutoryCost)}</strong><small>Before take-up</small></div>
      <div><span>Universal maximum</span><strong>{billions(audit.universalMaximumCostBillions)}</strong><small>{percent(audit.statutoryCostShareOfUniversalMaximum, 1)} realized</small></div>
      <div><span>Average per adult</span><strong>{dollars(audit.averageStatutoryCreditPerAdult)}</strong><small>Across all Census adults</small></div>
      <div><span>Adults in positive-credit units</span><strong>{countMillions(audit.adultsInPositiveCreditUnitsMillions)}</strong><small>Statutory · {percent(audit.adultsInPositiveCreditUnitsShare, 1)} of adults</small></div>
    </div>
    <p className="schedule-summary">{scheduleSummary}</p>
    {settings.adultCreditMode === 'earned' && audit.phaseInPhaseOutOverlap && <p className="callout">The selected phaseout begins before the credit can fully phase in. Some tax units are therefore simultaneously phasing in and phasing out; the overlap appears as its own row below.</p>}
    <div className="responsive-table"><table><thead><tr><th>Schedule position</th><th>Tax units</th><th>Adults</th><th>Share of adults</th><th>Statutory cost</th><th>After take-up</th><th>Average / adult</th><th>Share of cost</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.id}><td>{adultCreditBucketLabels[row.id]}</td><td>{countMillions(row.taxUnitsMillions)}</td><td>{countMillions(row.adultsMillions)}</td><td>{percent(row.adultPopulationShare, 1)}</td><td>{billions(row.statutoryCostBillions)}</td><td>{billions(row.budgetCostBillions)}</td><td>{row.adultsMillions > 0 ? dollars(row.averageStatutoryCreditPerAdult) : '—'}</td><td>{percent(row.statutoryCostShare, 1)}</td></tr>)}
      <tr className="total"><td>Total</td><td>{countMillions(audit.totalTaxUnitsMillions)}</td><td>{countMillions(audit.totalAdultsMillions)}</td><td>100.0%</td><td>{billions(result.adultCreditStatutoryCost)}</td><td>{billions(result.adultCreditCost)}</td><td>{dollars(audit.averageStatutoryCreditPerAdult)}</td><td>{result.adultCreditStatutoryCost > 0 ? '100.0%' : '0.0%'}</td></tr>
    </tbody></table></div>
    <div className="two-column credit-audit-notes">
      <div className="content-card"><h3>Eligibility-income definition</h3><p><strong>{moneyB(controls.cashWagesAndSalaries)}</strong> BEA-raked cash wages + <strong>{moneyB(controls.employerGovernmentSocialInsurance)}</strong> employer government social insurance + <strong>{moneyB(controls.employerPensionAndInsurance)}</strong> employer pension and insurance supplements = <strong>{moneyB(controls.totalCompensation)}</strong> gross employee compensation.</p><p>Employer supplements are allocated to tax units in proportion to cash wages. Self-employment income is not included. Tax-base exemptions, broad exemptions, and noncompliance do not reduce credit-eligibility income.</p></div>
      <div className="content-card"><h3>Population, weights, and uncertainty</h3><p>Credit adults are all people age 18 or older assigned to the Census <code>TAX_ID</code>. Adult counts and credit dollars are calibrated to the 2025 Census adult population; tax-unit counts retain CPS survey weights.</p><p>The published <strong>{billions(microdata2025.uncertainty.earnedAdultCreditCostStandardErrorBillions)}</strong> sampling standard error applies only to the default schedule. It does not update with the sliders and excludes policy-definition, tax-unit, top-tail, take-up, and employer-benefit-allocation uncertainty.</p></div>
    </div>
    <Audit title="Audit the live calculation identity"><Formula>For each CPS tax unit:<br />maximum = eligible adults × {dollars(settings.adultCredit)}<br />phase-in = min(maximum, gross employee compensation × {percent(settings.adultCreditPhaseInRate)})<br />phaseout = max(0, gross employee compensation − eligible adults × {dollars(settings.adultCreditPhaseOutStartPerAdult)}) × {percent(settings.adultCreditPhaseOutRate)}<br />statutory credit = {settings.adultCreditMode === 'universal' ? 'maximum' : 'max(0, phase-in − phaseout)'}<br /><br />Weighted statutory credits = {billions(result.adultCreditStatutoryCost)}<br />× {percent(settings.adultCreditTakeUpRate)} take-up<br />= {billions(result.adultCreditCost)} budget cost.</Formula></Audit>
  </section>;
}

function MacroBaseAudit({ result }: { result: MacroResult }) {
  return <Audit><Formula>{moneyB(result.theoreticalBase)} theoretical<br />− {moneyB(result.noncomplianceLoss)} noncompliance<br />− {moneyB(result.broadPolicyExemptionLoss)} broad exemptions<br />− {moneyB(result.compensationExemptionLoss)} named compensation exemptions<br />= {moneyB(result.taxableBase)} ({percent(result.basePercentGdp)} of GDP)</Formula></Audit>;
}

function RevenueAudit({ result }: { result: MacroResult }) {
  return <Audit><Formula>{moneyB(result.grossRevenue)} gross<br />− {moneyB(result.adultCreditCost)} adult credits<br />− {moneyB(result.childCreditCost)} child credits<br />− {moneyB(result.insuranceCreditCost)} health-insurance credits<br />= {moneyB(result.netRevenue)}</Formula></Audit>;
}

function Flow({ result }: { result: MacroResult }) {
  const items = [
    ['GDP', result.gdp], ['Broad consumption', result.theoreticalBase], ['After compliance', result.baseAfterCompliance],
    ['After exemptions', result.taxableBase], ['Gross tax', result.grossRevenue], ['Net of credits', result.netRevenue],
  ] as const;
  return <section className="flow-card"><div className="eyebrow">Accounting flow</div><div className="flow-row">{items.map(([label, value], index) => <div className="flow-item" key={label}><span>{label}</span><strong>{moneyB(value)}</strong>{index < items.length - 1 && <i>→</i>}</div>)}</div></section>;
}
