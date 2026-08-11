import { describe, expect, it } from 'vitest';
import { calculateMacro, defaultSettings, theoreticalConsumptionBase } from '../src/model';

describe('2025 national accounting', () => {
  it('sums the saved NIPA components', () => {
    expect(theoreticalConsumptionBase()).toBeCloseTo(24120.939, 8);
  });

  it('keeps compliance and exemptions as separate stages', () => {
    const result = calculateMacro({ ...defaultSettings, noncomplianceRate: 0.10, exemptionShare: 0.20 });
    expect(result.noncomplianceLoss).toBeCloseTo(result.theoreticalBase * 0.10, 8);
    expect(result.baseAfterCompliance).toBeCloseTo(result.theoreticalBase * 0.90, 8);
    expect(result.exemptionLoss).toBeCloseTo(result.baseAfterCompliance * 0.20, 8);
    expect(result.taxableBase).toBeCloseTo(result.theoreticalBase * 0.90 * 0.80, 8);
    expect(result.wageTaxableBase + result.businessTaxableBase).toBeCloseTo(result.taxableBase, 8);
  });

  it('reconciles revenue, credit costs, and every GDP ratio', () => {
    const result = calculateMacro(defaultSettings);
    expect(result.taxableBase).toBeCloseTo(22311.868575, 8);
    expect(result.grossRevenue).toBeCloseTo(result.taxableBase * defaultSettings.rate, 8);
    expect(result.adultCreditCost).toBeCloseTo(971.1486324, 8);
    expect(result.childCreditCost).toBeCloseTo(345.7024704, 8);
    expect(result.netRevenue).toBeCloseTo(result.grossRevenue - result.adultCreditCost - result.childCreditCost, 8);
    expect(result.targetRevenue).toBeCloseTo(5051.293, 8);
    expect(result.surplusDeficit).toBeCloseTo(result.netRevenue - result.targetRevenue, 8);
    expect(result.grossRevenuePercentGdp).toBeCloseTo(result.grossRevenue / result.gdp, 12);
    expect(result.netRevenuePercentGdp).toBeCloseTo(result.netRevenue / result.gdp, 12);
    expect(result.targetRevenuePercentGdp).toBeCloseTo(result.targetRevenue / result.gdp, 12);
  });

  it('solves flat and progressive rate-equivalent targets algebraically', () => {
    const flat = calculateMacro(defaultSettings);
    const flatSolved = calculateMacro({ ...defaultSettings, rate: flat.revenueNeutralRate });
    expect(flatSolved.surplusDeficit).toBeCloseTo(0, 8);

    const progressiveSettings = { ...defaultSettings, wageTaxMode: 'progressive' as const };
    const progressive = calculateMacro(progressiveSettings);
    expect(progressive.rateAdjustedBase).toBeLessThan(progressive.taxableBase);
    const progressiveSolved = calculateMacro({ ...progressiveSettings, rate: progressive.revenueNeutralRate });
    expect(progressiveSolved.surplusDeficit).toBeCloseTo(0, 8);
  });

  it('changes the target only for selected replacement taxes', () => {
    const result = calculateMacro({ ...defaultSettings, replacedTaxes: { individualIncome: true, payroll: false, corporateIncome: false, customs: false } });
    expect(result.targetRevenue).toBeCloseTo(2656.044, 8);
  });

  it('scores a universal adult credit at 100% rather than the earned-credit budget share', () => {
    const universal = calculateMacro({ ...defaultSettings, adultCreditMode: 'universal' });
    expect(universal.adultCreditCost).toBeCloseTo(269.763509 * 4.8, 8);
    expect(universal.adultCreditCost).toBeGreaterThan(calculateMacro(defaultSettings).adultCreditCost);
  });
});
