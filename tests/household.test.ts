import { describe, expect, it } from 'vitest';
import { calculateCurrentLaw, calculateHousehold, defaultSettings, type HouseholdInput } from '../src/model';

const household = (cashWage: number, filingStatus: HouseholdInput['filingStatus'] = 'single', children = 0) => ({ cashWage, filingStatus, children });

describe('2024 current-law household engine', () => {
  it('uses the standard deduction and correct 2024 bracket boundary', () => {
    expect(calculateCurrentLaw(household(14600)).incomeTaxBeforeCredits).toBe(0);
    expect(calculateCurrentLaw(household(26200)).incomeTaxBeforeCredits).toBeCloseTo(1160, 8);
    expect(calculateCurrentLaw(household(26201)).incomeTaxBeforeCredits).toBeCloseTo(1160.12, 8);
  });

  it('caps Social Security and continues Medicare', () => {
    const atCap = calculateCurrentLaw(household(168600));
    const above = calculateCurrentLaw(household(200000));
    expect(atCap.employeeSocialSecurity).toBeCloseTo(10453.2, 8);
    expect(above.employeeSocialSecurity).toBeCloseTo(atCap.employeeSocialSecurity, 8);
    expect(above.employeeMedicare).toBeGreaterThan(atCap.employeeMedicare);
  });

  it('starts Additional Medicare Tax above the filing threshold', () => {
    expect(calculateCurrentLaw(household(200000)).additionalMedicare).toBe(0);
    expect(calculateCurrentLaw(household(200001)).additionalMedicare).toBeCloseTo(0.009, 8);
    expect(calculateCurrentLaw(household(250001, 'married')).additionalMedicare).toBeCloseTo(0.009, 8);
  });

  it('models EITC phase-in, plateau, and phase-out', () => {
    expect(calculateCurrentLaw(household(4000)).eitc).toBeCloseTo(306, 8);
    expect(calculateCurrentLaw(household(10330)).eitc).toBeCloseTo(632, 8);
    expect(calculateCurrentLaw(household(18592)).eitc).toBe(0);
  });

  it('limits the refundable CTC by earnings and per-child cap', () => {
    const low = calculateCurrentLaw(household(10000, 'married', 2));
    expect(low.nonrefundableCtc).toBe(0);
    expect(low.refundableCtc).toBeCloseTo(1125, 8);
    const higher = calculateCurrentLaw(household(50000, 'married', 2));
    expect(higher.refundableCtc).toBeLessThanOrEqual(3400);
  });

  it('phases out CTC above the statutory threshold', () => {
    const at = calculateCurrentLaw(household(200000, 'single', 1));
    const over = calculateCurrentLaw(household(200001, 'single', 1));
    expect(at.nonrefundableCtc + at.refundableCtc).toBeCloseTo(2000, 8);
    expect(over.nonrefundableCtc + over.refundableCtc).toBeCloseTo(1950, 8);
  });
});

describe('reform household engine', () => {
  it('pays fully refundable credits at zero income', () => {
    const result = calculateHousehold(household(0), defaultSettings);
    expect(result.reformTaxBeforeCredits).toBe(0);
    expect(result.reformTaxAfterCredits).toBe(-4800);
    expect(result.reformDisposableResources).toBe(4800);
  });

  it('allows credits to exceed gross wage tax without an ad hoc multiplier', () => {
    const result = calculateHousehold(household(10000, 'married', 2), defaultSettings);
    expect(result.totalReformCredit).toBe(19200);
    expect(result.reformTaxAfterCredits).toBeLessThan(0);
    expect(result.reformTaxBeforeCredits).toBeCloseTo(result.reformWageBase * 0.30, 8);
  });

  it('has the statutory marginal rate away from retained-tax transitions', () => {
    const result = calculateHousehold(household(300000), defaultSettings);
    expect(result.reformMarginalRate).toBeCloseTo(0.30, 8);
  });

  it('produces finite marginal rates around major current-law kinks', () => {
    for (const wage of [14600, 26200, 168600, 200000, 250000]) {
      const result = calculateHousehold(household(wage), defaultSettings);
      expect(Number.isFinite(result.currentMarginalRate)).toBe(true);
      expect(Number.isFinite(result.reformMarginalRate)).toBe(true);
    }
  });
});
