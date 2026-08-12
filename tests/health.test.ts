import { describe, expect, it } from 'vitest';
import {
  calculateHealthAnalysis,
  calculateMacro,
  defaultHealthPolicySettings,
  defaultSettings,
  healthSnapshot,
} from '../src/model';

describe('employer health transition', () => {
  it('reconciles the redistributed health wage to the employer contribution pool', () => {
    const result = calculateHealthAnalysis(defaultSettings, defaultHealthPolicySettings);
    expect(result.coveredPeopleMillions).toBeGreaterThan(150);
    expect(result.employerContributionPoolBillions).toBeGreaterThan(900);
    expect(Math.abs(result.employerWageAllocationGapBillions)).toBeLessThan(3);
    expect(result.averageHealthWagePerRecipient).toBeGreaterThan(11700);
    expect(result.averageHealthWagePerRecipient).toBeLessThan(11800);
    expect(result.winnerCoveredPeopleShare).toBeCloseTo(0.6482, 3);
    expect(result.creditTargets.find((target) => target.targetShare === 0.67)?.requiredCreditPerPerson)
      .toBeCloseTo(2213, 0);
  });

  it('caps the refundable health credit at benchmark premiums', () => {
    const result = calculateHealthAnalysis(defaultSettings, {
      ...defaultHealthPolicySettings,
      healthCreditPerPerson: 100000,
    });
    expect(result.healthCreditCostBillions).toBeLessThanOrEqual(result.benchmarkPremiumBillions + 0.01);
  });

  it('makes a larger fixed credit weakly increase the winner share', () => {
    const withoutCredit = calculateHealthAnalysis(defaultSettings, {
      ...defaultHealthPolicySettings,
      healthCreditPerPerson: 0,
    });
    const withCredit = calculateHealthAnalysis(defaultSettings, defaultHealthPolicySettings);
    expect(withCredit.winnerCoveredPeopleShare).toBeGreaterThanOrEqual(withoutCredit.winnerCoveredPeopleShare);
    expect(withCredit.medianDollarChange).toBeGreaterThan(withoutCredit.medianDollarChange);
  });

  it('supports zero wage pass-through as an incidence sensitivity', () => {
    const result = calculateHealthAnalysis(defaultSettings, {
      ...defaultHealthPolicySettings,
      employerHealthPassThroughRate: 0,
    });
    expect(result.allocatedHealthWagesBillions).toBeCloseTo(0, 8);
    expect(result.averageHealthWagePerRecipient).toBeCloseTo(0, 8);
  });

  it('uses the linked HIPM and MEPS/BEA audit controls', () => {
    expect(healthSnapshot.sample.hipmMatchRate).toBe(1);
    expect(healthSnapshot.browserReconciliation.analyticalCells).toBeGreaterThan(30000);
    expect(healthSnapshot.calibration.employeePremiumScaleToMeps2025).toBeGreaterThan(0);
    expect(healthSnapshot.calibration.projectedBeaGroupHealth2025Billions).toBeGreaterThan(1000);
  });

  it('reports complementary employer and employee premium shares and the credit financing rate', () => {
    const result = calculateHealthAnalysis(defaultSettings, defaultHealthPolicySettings);
    const macro = calculateMacro(defaultSettings);
    expect(result.employerPremiumShare + result.employeePremiumShare).toBeCloseTo(1, 10);
    expect(result.employerPremiumShare).toBeGreaterThan(result.employeePremiumShare);
    expect(result.healthCreditFinancingRateIncrease)
      .toBeCloseTo(result.healthCreditCostBillions / macro.rateAdjustedBase, 10);
  });
});
