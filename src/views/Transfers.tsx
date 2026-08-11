import { useMemo, useState } from 'react';
import { Audit, Formula } from '../components/Audit';
import { LineChart } from '../components/LineChart';
import { MetricCard } from '../components/MetricCard';
import { dollars, moneyB, percent } from '../components/format';
import {
  calculateFederalProgramSavings,
  calculateMacro,
  calculateMarginalResourceWithdrawalRate,
  calculateTransferAnalysis,
  cloneTransferPreset,
  transferData,
  transferPresets,
  type FilingStatus,
  type ReformSettings,
  type TransferHouseholdInput,
  type TransferProgramId,
  type TransferReplacementSettings,
} from '../model';

const kindLabels = { cash: 'Cash', near_cash: 'Near-cash', in_kind: 'In-kind' } as const;
const methodLabels = { rule_based: 'Rule-based', preset_assumption: 'Preset assumption', manual_receipt: 'Manual receipt' } as const;

export function Transfers({
  settings,
  replacements,
  setReplacements,
}: {
  settings: ReformSettings;
  replacements: TransferReplacementSettings;
  setReplacements: (value: TransferReplacementSettings) => void;
}) {
  const [presetId, setPresetId] = useState('parent-two');
  const [input, setInput] = useState<TransferHouseholdInput>(() => cloneTransferPreset(transferPresets.find((row) => row.id === 'parent-two')!));
  const [chartMax, setChartMax] = useState(100000);
  const analysis = calculateTransferAnalysis(input, settings, replacements);
  const federalSavings = calculateFederalProgramSavings(replacements);
  const macro = calculateMacro(settings, { federalTransferSavings: federalSavings });

  const choosePreset = (id: string) => {
    const selected = transferPresets.find((row) => row.id === id)!;
    setPresetId(id);
    setInput(cloneTransferPreset(selected));
  };
  const updateInput = (patch: Partial<TransferHouseholdInput>) => setInput({ ...input, ...patch });
  const updateHousehold = (patch: Partial<TransferHouseholdInput['household']>) => updateInput({ household: { ...input.household, ...patch } });
  const toggleReceipt = (id: TransferProgramId) => updateInput({ receives: { ...input.receives, [id]: !input.receives[id] } });
  const setManualBenefit = (id: TransferProgramId, value: number) => updateInput({ manualAnnualBenefits: { ...input.manualAnnualBenefits, [id]: Math.max(0, value) } });
  const toggleReplacement = (id: TransferProgramId) => setReplacements({
    replacedPrograms: { ...replacements.replacedPrograms, [id]: !replacements.replacedPrograms[id] },
  });

  const chartPoints = useMemo(() => Array.from({ length: 161 }, (_, index) => {
    const share = index / 160;
    const cashWage = share ** 2 * chartMax;
    const rowInput = { ...input, household: { ...input.household, cashWage } };
    const row = calculateTransferAnalysis(rowInput, settings, replacements);
    return {
      x: cashWage,
      resources: { a: row.currentLaw.annual, b: row.reformRetained.annual, c: row.reformAfterReplacement.annual },
      withdrawal: {
        a: calculateMarginalResourceWithdrawalRate(rowInput, settings, replacements, 'current'),
        b: calculateMarginalResourceWithdrawalRate(rowInput, settings, replacements, 'retained'),
        c: calculateMarginalResourceWithdrawalRate(rowInput, settings, replacements, 'replaced'),
      },
    };
  }), [input, settings, replacements, chartMax]);

  const relevantPrograms = analysis.programs.filter((row) => row.receives || replacements.replacedPrograms[row.program.id] || row.resourceEquivalentValue > 0);

  return <main className="page-shell transfer-page">
    <div className="view-intro"><div><span className="eyebrow">Transfer replacement · 2025/FY2025</span><h1>Household resources are not fiscal savings</h1></div><p>Compare the household value of selected benefits with the federal outlays that repeal would remove. Receipt is explicit: income eligibility alone never awards a rationed or assumed benefit.</p></div>

    <section className="transfer-inputs">
      <label className="wide"><span>Representative household</span><select value={presetId} onChange={(event) => choosePreset(event.target.value)}>{transferPresets.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      <label><span>Filing status</span><select value={input.household.filingStatus} onChange={(event) => updateHousehold({ filingStatus: event.target.value as FilingStatus, secondaryCashWage: event.target.value === 'single' ? 0 : input.household.secondaryCashWage })}><option value="single">Single</option><option value="married">Married filing jointly</option></select></label>
      <NumberInput label="Primary wage" value={input.household.cashWage} step={1000} onChange={(cashWage) => updateHousehold({ cashWage })} money />
      {input.household.filingStatus === 'married' && <NumberInput label="Spouse wage" value={input.household.secondaryCashWage ?? 0} step={1000} onChange={(secondaryCashWage) => updateHousehold({ secondaryCashWage })} money />}
      <NumberInput label="Children" value={input.household.children} min={0} max={4} onChange={(children) => updateHousehold({ children: Math.max(0, Math.min(4, Math.trunc(children))) })} />
      <NumberInput label="Preschool children" value={input.preschoolChildren} min={0} max={input.household.children} onChange={(preschoolChildren) => updateInput({ preschoolChildren: Math.max(0, Math.min(input.household.children, Math.trunc(preschoolChildren))) })} />
      <NumberInput label="School-age children" value={input.schoolAgeChildren} min={0} max={input.household.children} onChange={(schoolAgeChildren) => updateInput({ schoolAgeChildren: Math.max(0, Math.min(input.household.children, Math.trunc(schoolAgeChildren))) })} />
      <NumberInput label="Monthly shelter cost" value={input.monthlyShelterCost} step={50} onChange={(monthlyShelterCost) => updateInput({ monthlyShelterCost })} money />
      <NumberInput label="Monthly dependent care" value={input.monthlyDependentCareExpense} step={50} onChange={(monthlyDependentCareExpense) => updateInput({ monthlyDependentCareExpense })} money />
      <label><span>In-kind resource factor</span><div className="inline-range"><input type="range" min="0" max="1" step="0.05" value={input.inKindValuationFactor} onChange={(event) => updateInput({ inKindValuationFactor: Number(event.target.value) })} /><b>{percent(input.inKindValuationFactor)}</b></div></label>
    </section>

    <div className="metric-grid transfer-metrics">
      <MetricCard label="Household held harmless" value={analysis.heldHarmless ? 'Yes' : 'No'} note={`${dollars(analysis.reformAfterReplacement.changeFromCurrent)} versus current law`} tone={analysis.heldHarmless ? 'good' : 'bad'} />
      <MetricCard label="Household replacement ratio" value={analysis.householdReplacementRatio == null ? '—' : `${analysis.householdReplacementRatio.toFixed(2)}×`} note="Tax-reform resource gain ÷ eliminated benefit value"><Audit><Formula>{dollars(analysis.tax.dollarChange)} reform tax/credit gain ÷ {dollars(analysis.eliminatedHouseholdBenefits)} eliminated household resources. This is not a national budget efficiency measure.</Formula></Audit></MetricCard>
      <MetricCard label="Federal program savings" value={moneyB(federalSavings)} note={`${percent(federalSavings / macro.gdp)} of GDP`}><Audit><Formula>Only checked external programs are summed. State-financed amounts are excluded; EITC and CTC are already inside the tax baseline.</Formula></Audit></MetricCard>
      <MetricCard label="Adjusted revenue requirement" value={moneyB(macro.adjustedTargetRevenue)} note={`${percent(macro.adjustedTargetRevenuePercentGdp)} of GDP`}><Audit><Formula>{moneyB(macro.targetRevenue)} tax-replacement target − {moneyB(federalSavings)} federal program savings = {moneyB(macro.adjustedTargetRevenue)}</Formula></Audit></MetricCard>
      <MetricCard label="Revenue-neutral rate after savings" value={percent(macro.adjustedRevenueNeutralRate, 2)} note={`Before savings ${percent(macro.revenueNeutralRate, 2)}`} tone="accent"><Audit><Formula>({moneyB(macro.adjustedTargetRevenue)} adjusted target + {moneyB(macro.adultCreditCost + macro.childCreditCost)} reform credits) ÷ {moneyB(macro.rateAdjustedBase)} = {percent(macro.adjustedRevenueNeutralRate, 2)}</Formula></Audit></MetricCard>
      <MetricCard label="Rate reduction" value={`${(macro.revenueNeutralRateReduction * 100).toFixed(2)} pp`} note={`Adjusted balance at selected rate ${moneyB(macro.adjustedSurplusDeficit)}`} tone={macro.adjustedSurplusDeficit >= 0 ? 'good' : 'bad'} />
    </div>

    <section className="table-card compact scenario-table">
      <div className="section-heading"><div><h2>Resource-equivalent consumption capacity</h2><p>Disposable household resources plus cash, near-cash, and the selected valuation share of in-kind transfers.</p></div><strong>2025 FPL {dollars(analysis.povertyGuideline)}</strong></div>
      <div className="responsive-table"><table><thead><tr><th>Scenario</th><th>Annual</th><th>Monthly</th><th>% FPL</th><th>Change vs current</th><th>% change</th></tr></thead><tbody>
        <ScenarioRow label="A. Current law + current transfers" scenario={analysis.currentLaw} />
        <ScenarioRow label="B. Reform + transfers retained" scenario={analysis.reformRetained} />
        <ScenarioRow label="C. Reform + selected replacements" scenario={analysis.reformAfterReplacement} total />
      </tbody></table></div>
      <Audit title="Audit the resource identity"><Formula>Current = {dollars(analysis.tax.currentDisposableResources)} current disposable resources + {dollars(analysis.totalCurrentExternalTransfers)} external transfer value = {dollars(analysis.currentLaw.annual)}.<br /><br />Reform retained = {dollars(analysis.tax.reformDisposableResources)} reform disposable resources + {dollars(analysis.totalCurrentExternalTransfers)} transfers = {dollars(analysis.reformRetained.annual)}.<br /><br />Reform after replacement = {dollars(analysis.reformRetained.annual)} − {dollars(analysis.eliminatedHouseholdBenefits)} selected household benefit value = {dollars(analysis.reformAfterReplacement.annual)}. No amount is divided by 1 + the tax rate.</Formula></Audit>
    </section>

    <section className="table-card compact program-table">
      <div className="section-heading"><div><span className="eyebrow">External programs only</span><h2>Receipt and replacement controls</h2><p>“Replace” removes the program without changing the adult or child credit schedule selected in Reform Designer.</p></div><strong>{analysis.programs.filter((row) => replacements.replacedPrograms[row.program.id]).length} selected</strong></div>
      <div className="responsive-table"><table><thead><tr><th>Program</th><th>Type / model</th><th>Federal fiscal amount</th><th>Current receipt</th><th>Household annual value</th><th>Replace with reform credits</th></tr></thead><tbody>{analysis.programs.map((row) => <tr key={row.program.id}>
        <td><strong>{row.program.shortName}</strong><Audit title="Program audit"><Formula>{row.program.householdMethod}<br /><br />Fiscal: {moneyB(row.program.federalFiscalAmountBillions)} — {row.program.federalFiscalMeasure}. State financing included: {moneyB(row.program.stateFinancingIncludedBillions)}.<br /><br />Receipt: {row.program.receiptAccess}<br /><br />Source: {row.program.agency}, {row.program.policyYear} / {row.program.fiscalYear}.<br /><a href={row.program.sourceUrl} target="_blank" rel="noreferrer">Fiscal source</a> · <a href={row.program.ruleSourceUrl} target="_blank" rel="noreferrer">Rule source</a><br /><br />Limits: {row.program.limitations.join(' ')}</Formula></Audit></td>
        <td><span className={`program-tag ${row.program.kind}`}>{kindLabels[row.program.kind]}</span><small>{methodLabels[row.program.method]}</small></td>
        <td>{moneyB(row.program.federalFiscalAmountBillions)}<small>{row.program.federalFiscalMeasure}</small></td>
        <td><label className="check-control"><input type="checkbox" checked={row.receives} onChange={() => toggleReceipt(row.program.id)} /><span>{row.receives ? 'Receives' : 'No receipt'}</span></label>{row.eligible != null && <small>{row.eligible ? 'Rule-eligible' : 'Not rule-eligible'}</small>}</td>
        <td>{row.program.method === 'manual_receipt' ? <div className="manual-benefit"><span>$</span><input aria-label={`${row.program.shortName} annual benefit`} type="number" min="0" step="100" value={input.manualAnnualBenefits[row.program.id] ?? 0} onChange={(event) => setManualBenefit(row.program.id, Number(event.target.value))} /></div> : dollars(row.resourceEquivalentValue)}<small>{row.program.method === 'manual_receipt' ? `${dollars(row.annualGovernmentBenefit)} government amount → ${dollars(row.resourceEquivalentValue)} resources` : row.calculationStatus.replaceAll('_', ' ')}{row.program.kind === 'in_kind' ? ` · ${percent(row.valuationFactor)} resource factor` : ''}</small></td>
        <td><label className="check-control replacement"><input type="checkbox" checked={replacements.replacedPrograms[row.program.id]} onChange={() => toggleReplacement(row.program.id)} /><span>{replacements.replacedPrograms[row.program.id] ? 'Selected' : 'Retain'}</span></label></td>
      </tr>)}</tbody></table></div>
      <p className="table-note">FY2025 actual outlays are used where the account exposes them. School meals and Summer EBT use FY2025 actual obligations to isolate those program components. These are federal budget amounts, not household values.</p>
    </section>

    <section className="table-card compact decomposition-table">
      <h2>Selected household decomposition</h2>
      <div className="responsive-table"><table><thead><tr><th>Measure</th><th>Current law</th><th>Reform + transfers</th><th>Reform + selected replacements</th></tr></thead><tbody>
        <tr><td>Employer/economic compensation</td><td>{dollars(analysis.tax.employerCompensation)}</td><td>{dollars(analysis.tax.employerCompensation)}</td><td>{dollars(analysis.tax.employerCompensation)}</td></tr>
        <tr><td>Federal taxes after tax credits</td><td>−{dollars(analysis.tax.current.totalFederalTax)}</td><td>−{dollars(analysis.tax.reformTaxAfterCredits)}</td><td>−{dollars(analysis.tax.reformTaxAfterCredits)}</td></tr>
        <tr><td>Current EITC / CTC + ACTC (memorandum)</td><td>{dollars(analysis.tax.current.eitc)} / {dollars(analysis.tax.current.nonrefundableCtc + analysis.tax.current.refundableCtc)}</td><td>{settings.replacedTaxes.individualIncome ? 'replaced inside tax engine' : 'retained inside tax engine'}</td><td>{settings.replacedTaxes.individualIncome ? 'replaced inside tax engine' : 'retained inside tax engine'}</td></tr>
        <tr><td>Reform adult credit (memorandum)</td><td>—</td><td>{dollars(analysis.tax.adultCredit)}</td><td>{dollars(analysis.tax.adultCredit)}</td></tr>
        <tr><td>Reform child credit (memorandum)</td><td>—</td><td>{dollars(analysis.tax.childCredit)}</td><td>{dollars(analysis.tax.childCredit)}</td></tr>
        {relevantPrograms.map((row) => <tr key={row.program.id}><td>{row.program.shortName}</td><td>{dollars(row.resourceEquivalentValue)}</td><td>{dollars(row.resourceEquivalentValue)}</td><td>{replacements.replacedPrograms[row.program.id] ? '—' : dollars(row.resourceEquivalentValue)}</td></tr>)}
        <tr className="subtotal"><td>Resource-equivalent consumption capacity</td><td>{dollars(analysis.currentLaw.annual)}</td><td>{dollars(analysis.reformRetained.annual)}</td><td>{dollars(analysis.reformAfterReplacement.annual)}</td></tr>
        <tr><td>% FPL</td><td>{percent(analysis.currentLaw.fplShare)}</td><td>{percent(analysis.reformRetained.fplShare)}</td><td>{percent(analysis.reformAfterReplacement.fplShare)}</td></tr>
        <tr className="total"><td>Change vs current law</td><td>—</td><td>{dollars(analysis.reformRetained.changeFromCurrent)}</td><td>{dollars(analysis.reformAfterReplacement.changeFromCurrent)}</td></tr>
      </tbody></table></div>
      <Audit><Formula>EITC and CTC/ACTC are memorandum rows only: current disposable resources already include them through net individual income tax. Reform adult/child credits likewise already enter reform tax after credits. Adding either row again would double-count them.</Formula></Audit>
    </section>

    <section className="chart-toolbar"><div><h2>Trace resources across low and moderate earnings</h2><p>Spouse earnings, program receipt choices, manual benefits, and household characteristics remain fixed.</p></div><label><span>Primary wage range</span><select value={chartMax} onChange={(event) => setChartMax(Number(event.target.value))}><option value={75000}>$75,000</option><option value={100000}>$100,000</option><option value={150000}>$150,000</option><option value={250000}>$250,000</option></select></label></section>
    <section className="chart-stack">
      <LineChart title="Resource-equivalent consumption capacity" points={chartPoints.map((point) => ({ x: point.x, ...point.resources }))} aLabel="Current + transfers" bLabel="Reform + retained" cLabel="Reform + replacements" xScale="focus" />
      <LineChart title="Effective marginal resource withdrawal rate · centered $1,000 window" points={chartPoints.map((point) => ({ x: point.x, ...point.withdrawal }))} aLabel="Current + transfers" bLabel="Reform + retained" cLabel="Reform + replacements" percentAxis xScale="focus" />
    </section>
    <Audit title="Define the marginal withdrawal measure"><Formula>Effective marginal resource withdrawal rate = 1 − (change in resource-equivalent consumption capacity ÷ change in employer compensation), measured over a centered $1,000 primary-wage window. SNAP, school-meal, and Summer EBT rule transitions enter when receipt is selected. Fixed manual WIC, TANF, LIHEAP, and housing amounts have no modeled phaseout and therefore create no artificial marginal wedge.</Formula></Audit>

    <section className="two-column transfer-notes"><div className="content-card"><h2>Scope guardrails</h2><p>Excluded: Medicaid, Medicare, ACA subsidies, employer health exclusions, Social Security retirement, and SSDI. Health coverage cannot credibly be collapsed into ordinary consumption dollars; retirement/disability programs require age and disability circumstances absent from this working-age wage model. SSI is deferred for the same reason.</p></div><div className="content-card"><h2>Timing and precision</h2><p>Household rules mix calendar 2025, FY2025, and school year 2024-25 exactly as labeled. The module is deterministic but not a microsimulation: it does not estimate take-up, geography, assets, immigration status, state rules, disability, or local housing availability.</p><p className="callout">{transferData.povertyGuidelines.note}</p></div></section>
  </main>;
}

function NumberInput({ label, value, onChange, min = 0, max, step = 1, money = false }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; money?: boolean }) {
  return <label><span>{label}</span><div className="number-inline">{money && <b>$</b>}<input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value)))} /></div></label>;
}

function ScenarioRow({ label, scenario, total = false }: { label: string; scenario: ReturnType<typeof calculateTransferAnalysis>['currentLaw']; total?: boolean }) {
  return <tr className={total ? 'total' : ''}><td>{label}</td><td>{dollars(scenario.annual)}</td><td>{dollars(scenario.monthly)}</td><td>{percent(scenario.fplShare)}</td><td>{dollars(scenario.changeFromCurrent)}</td><td>{scenario.percentChangeFromCurrent == null ? '—' : percent(scenario.percentChangeFromCurrent)}</td></tr>;
}
