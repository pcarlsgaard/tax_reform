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
    expect(score.adultCreditStatutoryCost).toBeCloseTo(
      calculateMicrodataScore(defaultSettings).adultCreditStatutoryCost,
      10,
    );
  });

  it('uses Census replicate-weight uncertainty rather than treating the point score as exact', () => {
    expect(microdata2025.uncertainty.earnedAdultCreditCostStandardErrorBillions).toBeGreaterThan(0);
    expect(microdata2025.uncertainty.progressiveEquivalentBaseStandardErrorBillions).toBeGreaterThan(0);
    expect(microdata2025.sample.sampleTaxUnits).toBeGreaterThan(70000);
  });

  it('reconciles the live adult-credit audit to the scored totals', () => {
    const score = calculateMicrodataScore(defaultSettings);
    const audit = score.adultCreditAudit;
    const sum = (key: 'taxUnitsMillions' | 'adultsMillions' | 'statutoryCostBillions' | 'budgetCostBillions') => (
      audit.buckets.reduce((total, row) => total + row[key], 0)
    );

    expect(sum('taxUnitsMillions')).toBeCloseTo(audit.totalTaxUnitsMillions, 8);
    expect(sum('adultsMillions')).toBeCloseTo(audit.totalAdultsMillions, 8);
    expect(sum('statutoryCostBillions')).toBeCloseTo(score.adultCreditStatutoryCost, 8);
    expect(sum('budgetCostBillions')).toBeCloseTo(score.adultCreditCost, 8);
    expect(audit.totalAdultsMillions).toBeCloseTo(269.763509, 6);
    expect(audit.adultsInPositiveCreditUnitsMillions).toBeCloseTo(154.281256, 5);
    expect(audit.averageStatutoryCreditPerAdult).toBeCloseTo(2009.24, 1);
    expect(audit.statutoryCostShareOfUniversalMaximum).toBeCloseTo(0.418586, 5);

    const row = (id: string) => audit.buckets.find((bucket) => bucket.id === id);
    expect(row('zeroCompensation')?.adultsMillions).toBeCloseTo(76.174, 2);
    expect(row('phaseIn')?.statutoryCostBillions).toBeCloseTo(43.003, 2);
    expect(row('fullCredit')?.statutoryCostBillions).toBeCloseTo(276.703, 2);
    expect(row('phaseOut')?.statutoryCostBillions).toBeCloseTo(222.308, 2);
    expect(row('fullyPhasedOut')?.adultsMillions).toBeCloseTo(39.308, 2);
  });

  it('rescans the microdata when any adult-credit schedule control changes', () => {
    const base = calculateMicrodataScore(defaultSettings);
    const largerMaximum = calculateMicrodataScore({ ...defaultSettings, adultCredit: 6000 });
    const fasterPhaseIn = calculateMicrodataScore({ ...defaultSettings, adultCreditPhaseInRate: 0.50 });
    const laterPhaseOut = calculateMicrodataScore({ ...defaultSettings, adultCreditPhaseOutStartPerAdult: 75000 });
    const fasterPhaseOut = calculateMicrodataScore({ ...defaultSettings, adultCreditPhaseOutRate: 0.15 });

    expect(largerMaximum.adultCreditStatutoryCost).toBeGreaterThan(base.adultCreditStatutoryCost);
    expect(fasterPhaseIn.adultCreditStatutoryCost).toBeGreaterThan(base.adultCreditStatutoryCost);
    expect(laterPhaseOut.adultCreditStatutoryCost).toBeGreaterThan(base.adultCreditStatutoryCost);
    expect(fasterPhaseOut.adultCreditStatutoryCost).toBeLessThan(base.adultCreditStatutoryCost);
    expect(largerMaximum.adultCreditAudit.universalMaximumCostBillions)
      .toBeGreaterThan(base.adultCreditAudit.universalMaximumCostBillions);
  });

  it('audits take-up, universal credits, and overlapping phase-in/out schedules explicitly', () => {
    const partialTakeUp = calculateMicrodataScore({ ...defaultSettings, adultCreditTakeUpRate: 0.80 });
    expect(partialTakeUp.adultCreditCost).toBeCloseTo(
      partialTakeUp.adultCreditStatutoryCost * 0.80,
      10,
    );
    expect(partialTakeUp.adultCreditAudit.buckets.reduce(
      (sum, row) => sum + row.budgetCostBillions,
      0,
    )).toBeCloseTo(partialTakeUp.adultCreditCost, 8);

    const universal = calculateMicrodataScore({ ...defaultSettings, adultCreditMode: 'universal' });
    const universalRow = universal.adultCreditAudit.buckets.find((row) => row.id === 'universalCredit');
    expect(universal.adultCreditStatutoryCost).toBeCloseTo(
      universal.adultCreditAudit.universalMaximumCostBillions,
      8,
    );
    expect(universalRow?.adultsMillions).toBeCloseTo(universal.adultCreditAudit.totalAdultsMillions, 8);

    const overlap = calculateMicrodataScore({
      ...defaultSettings,
      adultCreditPhaseOutStartPerAdult: 10000,
    });
    const overlapRow = overlap.adultCreditAudit.buckets.find(
      (row) => row.id === 'phaseInPhaseOutOverlap',
    );
    expect(overlap.adultCreditAudit.phaseInPhaseOutOverlap).toBe(true);
    expect(overlapRow?.taxUnitsMillions).toBeGreaterThan(0);
  });
});
