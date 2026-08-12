import { useState } from 'react';
import './styles.css';
import { defaultSettings, defaultTransferReplacementSettings, type ReformSettings, type TransferReplacementSettings } from './model';
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

export default function App() {
  const [view, setView] = useState<View>('designer');
  const [settings, setSettings] = useState<ReformSettings>(defaultSettings);
  const [transferSettings, setTransferSettings] = useState<TransferReplacementSettings>(defaultTransferReplacementSettings);
  return <div className="app">
    <header className="site-header"><button className="brand" onClick={() => setView('designer')}><span>CT</span><div><strong>Consumption Tax Lab</strong><small>Static reform simulator · Iteration 1</small></div></button><div className="status-pill provisional"><i />2025 provisional baseline</div></header>
    <nav className="view-nav" aria-label="Simulator views">{views.map(([key, label, number]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><small>{number}</small>{label}</button>)}</nav>
    {view === 'designer' && <Overview settings={settings} setSettings={setSettings} transferSettings={transferSettings} />}
    {view === 'national' && <National settings={settings} transferSettings={transferSettings} />}
    {view === 'household' && <Household settings={settings} />}
    {view === 'transfers' && <Transfers settings={settings} replacements={transferSettings} setReplacements={setTransferSettings} />}
    {view === 'health' && <Health settings={settings} />}
    {view === 'business' && <Business settings={settings} />}
    <footer><p>Static accounting model · Tax year / data year 2025 · One provisional housing input · No growth, transition, or behavioral effects</p><a href="https://github.com/pcarlsgaard/tax_reform" target="_blank" rel="noreferrer">Methodology & source</a></footer>
  </div>;
}
