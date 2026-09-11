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
    expect(report.macro.taxableBase).toBeCloseTo(22311.868575, 6);
    expect(report.macro.netRevenue).toBeCloseTo(5805.845301579439, 6);
    expect(report.macro.revenueNeutralRate).toBeCloseTo(0.2661815728681326, 9);
    expect(report.households).toEqual([
      expect.objectContaining({ currentTax: 6061.5, reformTax: 4888.5, change: 1173 }),
      expect.objectContaining({ currentTax: 19424, reformTax: 21726.5625, change: -2302.5625 }),
      expect.objectContaining({ currentTax: 6790.018, reformTax: 177, change: 6613.017999999996 }),
      expect.objectContaining({ currentTax: 34448, reformTax: 33853.125, change: 594.875 }),
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
