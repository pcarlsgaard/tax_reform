import { describe, expect, it } from 'vitest';
import {
  calculateAdultCredit,
  calculateCurrentLaw,
  calculateHousehold,
  calculateReformWageTax,
  calculateTaxWedgeTable,
  defaultSettings,
  OECD_US_AVERAGE_WAGE_2025,
  type HouseholdInput,
} from '../src/model';

const household = (cashWage: number, filingStatus: HouseholdInput['filingStatus'] = 'single', children = 0, secondaryCashWage = 0) => ({ cashWage, filingStatus, children, secondaryCashWage });

describe('2025 current-law household engine', () => {
  it('uses the enacted 2025 standard deduction and bracket boundary', () => {
    expect(calculateCurrentLaw(household(15750)).incomeTaxBeforeCredits).toBe(0);
    expect(calculateCurrentLaw(household(27675)).incomeTaxBeforeCredits).toBeCloseTo(1192.5, 8);
    expect(calculateCurrentLaw(household(27676)).incomeTaxBeforeCredits).toBeCloseTo(1192.62, 8);
  });

  it('caps Social Security at the 2025 wage base and continues Medicare', () => {
    const atCap = calculateCurrentLaw(household(176100));
    const above = calculateCurrentLaw(household(200000));
    expect(atCap.employeeSocialSecurity).toBeCloseTo(10918.2, 8);
    expect(above.employeeSocialSecurity).toBeCloseTo(atCap.employeeSocialSecurity, 8);
    expect(above.employeeMedicare).toBeGreaterThan(atCap.employeeMedicare);
  });

  it('applies the Social Security wage cap separately to two earners', () => {
    const oneEarner = calculateCurrentLaw(household(352200, 'married'));
    const twoEarners = calculateCurrentLaw(household(176100, 'married', 0, 176100));
    expect(twoEarners.employeeSocialSecurity).toBeCloseTo(oneEarner.employeeSocialSecurity * 2, 8);
  });

  it('starts Additional Medicare Tax above the filing threshold', () => {
    expect(calculateCurrentLaw(household(200000)).additionalMedicare).toBe(0);
    expect(calculateCurrentLaw(household(200001)).additionalMedicare).toBeCloseTo(0.009, 8);
    expect(calculateCurrentLaw(household(250001, 'married')).additionalMedicare).toBeCloseTo(0.009, 8);
  });

  it('models the 2025 EITC phase-in, plateau, and phase-out', () => {
    expect(calculateCurrentLaw(household(4000)).eitc).toBeCloseTo(306, 8);
    expect(calculateCurrentLaw(household(8490)).eitc).toBeCloseTo(649, 8);
    expect(calculateCurrentLaw(household(19105)).eitc).toBe(0);
  });

  it('limits the refundable CTC and phases out the enacted $2,200 credit', () => {
    const low = calculateCurrentLaw(household(10000, 'married', 2));
    expect(low.nonrefundableCtc).toBe(0);
    expect(low.refundableCtc).toBeCloseTo(1125, 8);
    const at = calculateCurrentLaw(household(200000, 'single', 1));
    const over = calculateCurrentLaw(household(200001, 'single', 1));
    expect(at.nonrefundableCtc + at.refundableCtc).toBeCloseTo(2200, 8);
    expect(over.nonrefundableCtc + over.refundableCtc).toBeCloseTo(2150, 8);
  });
});

describe('reform adult and child credits', () => {
  it('builds disposable resources by subtracting pre-credit tax and adding credits', () => {
    const result = calculateHousehold(household(25000, 'single', 2), defaultSettings);
    expect(result.currentPreCreditTaxLiability).toBeCloseTo(
      result.current.incomeTaxBeforeCredits + result.current.employeePayrollTax + result.current.employerPayrollTax,
      10,
    );
    expect(result.currentTaxCredits).toBeCloseTo(
      result.current.eitc + result.current.nonrefundableCtc + result.current.refundableCtc,
      10,
    );
    expect(result.currentDisposableResources).toBeCloseTo(
      result.employerCompensation - result.currentPreCreditTaxLiability + result.currentTaxCredits,
      10,
    );
    expect(result.reformTaxAfterCredits).toBeCloseTo(
      result.reformPreCreditTaxLiability - result.reformTotalCredits,
      10,
    );
    expect(result.reformDisposableResources).toBeCloseTo(
      result.reformGrossResources - result.reformPreCreditTaxLiability + result.reformTotalCredits,
      10,
    );
  });

  it('separates retained current-law liabilities and credits when income tax remains', () => {
    const settings = {
      ...defaultSettings,
      replacedTaxes: { ...defaultSettings.replacedTaxes, individualIncome: false },
    };
    const result = calculateHousehold(household(25000, 'single', 2), settings);
    expect(result.retainedCurrentTaxBeforeCredits).toBeCloseTo(result.current.incomeTaxBeforeCredits, 10);
    expect(result.retainedCurrentTaxCredits).toBeCloseTo(result.currentTaxCredits, 10);
    expect(result.reformPreCreditTaxLiability).toBeCloseTo(
      result.reformTaxBeforeCredits + result.retainedCurrentTaxBeforeCredits,
      10,
    );
    expect(result.reformTotalCredits).toBeCloseTo(result.totalReformCredit + result.retainedCurrentTaxCredits, 10);
  });

  it('phases the adult credit in with earnings while keeping the child credit flat and refundable', () => {
    const zero = calculateHousehold(household(0, 'single', 2), defaultSettings);
    expect(zero.adultCredit).toBe(0);
    expect(zero.childCredit).toBe(9600);
    expect(zero.reformTaxAfterCredits).toBe(-9600);

    const low = calculateHousehold(household(10000, 'married', 2), defaultSettings);
    expect(low.adultCredit).toBeCloseTo(low.reformWageBase * 0.30, 8);
    expect(low.totalReformCredit).toBeCloseTo(12829.5, 8);
  });

  it('supports the universal adult-credit alternative', () => {
    const settings = { ...defaultSettings, adultCreditMode: 'universal' as const };
    expect(calculateAdultCredit(0, 2, settings)).toBe(9600);
  });

  it('adds the adult-credit phase-out rate to the marginal wedge', () => {
    const result = calculateHousehold(household(100000), defaultSettings);
    expect(result.adultCredit).toBeGreaterThan(0);
    expect(result.reformMarginalRate).toBeCloseTo(0.375, 6);
  });

  it('returns to the statutory marginal rate after the adult credit is exhausted', () => {
    const result = calculateHousehold(household(300000), defaultSettings);
    expect(result.adultCredit).toBe(0);
    expect(result.reformMarginalRate).toBeCloseTo(0.30, 8);
  });

  it('produces finite marginal rates around major current-law and reform kinks', () => {
    for (const wage of [15750, 27675, 50000, 100000, 176100, 200000, 250000]) {
      const result = calculateHousehold(household(wage), defaultSettings);
      expect(Number.isFinite(result.currentMarginalRate)).toBe(true);
      expect(Number.isFinite(result.reformMarginalRate)).toBe(true);
    }
  });

  it('reports the stepped CTC phaseout as a bounded local economic wedge', () => {
    const atPhaseout = calculateHousehold(household(200000, 'single', 1), defaultSettings);
    expect(atPhaseout.currentMarginalRate).toBeGreaterThan(0.25);
    expect(atPhaseout.currentMarginalRate).toBeLessThan(0.50);
  });
});

describe('flat and progressive X-tax wage schedules', () => {
  it('keeps the flat wage-side rate equal to the business rate', () => {
    expect(calculateReformWageTax(100000, 'single', defaultSettings)).toBeCloseTo(30000, 8);
  });

  it('applies zero, middle, and top progressive brackets per adult', () => {
    const settings = { ...defaultSettings, wageTaxMode: 'progressive' as const };
    expect(calculateReformWageTax(20000, 'single', settings)).toBe(0);
    expect(calculateReformWageTax(50000, 'single', settings)).toBeCloseTo(3000, 8);
    expect(calculateReformWageTax(150000, 'single', settings)).toBeCloseTo(25500, 8);
    expect(calculateReformWageTax(50000, 'married', settings)).toBe(0);
  });
});

describe('OECD-style tax-wedge table', () => {
  it('generates all eight standard household patterns from the 2025 average wage', () => {
    const rows = calculateTaxWedgeTable(defaultSettings);
    expect(rows).toHaveLength(8);
    expect(rows[1].primaryWage).toBe(OECD_US_AVERAGE_WAGE_2025);
    expect(rows[5].secondaryWage).toBeCloseTo(OECD_US_AVERAGE_WAGE_2025 * 0.33, 8);
    for (const row of rows) {
      expect(Number.isFinite(row.currentWedge)).toBe(true);
      expect(Number.isFinite(row.reformWedge)).toBe(true);
      expect(row.currentAfterTaxIncome).toBeCloseTo(row.employerCompensation - row.currentTax, 8);
      expect(row.reformAfterTaxIncome).toBeCloseTo(row.employerCompensation - row.reformTax, 8);
      expect(row.afterTaxIncomeChange).toBeCloseTo(row.reformAfterTaxIncome - row.currentAfterTaxIncome, 8);
    }
  });
});
