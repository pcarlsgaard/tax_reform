import { describe, expect, it } from 'vitest';
import { calculateMicrodataScore, defaultSettings, microdata2025 } from '../src/model';

describe('CPS ASEC microdata score', () => {
  it('reproduces the checked-in default estimates', () => {
    const score = calculateMicrodataScore(defaultSettings);
    expect(score.grossCompensationBase).toBeCloseTo(15726.91, 8);
    expect(score.taxableCompensationBase).toBeCloseTo(score.grossCompensationBase, 8);
    expect(score.adultCreditStatutoryCost).toBeCloseTo(
      microdata2025.defaultEstimates.earnedAdultCreditCostBillions,
      8,
    );
    expect(score.progressiveEquivalentCompensationBase).toBeCloseTo(
      microdata2025.defaultEstimates.progressiveEquivalentCompensationBaseBillions,
      8,
    );
    expect(score.progressiveAverageWageRateShare).toBeCloseTo(
      microdata2025.defaultEstimates.progressiveAverageWageRateShare,
      12,
    );
  });

  it('removes each compensation component independently', () => {
    const score = calculateMicrodataScore({
      ...defaultSettings,
      cashWageExemptionShare: 0.10,
      employerSocialInsuranceExemptionShare: 0.25,
      employerPensionInsuranceExemptionShare: 0.50,
    });
    const controls = microdata2025.compensationControlsBillions;
    const expected = controls.cashWagesAndSalaries * 0.90
      + controls.employerGovernmentSocialInsurance * 0.75
      + controls.employerPensionAndInsurance * 0.50;
    expect(score.taxableCompensationBase).toBeCloseTo(expected, 8);
    expect(score.exemptCompensationBase).toBeCloseTo(score.grossCompensationBase - expected, 8);
  });

  it('uses Census replicate-weight uncertainty rather than treating the point score as exact', () => {
    expect(microdata2025.uncertainty.earnedAdultCreditCostStandardErrorBillions).toBeGreaterThan(0);
    expect(microdata2025.uncertainty.progressiveEquivalentBaseStandardErrorBillions).toBeGreaterThan(0);
    expect(microdata2025.sample.sampleTaxUnits).toBeGreaterThan(70000);
  });
});
