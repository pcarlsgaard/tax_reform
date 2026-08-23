import type { HealthPolicySettings, MacroResult, ReformSettings, ReplacedTax } from '../model';
import { moneyB, percent } from './format';

const taxLabels: Record<ReplacedTax, string> = {
  individualIncome: 'individual income',
  payroll: 'payroll',
  corporateIncome: 'corporate income',
  customs: 'customs',
};

const billions = (value: number) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(1)}B`;

export function PolicyDock({
  settings,
  healthPolicy,
  result,
  expanded,
  setExpanded,
}: {
  settings: ReformSettings;
  healthPolicy: HealthPolicySettings;
  result: MacroResult;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const structure = settings.wageTaxMode === 'flat'
    ? `${percent(settings.rate)} flat X tax`
    : `${percent(settings.rate)} top / ${percent(Math.min(settings.rate, settings.progressiveMiddleRate))} middle X tax`;
  const replaced = (Object.keys(taxLabels) as ReplacedTax[])
    .filter((key) => settings.replacedTaxes[key])
    .map((key) => taxLabels[key])
    .join(', ');
  const deficitReduction = result.deficitReduction;

  return <div className="policy-dock-shell">
    <section className={`policy-dock ${expanded ? 'expanded' : 'collapsed'}`} aria-label="Current reform policy and revenue">
      <button className="policy-dock-summary" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className="policy-dock-title"><small>Current policy</small><strong>{structure}</strong><em>{moneyB(result.insuranceCreditCost)} health credits</em></span>
        <span className="policy-dock-revenue"><small>Net federal revenue</small><strong>{moneyB(result.netRevenue)}</strong><em>{percent(result.netRevenuePercentGdp)} of GDP</em></span>
        <span className="policy-dock-toggle">{expanded ? 'Hide details' : 'Show details'} <i>{expanded ? '−' : '+'}</i></span>
      </button>
      {expanded && <div className="policy-dock-details">
        <div><span>Wage schedule</span><strong>{structure}</strong><small>{settings.wageTaxMode === 'progressive' ? `$${settings.progressiveZeroBracketPerAdult.toLocaleString()} zero ceiling · $${settings.progressiveTopBracketPerAdult.toLocaleString()} top threshold per adult` : 'Wages and business cash flow use the same rate'}</small></div>
        <div><span>Cash credits</span><strong>${settings.adultCredit.toLocaleString()} adult · ${settings.childCredit.toLocaleString()} child</strong><small>{settings.adultCreditMode === 'earned' ? `${percent(settings.adultCreditPhaseInRate)} phase-in · ${percent(settings.adultCreditPhaseOutRate)} phaseout` : 'Universal adult credit'} · {percent(settings.adultCreditTakeUpRate)} take-up</small></div>
        <div><span>Insurance credits</span><strong>${healthPolicy.adultHealthCredit.toLocaleString()} adult · ${healthPolicy.childHealthCredit.toLocaleString()} child</strong><small>{percent(healthPolicy.uninsuredTakeUpRate)} uninsured take-up · {billions(result.insuranceCreditCost)} total cost</small></div>
        <div><span>Compensation exclusions</span><strong>{percent(settings.employerHealthInsuranceExemptionShare)} ESI · {percent(settings.employerPensionOtherInsuranceExemptionShare)} pension/other</strong><small>{percent(settings.cashWageExemptionShare)} cash wages · {percent(settings.employerSocialInsuranceExemptionShare)} employer social insurance · {percent(settings.exemptionShare)} broad</small></div>
        <div><span>Taxes replaced</span><strong>{replaced || 'None'}</strong><small>{billions(result.totalFederalSavings)} automatic and selected federal savings</small></div>
        <div className={deficitReduction >= 0 ? 'good' : 'bad'}><span>Static deficit {deficitReduction >= 0 ? 'reduction' : 'increase'}</span><strong>{deficitReduction >= 0 ? '+' : '−'}{billions(Math.abs(deficitReduction))}</strong><small>Net revenue versus {moneyB(result.adjustedTargetRevenue)} current-law replacement baseline · {percent(result.deficitReductionPercentGdp)} of GDP</small></div>
      </div>}
    </section>
  </div>;
}
