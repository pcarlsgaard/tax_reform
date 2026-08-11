import { useState } from 'react';
import './styles.css';
import { defaultSettings, type ReformSettings } from './model';
import { Business } from './views/Business';
import { Household } from './views/Household';
import { National } from './views/National';
import { Overview } from './views/Overview';

type View = 'designer' | 'national' | 'household' | 'business';
const views: Array<[View, string, string]> = [
  ['designer', 'Reform designer', '01'], ['national', 'National base', '02'], ['household', 'Households', '03'], ['business', 'Businesses', '04'],
];

export default function App() {
  const [view, setView] = useState<View>('designer');
  const [settings, setSettings] = useState<ReformSettings>(defaultSettings);
  return <div className="app">
    <header className="site-header"><button className="brand" onClick={() => setView('designer')}><span>CT</span><div><strong>Consumption Tax Lab</strong><small>Static reform simulator · Iteration 1</small></div></button><div className="status-pill provisional"><i />2025 provisional baseline</div></header>
    <nav className="view-nav" aria-label="Simulator views">{views.map(([key, label, number]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><small>{number}</small>{label}</button>)}</nav>
    {view === 'designer' && <Overview settings={settings} setSettings={setSettings} />}
    {view === 'national' && <National settings={settings} />}
    {view === 'household' && <Household settings={settings} />}
    {view === 'business' && <Business settings={settings} />}
    <footer><p>Static accounting model · Tax year / data year 2025 · One provisional housing input · No growth, transition, or behavioral effects</p><a href="https://github.com/pcarlsgaard/tax_reform" target="_blank" rel="noreferrer">Methodology & source</a></footer>
  </div>;
}
