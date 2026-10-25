import { describe, expect, it } from 'vitest';
import {
  calculateHousehold, calculateMacro, calculateReformWageTax, defaultSettings,
  marginalProtectionPresets, wageBracketMarginalRate, wageBracketTax,
} from '../src/model';

const settings = {
  ...defaultSettings,
  rate: 0.35,
  wageTaxMode: 'progressive' as const,
  progressiveWageBrackets: marginalProtectionPresets[4].map(b => ({ ...b })),
  adultCredit: 2000,
  adultCreditPhaseInRate: 0.10,
  adultCreditPhaseOutRate: 0,
  childCredit: 7200,
};

describe('configurable 3-5 statutory wage bands', () => {
  it('integrates band amounts precisely and doubles thresholds for joint returns', () => {
    expect(calculateReformWageTax(10000, 'single', settings)).toBeCloseTo(1750, 8);
    expect(calculateReformWageTax(100000, 'single', settings)).toBeCloseTo(70000 * .175 + 30000 * .25, 8);
    expect(calculateReformWageTax(250000, 'single', settings)).toBeCloseTo(70000 * .175 + 150000 * .25 + 30000 * .30, 8);
    expect(calculateReformWageTax(300000, 'single', settings)).toBeCloseTo(70000 * .175 + 150000 * .25 + 55000 * .30 + 25000 * .35, 8);
    expect(calculateReformWageTax(200000, 'married', settings)).toBeCloseTo(2 * calculateReformWageTax(100000, 'single', settings), 8);
  });

  it('creates the effective 7.5% low-earnings tier through credit phase-in', () => {
    const result = calculateHousehold({ filingStatus: 'single', children: 0, cashWage: 10000 }, settings);
    expect(result.reformMarginalRate).toBeCloseTo(.075, 7);
    expect(result.reformPersonalMarginalRate).toBeCloseTo(.075, 7);
    expect(result.currentPersonalMarginalRate).toBeLessThan(result.currentMarginalRate);
    const middle = calculateHousehold({ filingStatus: 'single', children: 0, cashWage: 100000 }, settings);
    expect(middle.reformPersonalMarginalRate).toBeCloseTo(.25, 7);
    expect(middle.reformMarginalRate).toBeCloseTo(.25, 7);
    expect(middle.currentPersonalMarginalRate).toBeCloseTo(.2965, 7);
    expect(middle.currentMarginalRate).toBeGreaterThan(middle.currentPersonalMarginalRate);
    const five = { ...settings, progressiveWageBrackets: marginalProtectionPresets[5] };
    const veryLow = calculateHousehold({ filingStatus: 'single', children: 0, cashWage: 10000 }, five);
    expect(veryLow.reformMarginalRate).toBeCloseTo(-.025, 7);
    expect(wageBracketMarginalRate(150000, 1, marginalProtectionPresets[4])).toBeCloseTo(.25, 10);
    expect(wageBracketTax(30000, 1, marginalProtectionPresets[3])).toBeCloseTo(5250, 10);
  });

  it('scores bracket revenue and solves the business rate without changing wage rates', () => {
    const score = calculateMacro(settings);
    const solved = calculateMacro({ ...settings, rate: score.revenueNeutralRate });
    expect(solved.netRevenue).toBeCloseTo(solved.targetRevenue, 6);
    const five = calculateMacro({ ...settings, progressiveWageBrackets: marginalProtectionPresets[5] });
    expect(five.grossRevenue).toBeLessThan(score.grossRevenue);
    expect(score.grossRevenue).toBeCloseTo(score.rateAdjustedBase * settings.rate, 8);
    expect(score.rateAdjustedWageBase).toBeGreaterThan(0);
  });
});
