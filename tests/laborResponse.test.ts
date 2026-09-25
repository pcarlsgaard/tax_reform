import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { calculateCurrentLaw } from '../src/model/household';

const root = new URL('../', import.meta.url).pathname;
function python(code: string) {
  return JSON.parse(execFileSync('python3', ['-c',
    `import sys,json;sys.path.insert(0,'scripts');from estimate_labor_response import current_tax,reform_tax;${code}`],
  { cwd: root, encoding: 'utf8' }));
}

describe('Census labor response calculator', () => {
  it('reproduces the app’s wage-only current-law liabilities across tax regimes', () => {
    const cases = [
      { filingStatus: 'single' as const, cashWage: 8000, children: 0 },
      { filingStatus: 'single' as const, cashWage: 45000, children: 2 },
      { filingStatus: 'single' as const, cashWage: 650000, children: 0 },
      { filingStatus: 'married' as const, cashWage: 130000, secondaryCashWage: 51000, children: 2 },
      { filingStatus: 'married' as const, cashWage: 900000, secondaryCashWage: 200000, children: 0 },
    ];
    const rows = cases.map(c => ({ earners: c.filingStatus === 'single'
      ? [c.cashWage] : [c.cashWage, c.secondaryCashWage],
    married: c.filingStatus === 'married', children: c.children }));
    const values = python(`rows=json.loads(${JSON.stringify(JSON.stringify(rows))});print(json.dumps([current_tax(row['earners'],row['married'],row['children'])[0] for row in rows]))`);
    for (let i = 0; i < cases.length; i += 1) {
      expect(values[i]).toBeCloseTo(calculateCurrentLaw(cases[i]).totalFederalTax, 6);
    }
  });

  it('implements the user’s 10% earned credit slope and 25/35% wage schedule', () => {
    const slopes = python(`print(json.dumps([(reform_tax([w+1000],False,1,0,employer_pass_through=0,benefit_share=0)
      -reform_tax([w],False,1,0,employer_pass_through=0,benefit_share=0))/1000
      for w in (10000,30000,100000)]))`);
    expect(slopes).toEqual([0.15, 0.25, 0.35]);
  });

  it('keeps the flat purchase credit independent of earnings while fully taxing benefits', () => {
    const rows = python(`print(json.dumps([reform_tax([30000],False,1,1,benefit_amount=b)
      for b in (0,1000)] + [reform_tax([30000],False,1,1,benefit_amount=1000,insurance_credit=False)]))`);
    expect(rows[1] - rows[0]).toBeCloseTo(250, 8);
    expect(rows[2] - rows[1]).toBe(4500);
  });

  it('changes only earned-credit eligibility when the same taxable benefits become cash', () => {
    const taxes = python(`print(json.dumps([[reform_tax([w],False,1,0,benefit_amount=1500),
      reform_tax([w],False,1,0,benefit_amount=1500,benefit_cash_out_share=1,fica_cash_credit_share=1)]
      for w in (10000,30000)]))`);
    expect(taxes[0][1]).toBeLessThan(taxes[0][0]);
    expect(taxes[1][1]).toBeCloseTo(taxes[1][0], 8);
  });
});
