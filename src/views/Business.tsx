import { useState } from 'react';
import { Audit, Formula } from '../components/Audit';
import { NumberField } from '../components/Controls';
import { millions, percent } from '../components/format';
import { businessPresets, calculateBusiness, type BusinessInput, type ReformSettings } from '../model';

export function Business({ settings }: { settings: ReformSettings }) {
  const [input, setInput] = useState<BusinessInput>({ ...businessPresets[2] });
  const result = calculateBusiness(input, settings.rate);
  const update = (patch: Partial<BusinessInput>) => setInput({ ...input, ...patch });
  return <main className="page-shell">
    <div className="view-intro"><div><span className="eyebrow">Business mechanics</span><h1>Follow one firm’s cash flow</h1></div><p>The canonical DBCFT taxes domestic cash flow, deducts wages and new investment immediately, denies deductions for imports, and excludes exports. Values below are millions of dollars.</p></div>
    <div className="business-layout">
      <aside className="control-panel business-controls"><label className="number-field"><span>Example</span><select value={input.name} onChange={(event) => setInput({ ...businessPresets.find((preset) => preset.name === event.target.value)! })}>{businessPresets.map((preset) => <option key={preset.name}>{preset.name}</option>)}</select></label><NumberField label="Total sales" value={input.totalSales} step={5} suffix="$M" onChange={(totalSales) => update({ totalSales, name: 'Custom example' })} /><NumberField label="Domestic inputs" value={input.domesticInputs} step={5} suffix="$M" onChange={(domesticInputs) => update({ domesticInputs, name: 'Custom example' })} /><NumberField label="Wages" value={input.wages} step={5} suffix="$M" onChange={(wages) => update({ wages, name: 'Custom example' })} /><NumberField label="New investment" value={input.newInvestment} step={5} suffix="$M" onChange={(newInvestment) => update({ newInvestment, name: 'Custom example' })} /><NumberField label="Imports" value={input.imports} step={5} suffix="$M" onChange={(imports) => update({ imports, name: 'Custom example' })} /><NumberField label="Exports included in sales" value={input.exports} step={5} suffix="$M" onChange={(exports) => update({ exports, name: 'Custom example' })} /></aside>
      <div className="business-results">
        <section className="business-equation">
          <div><span>Operating cash flow</span><strong>{millions(result.operatingCashFlow)}</strong><small>Sales − all inputs − wages − investment</small></div><i>+</i><div><span>Import add-back</span><strong>{millions(result.borderImportAdjustment)}</strong><small>Imported inputs are not deductible</small></div><i>−</i><div><span>Export exclusion</span><strong>{millions(Math.abs(result.borderExportAdjustment))}</strong><small>Foreign consumption is outside the base</small></div><i>=</i><div className="accent"><span>Business tax base</span><strong>{millions(result.businessTaxBase)}</strong><small>Destination-based cash flow</small></div>
        </section>
        <div className="business-headlines"><section><span>Business tax</span><strong>{millions(result.businessTax)}</strong><small>{percent(settings.rate)} × business base</small></section><section><span>Wage-side tax before credits</span><strong>{millions(result.wageSideTaxBeforeCredits)}</strong><small>{percent(settings.rate)} × wages</small></section><section><span>Combined before household credits</span><strong>{millions(result.combinedTaxBeforeHouseholdCredits)}</strong><small>Business + wage side</small></section></div>
        <Audit title="Audit this business"><Formula>{millions(input.totalSales)} sales<br />− {millions(input.domesticInputs)} domestic inputs<br />− {millions(input.imports)} imported inputs (cash flow only)<br />− {millions(input.wages)} wages<br />− {millions(input.newInvestment)} immediate expensing<br />+ {millions(input.imports)} import add-back<br />− {millions(input.exports)} export exclusion<br />= {millions(result.businessTaxBase)} business base<br /><br />× {percent(settings.rate)} = {millions(result.businessTax)} business liability</Formula></Audit>
        <div className="two-column"><section className="content-card"><h2>Full expensing</h2><p>New investment is deducted immediately, so purchasing a machine does not itself represent current consumption. The future cash flow it helps produce is taxed when it supports domestic consumption.</p></section><section className="content-card"><h2>Border adjustment</h2><p>Imported inputs receive no deduction; export receipts are excluded. The accounting follows destination, not the firm’s headquarters or the production site.</p></section></div>
        {result.businessTaxBase < 0 && <p className="callout">This preset produces a tax loss. The neutral textbook model requires the loss to be refunded or carried forward with interest; Iteration 1 displays it as a negative liability and flags implementation details for later work.</p>}
      </div>
    </div>
  </main>;
}
