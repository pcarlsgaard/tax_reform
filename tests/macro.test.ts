import { describe, expect, it } from 'vitest';
import { calculateMacro, defaultSettings, theoreticalConsumptionBase, totalRefundableTaxCreditOutlays } from '../src/model';

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
    expect(result.adultCreditCost).toBeCloseTo(542.0128005205615, 8);
    expect(result.childCreditCost).toBeCloseTo(345.7024704, 8);
    expect(result.netRevenue).toBeCloseTo(result.grossRevenue - result.adultCreditCost - result.childCreditCost, 8);
    expect(result.targetRevenue).toBeCloseTo(5051.293, 8);
    expect(result.refundableTaxCreditOutlaySavings).toBeCloseTo(92.5742078756, 10);
    expect(result.totalFederalSavings).toBeCloseTo(totalRefundableTaxCreditOutlays, 10);
    expect(result.adjustedTargetRevenue).toBeCloseTo(result.targetRevenue - totalRefundableTaxCreditOutlays, 10);
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

  it('removes refundable credit outlays only when individual income taxation is replaced', () => {
    const replaced = calculateMacro(defaultSettings);
    const retained = calculateMacro({
      ...defaultSettings,
      replacedTaxes: { ...defaultSettings.replacedTaxes, individualIncome: false },
    });
    expect(replaced.refundableTaxCreditOutlaySavings).toBeCloseTo(66.00744660284 + 26.56676127276, 10);
    expect(retained.refundableTaxCreditOutlaySavings).toBe(0);
    expect(retained.totalFederalSavings).toBe(0);
    expect(retained.adjustedTargetRevenue).toBe(retained.targetRevenue);
  });

  it('scores a universal adult credit at 100% rather than the earned-credit budget share', () => {
    const universal = calculateMacro({ ...defaultSettings, adultCreditMode: 'universal' });
    expect(universal.adultCreditCost).toBeCloseTo(269.763509 * 4.8, 8);
    expect(universal.adultCreditCost).toBeGreaterThan(calculateMacro(defaultSettings).adultCreditCost);
  });

  it('starts with all compensation taxable and scores named exemptions separately', () => {
    const base = calculateMacro(defaultSettings);
    expect(base.compensationExemptionLoss).toBe(0);
    const pensionExempt = calculateMacro({ ...defaultSettings, employerPensionInsuranceExemptionShare: 1 });
    expect(pensionExempt.compensationExemptionLoss).toBeCloseTo(1859.275 * 0.925, 8);
    expect(base.taxableBase - pensionExempt.taxableBase).toBeCloseTo(pensionExempt.compensationExemptionLoss, 8);
    expect(pensionExempt.businessTaxableBase).toBeCloseTo(base.businessTaxableBase, 8);
  });

  it('applies adult-credit take-up after statutory eligibility without changing the tax base', () => {
    const full = calculateMacro(defaultSettings);
    const partial = calculateMacro({ ...defaultSettings, adultCreditTakeUpRate: 0.80 });
    expect(partial.adultCreditStatutoryCost).toBeCloseTo(full.adultCreditStatutoryCost, 10);
    expect(partial.adultCreditCost).toBeCloseTo(full.adultCreditCost * 0.80, 10);
    expect(partial.taxableBase).toBeCloseTo(full.taxableBase, 10);
  });
});
