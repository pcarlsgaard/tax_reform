import { describe, expect, it } from 'vitest';
import { calculateMacro, defaultSettings, theoreticalConsumptionBase } from '../src/model';

describe('national accounting', () => {
  it('sums the saved NIPA components', () => {
    expect(theoreticalConsumptionBase()).toBeCloseTo(22764.9, 8);
  });

  it('keeps compliance and exemptions as separate stages', () => {
    const result = calculateMacro({ ...defaultSettings, noncomplianceRate: 0.10, exemptionShare: 0.20 });
    expect(result.noncomplianceLoss).toBeCloseTo(result.theoreticalBase * 0.10, 8);
    expect(result.baseAfterCompliance).toBeCloseTo(result.theoreticalBase * 0.90, 8);
    expect(result.exemptionLoss).toBeCloseTo(result.baseAfterCompliance * 0.20, 8);
    expect(result.taxableBase).toBeCloseTo(result.theoreticalBase * 0.90 * 0.80, 8);
  });

  it('reconciles gross revenue, credits, net revenue, and the target', () => {
    const result = calculateMacro(defaultSettings);
    expect(result.grossRevenue).toBeCloseTo(result.taxableBase * defaultSettings.rate, 8);
    expect(result.adultCreditCost).toBeCloseTo(1281.6, 8);
    expect(result.childCreditCost).toBeCloseTo(350.88, 8);
    expect(result.netRevenue).toBeCloseTo(result.grossRevenue - 1281.6 - 350.88, 8);
    expect(result.targetRevenue).toBe(4742);
    expect(result.surplusDeficit).toBeCloseTo(result.netRevenue - result.targetRevenue, 8);
  });

  it('solves a rate that reproduces the target', () => {
    const result = calculateMacro(defaultSettings);
    const solved = calculateMacro({ ...defaultSettings, rate: result.revenueNeutralRate });
    expect(solved.netRevenue).toBeCloseTo(solved.targetRevenue, 8);
    expect(solved.surplusDeficit).toBeCloseTo(0, 8);
  });

  it('changes the target only for selected replacement taxes', () => {
    const result = calculateMacro({ ...defaultSettings, replacedTaxes: { individualIncome: true, payroll: false, corporateIncome: false, customs: false } });
    expect(result.targetRevenue).toBe(2426);
  });
});
