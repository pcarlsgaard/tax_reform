import { useMemo, useState } from 'react';
import './styles.css';
import './mobile-fixes.css';
import {
  calculateFederalProgramSavings,
  calculateHealthAnalysis,
  calculateMacro,
  defaultHealthPolicySettings,
  defaultSettings,
  defaultTransferReplacementSettings,
  type HealthPolicySettings,
  type ReformSettings,
  type TransferReplacementSettings,
} from './model';
import { PolicyDock } from './components/PolicyDock';
import { Business } from './views/Business';
import { Household } from './views/Household';
import { Health } from './views/Health';
import { National } from './views/National';
import { Overview } from './views/Overview';
import { Transfers } from './views/Transfers';

type View = 'designer' | 'national' | 'household' | 'transfers' | 'health' | 'business';
const views: Array<[View, string, string]> = [
  ['designer', 'Reform designer', '01'], ['national', 'National base', '02'], ['household', 'Households', '03'], ['transfers', 'Social spending', '04'], ['health', 'Employer health', '05'], ['business', 'Businesses', '06'],
];

const websiteDefaultSettings: ReformSettings = {
  ...defaultSettings,
  rate: 0.35,
  wageTaxMode: 'progressive',
  progressiveZeroBracketPerAdult: 0,
  progressiveTopBracketPerAdult: 60000,
  progressiveMiddleRate: 0.25,
  adultCredit: 2000,
  adultCreditMode: 'earned',
  adultCreditPhaseInRate: 0.10,
  adultCreditPhaseOutRate: 0,
  childCredit: 4000,
  under6ChildCredit: 6000,
  childCreditBaselineRefundableShare: 1,
  childCreditPhaseInRate: 0.15,
};

const websiteDefaultHealthPolicy: HealthPolicySettings = {
  ...defaultHealthPolicySettings,
  adultHealthCredit: 3000,
  childHealthCredit: 1500,
};

export default function App() {
  const [view, setView] = useState<View>('designer');
  const [settings, setSettings] = useState<ReformSettings>(websiteDefaultSettings);
  const [transferSettings, setTransferSettings] = useState<TransferReplacementSettings>(defaultTransferReplacementSettings);
  const [healthPolicy, setHealthPolicy] = useState<HealthPolicySettings>(websiteDefaultHealthPolicy);
  const [policyDockExpanded, setPolicyDockExpanded] = useState(true);
  const healthAnalysis = useMemo(
    () => calculateHealthAnalysis(settings, healthPolicy),
    [settings, healthPolicy],
  );
  const macroResult = useMemo(() => calculateMacro(settings, {
    federalTransferSavings: calculateFederalProgramSavings(transferSettings),
    insuranceCreditCost: healthAnalysis.totalHealthCreditCostBillions,
  }), [settings, transferSettings, healthAnalysis.totalHealthCreditCostBillions]);
  return <div className={`app ${policyDockExpanded ? 'policy-summary-open' : 'policy-summary-closed'}`}>
    <header className="site-header"><button className="brand" onClick={() => setView('designer')}><span>CT</span><div><strong>Consumption Tax Lab</strong><small>Static reform simulator · Iteration 1</small></div></button><div className="status-pill provisional"><i />2025 provisional baseline</div></header>
    <nav className="view-nav" aria-label="Simulator views">{views.map(([key, label, number]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><small>{number}</small>{label}</button>)}</nav>
    <PolicyDock settings={settings} healthPolicy={healthPolicy} result={macroResult} expanded={policyDockExpanded} setExpanded={setPolicyDockExpanded} />
    {view === 'designer' && <Overview settings={settings} setSettings={setSettings} result={macroResult} />}
    {view === 'national' && <National settings={settings} result={macroResult} />}
    {view === 'household' && <Household settings={settings} />}
    {view === 'transfers' && <Transfers settings={settings} replacements={transferSettings} setReplacements={setTransferSettings} macro={macroResult} />}
    {view === 'health' && <Health settings={settings} policy={healthPolicy} setPolicy={setHealthPolicy} result={healthAnalysis} macro={macroResult} />}
    {view === 'business' && <Business settings={settings} />}
    <footer><p>Static accounting model · Tax year / data year 2025 · One provisional housing input · No growth, transition, or behavioral effects</p><a href="https://github.com/pcarlsgaard/tax_reform" target="_blank" rel="noreferrer">Methodology & source</a></footer>
  </div>;
}
