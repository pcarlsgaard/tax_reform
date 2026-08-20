import { Audit, Formula } from '../components/Audit';
import { moneyB, percent } from '../components/format';
import { baseline, microdata2025, type MacroResult, type ReformSettings } from '../model';

export function National({ settings, result }: { settings: ReformSettings; result: MacroResult }) {
  const components = [
    ['Compensation of employees', baseline.components.compensation, 'COE'],
    ['Net capital income after investment', baseline.components.netCapitalIncomeAfterInvestment, baseline.componentFormulas.netCapitalIncomeAfterInvestment],
    ['Net imports', baseline.components.netImports, baseline.componentFormulas.netImports],
    ['Housing adjustment', baseline.components.housingAdjustment, baseline.componentFormulas.housingAdjustment],
  ] as const;
  const compensation = baseline.compensationComponents;
  const compensationTotal = compensation.cashWagesAndSalaries
    + compensation.employerGovernmentSocialInsurance
    + compensation.employerHealthInsurance
    + compensation.employerPensionAndOtherInsurance;
  return <main className="page-shell">
    <div className="view-intro"><div><span className="eyebrow">National revenue</span><h1>From GDP to the taxable base</h1></div><p>The snapshot preserves the repository’s NIPA cash-flow method while fixing its labels: compliance and exemptions are now distinct stages.</p></div>
    <section className="table-card">
      <div className="section-heading"><div><h2>2025 provisional NIPA construction</h2><p>Billions of dollars; calendar-year annual averages or annual observations.</p></div><strong>{percent(result.taxableBase / result.gdp)} of GDP taxable</strong></div>
      <div className="responsive-table"><table><thead><tr><th>Component</th><th>Formula / series</th><th>Value</th><th>% GDP</th></tr></thead><tbody>{components.map(([label, value, formula]) => <tr key={label}><td>{label}</td><td><code>{formula}</code></td><td>{moneyB(value)}</td><td>{percent(value / result.gdp)}</td></tr>)}<tr className="subtotal"><td>Theoretical broad base</td><td>Sum of four rows</td><td>{moneyB(result.theoreticalBase)}</td><td>{percent(result.theoreticalBase / result.gdp)}</td></tr><tr><td>Noncompliance loss</td><td>− theoretical base × {percent(settings.noncomplianceRate)}</td><td>−{moneyB(result.noncomplianceLoss)}</td><td>−{percent(result.noncomplianceLoss / result.gdp)}</td></tr><tr><td>Base after compliance</td><td>Theoretical base − noncompliance</td><td>{moneyB(result.baseAfterCompliance)}</td><td>{percent(result.baseAfterCompliance / result.gdp)}</td></tr><tr><td>Other broad exemptions</td><td>− compliant base × {percent(settings.exemptionShare)}</td><td>−{moneyB(result.broadPolicyExemptionLoss)}</td><td>−{percent(result.broadPolicyExemptionLoss / result.gdp)}</td></tr><tr><td>Named compensation exemptions</td><td>− taxable shares selected below</td><td>−{moneyB(result.compensationExemptionLoss)}</td><td>−{percent(result.compensationExemptionLoss / result.gdp)}</td></tr><tr className="total"><td>Final taxable base</td><td>Compliant broad base − all exemptions</td><td>{moneyB(result.taxableBase)}</td><td>{percent(result.taxableBase / result.gdp)}</td></tr></tbody></table></div>
      <Audit title="Audit the NIPA identities"><Formula>Net capital = corporate profits + proprietors’ income + net interest + capital consumption + production taxes − gross private domestic investment.<br /><br />Net imports = imports − exports.<br /><br />Housing adjustment = household investment − housing-sector value added.</Formula></Audit>
    </section>
    <section className="table-card compact">
      <div className="section-heading"><div><h2>Compensation base under study</h2><p>BEA 2025 controls; all components are taxable by default.</p></div><strong>{moneyB(result.wageTaxableBase)} after compliance and exemptions</strong></div>
      <div className="responsive-table"><table><thead><tr><th>Compensation component</th><th>BEA control</th><th>Exempt share</th></tr></thead><tbody>
        <tr><td>Cash wages and salaries</td><td>{moneyB(compensation.cashWagesAndSalaries)}</td><td>{percent(settings.cashWageExemptionShare)}</td></tr>
        <tr><td>Employer government social insurance</td><td>{moneyB(compensation.employerGovernmentSocialInsurance)}</td><td>{percent(settings.employerSocialInsuranceExemptionShare)}</td></tr>
        <tr><td>Employer health insurance</td><td>{moneyB(compensation.employerHealthInsurance)}</td><td>{percent(settings.employerHealthInsuranceExemptionShare)}</td></tr>
        <tr><td>Employer pension and other insurance</td><td>{moneyB(compensation.employerPensionAndOtherInsurance)}</td><td>{percent(settings.employerPensionOtherInsuranceExemptionShare)}</td></tr>
        <tr className="total"><td>Total compensation</td><td>{moneyB(compensationTotal)}</td><td>Policy-weighted</td></tr>
      </tbody></table></div>
      <Audit title="How CPS and BEA are combined"><Formula>The CPS ASEC tax-unit wage distribution is raked to {moneyB(compensation.cashWagesAndSalaries)} of BEA cash wages. The two employer-supplement controls are allocated in proportion to each tax unit’s cash wages, then the selected component exemptions and progressive wage schedule are applied unit by unit.</Formula></Audit>
    </section>
    <section className="table-card compact">
      <div className="section-heading"><div><h2>Revenue as a share of GDP</h2><p>The same accounting identity in dollars and GDP percentage points.</p></div><strong>GDP {moneyB(result.gdp)}</strong></div>
      <div className="responsive-table"><table><thead><tr><th>Revenue item</th><th>Value</th><th>% GDP</th></tr></thead><tbody>
        <tr><td>Gross collections</td><td>{moneyB(result.grossRevenue)}</td><td>{percent(result.grossRevenuePercentGdp)}</td></tr>
        <tr><td>Adult credits</td><td>−{moneyB(result.adultCreditCost)}</td><td>−{percent(result.adultCreditCost / result.gdp)}</td></tr>
        <tr><td>Child credits</td><td>−{moneyB(result.childCreditCost)}</td><td>−{percent(result.childCreditCost / result.gdp)}</td></tr>
        <tr><td>Health-insurance credits</td><td>−{moneyB(result.insuranceCreditCost)}</td><td>−{percent(result.insuranceCreditCost / result.gdp)}</td></tr>
        <tr className="subtotal"><td>Net revenue</td><td>{moneyB(result.netRevenue)}</td><td>{percent(result.netRevenuePercentGdp)}</td></tr>
        <tr><td>Original tax-replacement target</td><td>{moneyB(result.targetRevenue)}</td><td>{percent(result.targetRevenuePercentGdp)}</td></tr>
        <tr><td>Automatic refundable EITC/CTC outlay savings</td><td>−{moneyB(result.refundableTaxCreditOutlaySavings)}</td><td>−{percent(result.refundableTaxCreditOutlaySavingsPercentGdp)}</td></tr>
        <tr><td>Selected external-program savings</td><td>−{moneyB(result.federalTransferSavings)}</td><td>−{percent(result.federalTransferSavings / result.gdp)}</td></tr>
        <tr><td>Total federal savings</td><td>−{moneyB(result.totalFederalSavings)}</td><td>−{percent(result.totalFederalSavingsPercentGdp)}</td></tr>
        <tr className="subtotal"><td>Adjusted revenue requirement</td><td>{moneyB(result.adjustedTargetRevenue)}</td><td>{percent(result.adjustedTargetRevenuePercentGdp)}</td></tr>
        <tr className="total"><td>Adjusted surplus / deficit</td><td>{moneyB(result.adjustedSurplusDeficit)}</td><td>{percent(result.adjustedSurplusDeficitPercentGdp)}</td></tr>
      </tbody></table></div>
      <Audit title="Audit the rate-adjusted X-tax base"><Formula>{moneyB(result.businessTaxableBase)} business-side base + {moneyB(result.rateAdjustedWageBase)} rate-adjusted wage base {settings.wageTaxMode === 'progressive' ? `(CPS score: ${percent(result.microdataAverageWageRateShare)} of the taxable wage base)` : '(100% of the taxable wage base)'} = {moneyB(result.rateAdjustedBase)} rate-adjusted base.</Formula></Audit>
      {result.totalFederalSavings > 0 && <Audit title="Audit fiscal savings"><Formula>{moneyB(result.targetRevenue)} original tax-replacement target<br />− {moneyB(result.refundableTaxCreditOutlaySavings)} refundable EITC/CTC outlays automatically removed with individual income taxation<br />− {moneyB(result.federalTransferSavings)} selected external federal program savings<br />= {moneyB(result.adjustedTargetRevenue)} adjusted requirement.<br /><br />Only refundable excess payments are added here. Credit amounts that offset positive tax liability already reduce the individual-income-tax receipts target.<br /><br />Revenue-neutral rate: {percent(result.revenueNeutralRate, 2)} before savings → {percent(result.adjustedRevenueNeutralRate, 2)} after savings, a {(result.revenueNeutralRateReduction * 100).toFixed(2)} percentage-point reduction.</Formula></Audit>}
    </section>
    <div className="two-column">
      <section className="content-card"><h2>Why the base is below GDP</h2><p>New investment is expensed rather than taxed; exports leave the destination base; housing requires a special cash-flow adjustment; and noncompliance removes otherwise taxable consumption. Broad and compensation-specific exemptions are then applied separately.</p><p className="callout">The {moneyB(result.taxableBase)} result is after {percent(settings.noncomplianceRate)} noncompliance, {percent(settings.exemptionShare)} other broad exemptions, and the four named compensation choices.</p></section>
      <section className="content-card"><h2>Data vintage and scope</h2><p>The base uses 2025 FRED/BEA observations built on 2026-08-10. The distributional score uses the 2025 CPS ASEC ({microdata2025.source.incomeYear} income) with Census survey and replicate weights, calibrated to 2025 BEA compensation and Census population controls. FY2025 Treasury receipts provide the target, leaving the documented calendar-year/fiscal-year timing mismatch.</p><p className="callout">CPS sampling standard errors are {moneyB(microdata2025.uncertainty.earnedAdultCreditCostStandardErrorBillions)} for the default adult credit and {moneyB(microdata2025.uncertainty.progressiveEquivalentBaseStandardErrorBillions)} for the progressive rate-equivalent compensation base. They do not capture tax-unit definition, take-up, top-tail, or employer-benefit allocation error.</p><ul>{baseline.sources.map((source) => <li key={source.label}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a><span>{source.note}</span></li>)}<li><a href={microdata2025.source.url} target="_blank" rel="noreferrer">2025 CPS ASEC public-use files</a><span>Tax-unit wage distribution, adult-credit eligibility, and replicate-weight uncertainty.</span></li></ul></section>
    </div>
  </main>;
}
