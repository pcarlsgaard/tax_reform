import { describe, expect, it } from 'vitest';
import { businessPresets, calculateBusiness } from '../src/model';

describe('business cash-flow calculation', () => {
  it('expenses new investment immediately', () => {
    const base = calculateBusiness(businessPresets[0], 0.30);
    const extraInvestment = calculateBusiness({ ...businessPresets[0], newInvestment: businessPresets[0].newInvestment + 10 }, 0.30);
    expect(extraInvestment.businessTaxBase).toBeCloseTo(base.businessTaxBase - 10, 8);
    expect(extraInvestment.businessTax).toBeCloseTo(base.businessTax - 3, 8);
  });

  it('adds imported inputs back so they are not deductible', () => {
    const result = calculateBusiness(businessPresets[3], 0.30);
    expect(result.operatingCashFlow).toBe(15);
    expect(result.borderImportAdjustment).toBe(70);
    expect(result.businessTaxBase).toBe(85);
  });

  it('excludes exports from the destination base', () => {
    const result = calculateBusiness(businessPresets[4], 0.30);
    expect(result.borderExportAdjustment).toBe(-100);
    expect(result.businessTaxBase).toBe(-40);
  });

  it('deducts domestic inputs and wages', () => {
    const result = calculateBusiness(businessPresets[1], 0.30);
    expect(result.businessTaxBase).toBe(15);
    expect(result.businessTax).toBeCloseTo(4.5, 8);
    expect(result.wageSideTaxBeforeCredits).toBeCloseTo(6, 8);
    expect(result.combinedTaxBeforeHouseholdCredits).toBeCloseTo(10.5, 8);
  });
});
