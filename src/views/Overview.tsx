import { Audit, Formula } from '../components/Audit';
import { RangeField, SelectField } from '../components/Controls';
import { MetricCard } from '../components/MetricCard';
import { moneyB, percent } from '../components/format';
import { calculateMacro, type AdultCreditMode, type MacroResult, type ReformSettings, type ReplacedTax, type WageTaxMode } from '../model';

const taxLabels: Record<ReplacedTax, string> = {
  individualIncome: 'Individual income tax',
  payroll: 'Payroll taxes',
  corporateIncome: 'Corporate income tax',
  customs: 'Customs duties',
};

export function Overview({ settings, setSettings }: { settings: ReformSettings; setSettings: (value: ReformSettings) => void }) {
  const result = calculateMacro(settings);
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
          <RangeField label="Middle rate / business rate" value={settings.progressiveMiddleRateShare} min={0} max={1} step={0.025} display={percent(settings.progressiveMiddleRateShare)} onChange={(progressiveMiddleRateShare) => update({ progressiveMiddleRateShare })} />
          <RangeField label="National average wage rate / business rate" value={settings.progressiveAverageWageRateShare} min={0} max={1} step={0.025} display={percent(settings.progressiveAverageWageRateShare)} onChange={(progressiveAverageWageRateShare) => update({ progressiveAverageWageRateShare })} hint="Explicit aggregate calibration; no household microdata are implied." />
        </div>}
        <SelectField label="Adult credit structure" value={settings.adultCreditMode} options={[{ value: 'earned', label: 'EITC-like phase-in/out' }, { value: 'universal', label: 'Universal flat credit' }]} onChange={(adultCreditMode) => update({ adultCreditMode: adultCreditMode as AdultCreditMode })} />
        <RangeField label="Maximum adult credit" value={settings.adultCredit} min={0} max={12000} step={100} display={`$${settings.adultCredit.toLocaleString()}`} onChange={(adultCredit) => update({ adultCredit })} hint="Maximum per adult; fully refundable." />
        {settings.adultCreditMode === 'earned' && <div className="control-group">
          <span>Adult credit calibration</span>
          <RangeField label="Phase-in rate" value={settings.adultCreditPhaseInRate} min={0} max={1} step={0.01} display={percent(settings.adultCreditPhaseInRate)} onChange={(adultCreditPhaseInRate) => update({ adultCreditPhaseInRate })} />
          <RangeField label="Phase-out starts / adult" value={settings.adultCreditPhaseOutStartPerAdult} min={0} max={200000} step={2500} display={`$${settings.adultCreditPhaseOutStartPerAdult.toLocaleString()}`} onChange={(adultCreditPhaseOutStartPerAdult) => update({ adultCreditPhaseOutStartPerAdult })} />
          <RangeField label="Phase-out rate" value={settings.adultCreditPhaseOutRate} min={0} max={0.50} step={0.005} display={percent(settings.adultCreditPhaseOutRate)} onChange={(adultCreditPhaseOutRate) => update({ adultCreditPhaseOutRate })} />
          <RangeField label="National average credit / maximum" value={settings.adultCreditBudgetShare} min={0} max={1} step={0.01} display={percent(settings.adultCreditBudgetShare)} onChange={(adultCreditBudgetShare) => update({ adultCreditBudgetShare })} hint="Budget calibration needed until household microdata are added." />
        </div>}
        <RangeField label="Child credit" value={settings.childCredit} min={0} max={12000} step={100} display={`$${settings.childCredit.toLocaleString()}`} onChange={(childCredit) => update({ childCredit })} hint="Fully refundable; one per person under 18." />
        <RangeField label="Noncompliance" value={settings.noncomplianceRate} min={0} max={0.30} step={0.005} display={percent(settings.noncomplianceRate)} onChange={(noncomplianceRate) => update({ noncomplianceRate })} />
        <RangeField label="Policy exemptions" value={settings.exemptionShare} min={0} max={0.30} step={0.005} display={percent(settings.exemptionShare)} onChange={(exemptionShare) => update({ exemptionShare })} hint="Share of the compliant base removed by policy." />
        <fieldset className="tax-checks"><legend>Existing taxes replaced</legend>{(Object.keys(taxLabels) as ReplacedTax[]).map((key) => <label key={key}><input type="checkbox" checked={settings.replacedTaxes[key]} onChange={() => toggleTax(key)} /><span>{taxLabels[key]}</span></label>)}</fieldset>
      </aside>

      <main className="results-panel">
        <div className="view-intro"><div><span className="eyebrow">2025 provisional static baseline</span><h1>A consumption tax you can audit</h1></div><p>The model separates the economic base, compliance, policy carve-outs, credits, and the receipts being replaced. Every number below is a direct identity.</p></div>
        <div className="metric-grid">
          <MetricCard label="Final taxable base" value={moneyB(result.taxableBase)} note={`${percent(result.basePercentGdp)} of GDP`} tone="accent"><MacroBaseAudit result={result} /></MetricCard>
          <MetricCard label="Gross collections" value={moneyB(result.grossRevenue)} note={`${percent(result.grossRevenuePercentGdp)} of GDP`}><Audit><Formula>{moneyB(result.rateAdjustedBase)} rate-adjusted base × {percent(settings.rate)} = {moneyB(result.grossRevenue)}</Formula></Audit></MetricCard>
          <MetricCard label="Refundable credits" value={moneyB(result.adultCreditCost + result.childCreditCost)} note={`${percent(result.creditCostPercentGdp)} of GDP`}><Audit><Formula>{moneyB(result.adultCreditCost)} adult + {moneyB(result.childCreditCost)} child</Formula></Audit></MetricCard>
          <MetricCard label="Net federal revenue" value={moneyB(result.netRevenue)} note={`${percent(result.netRevenuePercentGdp)} of GDP · target ${percent(result.targetRevenuePercentGdp)}`} tone={result.surplusDeficit >= 0 ? 'good' : 'bad'}><RevenueAudit result={result} /></MetricCard>
          <MetricCard label={result.surplusDeficit >= 0 ? 'Static surplus' : 'Static deficit'} value={moneyB(result.surplusDeficit)} note={`${percent(result.surplusDeficitPercentGdp)} of GDP`} tone={result.surplusDeficit >= 0 ? 'good' : 'bad'} />
          <MetricCard label="Revenue-neutral rate" value={percent(result.revenueNeutralRate, 2)} note="Solved algebraically" tone="accent"><Audit><Formula>({moneyB(result.targetRevenue)} + {moneyB(result.adultCreditCost + result.childCreditCost)}) ÷ {moneyB(result.rateAdjustedBase)} rate-adjusted base = {percent(result.revenueNeutralRate, 2)}</Formula></Audit></MetricCard>
        </div>
        <Flow result={result} />
        <section className="concept-note"><span className="eyebrow">Canonical implementation</span><h2>{settings.wageTaxMode === 'flat' ? 'Flat-rate' : 'Progressive'} X tax / DBCFT presentation</h2><p>Businesses pay the headline rate on destination-based cash flow after wages and new investment. Households pay either that same flat rate or the selected progressive wage schedule, then receive refundable adult and child credits. This is economically related to a broad VAT, but the statutory collection and household presentation are not treated as interchangeable.</p></section>
      </main>
    </div>
  );
}

function MacroBaseAudit({ result }: { result: MacroResult }) {
  return <Audit><Formula>{moneyB(result.theoreticalBase)} theoretical<br />− {moneyB(result.noncomplianceLoss)} noncompliance<br />− {moneyB(result.exemptionLoss)} exemptions<br />= {moneyB(result.taxableBase)} ({percent(result.basePercentGdp)} of GDP)</Formula></Audit>;
}

function RevenueAudit({ result }: { result: MacroResult }) {
  return <Audit><Formula>{moneyB(result.grossRevenue)} gross<br />− {moneyB(result.adultCreditCost)} adult credits<br />− {moneyB(result.childCreditCost)} child credits<br />= {moneyB(result.netRevenue)}</Formula></Audit>;
}

function Flow({ result }: { result: MacroResult }) {
  const items = [
    ['GDP', result.gdp], ['Broad consumption', result.theoreticalBase], ['After compliance', result.baseAfterCompliance],
    ['After exemptions', result.taxableBase], ['Gross tax', result.grossRevenue], ['Net of credits', result.netRevenue],
  ] as const;
  return <section className="flow-card"><div className="eyebrow">Accounting flow</div><div className="flow-row">{items.map(([label, value], index) => <div className="flow-item" key={label}><span>{label}</span><strong>{moneyB(value)}</strong>{index < items.length - 1 && <i>→</i>}</div>)}</div></section>;
}
