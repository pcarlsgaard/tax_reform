import { Audit, Formula } from '../components/Audit';
import { moneyB, percent } from '../components/format';
import { baseline, calculateMacro, type ReformSettings } from '../model';

export function National({ settings }: { settings: ReformSettings }) {
  const result = calculateMacro(settings);
  const components = [
    ['Compensation of employees', baseline.components.compensation, 'COE'],
    ['Net capital income after investment', baseline.components.netCapitalIncomeAfterInvestment, baseline.componentFormulas.netCapitalIncomeAfterInvestment],
    ['Net imports', baseline.components.netImports, baseline.componentFormulas.netImports],
    ['Housing adjustment', baseline.components.housingAdjustment, baseline.componentFormulas.housingAdjustment],
  ] as const;
  return <main className="page-shell">
    <div className="view-intro"><div><span className="eyebrow">National revenue</span><h1>From GDP to the taxable base</h1></div><p>The snapshot preserves the repository’s NIPA cash-flow method while fixing its labels: compliance and exemptions are now distinct stages.</p></div>
    <section className="table-card">
      <div className="section-heading"><div><h2>2025 provisional NIPA construction</h2><p>Billions of dollars; calendar-year annual averages or annual observations.</p></div><strong>{percent(result.taxableBase / result.gdp)} of GDP taxable</strong></div>
      <div className="responsive-table"><table><thead><tr><th>Component</th><th>Formula / series</th><th>Value</th><th>% GDP</th></tr></thead><tbody>{components.map(([label, value, formula]) => <tr key={label}><td>{label}</td><td><code>{formula}</code></td><td>{moneyB(value)}</td><td>{percent(value / result.gdp)}</td></tr>)}<tr className="subtotal"><td>Theoretical broad base</td><td>Sum of four rows</td><td>{moneyB(result.theoreticalBase)}</td><td>{percent(result.theoreticalBase / result.gdp)}</td></tr><tr><td>Noncompliance loss</td><td>− theoretical base × {percent(settings.noncomplianceRate)}</td><td>−{moneyB(result.noncomplianceLoss)}</td><td>−{percent(result.noncomplianceLoss / result.gdp)}</td></tr><tr><td>Base after compliance</td><td>Theoretical base − noncompliance</td><td>{moneyB(result.baseAfterCompliance)}</td><td>{percent(result.baseAfterCompliance / result.gdp)}</td></tr><tr><td>Policy exemptions</td><td>− compliant base × {percent(settings.exemptionShare)}</td><td>−{moneyB(result.exemptionLoss)}</td><td>−{percent(result.exemptionLoss / result.gdp)}</td></tr><tr className="total"><td>Final taxable base</td><td>Compliant base − exemptions</td><td>{moneyB(result.taxableBase)}</td><td>{percent(result.taxableBase / result.gdp)}</td></tr></tbody></table></div>
      <Audit title="Audit the NIPA identities"><Formula>Net capital = corporate profits + proprietors’ income + net interest + capital consumption + production taxes − gross private domestic investment.<br /><br />Net imports = imports − exports.<br /><br />Housing adjustment = household investment − housing-sector value added.</Formula></Audit>
    </section>
    <section className="table-card compact">
      <div className="section-heading"><div><h2>Revenue as a share of GDP</h2><p>The same accounting identity in dollars and GDP percentage points.</p></div><strong>GDP {moneyB(result.gdp)}</strong></div>
      <div className="responsive-table"><table><thead><tr><th>Revenue item</th><th>Value</th><th>% GDP</th></tr></thead><tbody>
        <tr><td>Gross collections</td><td>{moneyB(result.grossRevenue)}</td><td>{percent(result.grossRevenuePercentGdp)}</td></tr>
        <tr><td>Adult credits</td><td>−{moneyB(result.adultCreditCost)}</td><td>−{percent(result.adultCreditCost / result.gdp)}</td></tr>
        <tr><td>Child credits</td><td>−{moneyB(result.childCreditCost)}</td><td>−{percent(result.childCreditCost / result.gdp)}</td></tr>
        <tr className="subtotal"><td>Net revenue</td><td>{moneyB(result.netRevenue)}</td><td>{percent(result.netRevenuePercentGdp)}</td></tr>
        <tr><td>Selected replacement target</td><td>{moneyB(result.targetRevenue)}</td><td>{percent(result.targetRevenuePercentGdp)}</td></tr>
        <tr className="total"><td>Surplus / deficit</td><td>{moneyB(result.surplusDeficit)}</td><td>{percent(result.surplusDeficitPercentGdp)}</td></tr>
      </tbody></table></div>
      <Audit title="Audit the rate-adjusted X-tax base"><Formula>{moneyB(result.businessTaxableBase)} business-side base + {moneyB(result.wageTaxableBase)} wage base {settings.wageTaxMode === 'progressive' ? `× ${percent(settings.progressiveAverageWageRateShare)} calibrated average-rate factor` : '× 100% flat-rate factor'} = {moneyB(result.rateAdjustedBase)} rate-adjusted base.</Formula></Audit>
    </section>
    <div className="two-column">
      <section className="content-card"><h2>Why the base is below GDP</h2><p>New investment is expensed rather than taxed; exports leave the destination base; housing requires a special cash-flow adjustment; and noncompliance removes otherwise taxable consumption. Policy exemptions are then applied separately.</p><p className="callout">The {moneyB(result.taxableBase)} default is not “before exemptions.” It is after {percent(settings.noncomplianceRate)} noncompliance and after the currently selected {percent(settings.exemptionShare)} policy reduction.</p></section>
      <section className="content-card"><h2>Data vintage and scope</h2><p>The base uses 2025 FRED/BEA observations built on 2026-08-10. Eleven of twelve inputs are observed for 2025; housing-sector value added is provisional because its annual series still ends in 2024. FY2025 Treasury receipts provide the target, leaving the documented calendar-year/fiscal-year timing mismatch.</p><p className="callout">Provisional housing value added: {baseline.estimates.housingValueAdded.formula}; 2024 value scaled by nominal GDP growth. Rebuild without the explicit provisional flag fails closed until BEA publishes the 2025 observation.</p><ul>{baseline.sources.map((source) => <li key={source.label}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a><span>{source.note}</span></li>)}</ul></section>
    </div>
  </main>;
}
