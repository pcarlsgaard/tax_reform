import { describe, expect, it } from 'vitest';
import { businessPresets, calculateBusiness, calculateHousehold, calculateMacro, defaultSettings } from '../src/model';

describe('end-to-end regression fixtures', () => {
  it('reports default national, household, and business scenarios', () => {
    const report = {
      macro: calculateMacro(defaultSettings),
      households: [
        calculateHousehold({ filingStatus: 'single', children: 0, cashWage: 30000 }, defaultSettings),
        calculateHousehold({ filingStatus: 'single', children: 0, cashWage: 75000 }, defaultSettings),
        calculateHousehold({ filingStatus: 'married', children: 2, cashWage: 60000 }, defaultSettings),
        calculateHousehold({ filingStatus: 'married', children: 2, cashWage: 150000 }, defaultSettings),
      ].map((row) => ({
        input: row.input,
        employerCompensation: row.employerCompensation,
        currentTax: row.current.totalFederalTax,
        reformTax: row.reformTaxAfterCredits,
        currentDisposable: row.currentDisposableResources,
        reformDisposable: row.reformDisposableResources,
        change: row.dollarChange,
        currentAverageRate: row.currentAverageRate,
        reformAverageRate: row.reformAverageRate,
      })),
      businesses: businessPresets.map((preset) => {
        const row = calculateBusiness(preset, defaultSettings.rate);
        return { name: row.name, base: row.businessTaxBase, tax: row.businessTax, combined: row.combinedTaxBeforeHouseholdCredits };
      }),
    };
    expect(report.macro.taxableBase).toBeCloseTo(21057.5325, 6);
    expect(report.macro.netRevenue).toBeCloseTo(4684.77975, 6);
    expect(report.macro.revenueNeutralRate).toBeCloseTo(0.3027173293, 9);
    expect(report.households).toEqual([
      expect.objectContaining({ currentTax: 6206, reformTax: 4888.5, change: 1317.5 }),
      expect.objectContaining({ currentTax: 19816, reformTax: 19421.25, change: 394.75 }),
      expect.objectContaining({ currentTax: 7845.816000000001, reformTax: 177, change: 7668.815999999999 }),
      expect.objectContaining({ currentTax: 35632, reformTax: 29242.5, change: 6389.5 }),
    ]);
    expect(report.businesses).toEqual([
      { name: 'Domestic service company', base: 25, tax: 7.5, combined: 24 },
      { name: 'Domestic retailer', base: 15, tax: 4.5, combined: 10.5 },
      { name: 'Manufacturer', base: 10, tax: 3, combined: 24 },
      { name: 'Importer-heavy retailer', base: 85, tax: 25.5, combined: 31.5 },
      { name: 'Exporter / manufacturer', base: -40, tax: -12, combined: 9 },
    ]);
  });
});
