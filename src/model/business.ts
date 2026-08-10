import type { BusinessInput, BusinessResult } from './types';

export const businessPresets: BusinessInput[] = [
  { name: 'Domestic service company', totalSales: 100, domesticInputs: 15, wages: 55, newInvestment: 5, imports: 0, exports: 0 },
  { name: 'Domestic retailer', totalSales: 100, domesticInputs: 60, wages: 20, newInvestment: 5, imports: 0, exports: 0 },
  { name: 'Manufacturer', totalSales: 200, domesticInputs: 60, wages: 70, newInvestment: 30, imports: 20, exports: 30 },
  { name: 'Importer-heavy retailer', totalSales: 120, domesticInputs: 10, wages: 20, newInvestment: 5, imports: 70, exports: 0 },
  { name: 'Exporter / manufacturer', totalSales: 200, domesticInputs: 50, wages: 70, newInvestment: 20, imports: 10, exports: 100 },
];

export function calculateBusiness(input: BusinessInput, rate: number): BusinessResult {
  const operatingCashFlow = input.totalSales
    - input.domesticInputs
    - input.imports
    - input.wages
    - input.newInvestment;
  const borderImportAdjustment = input.imports;
  const borderExportAdjustment = -input.exports;
  const businessTaxBase = operatingCashFlow + borderImportAdjustment + borderExportAdjustment;
  const businessTax = businessTaxBase * rate;
  const wageSideTaxBeforeCredits = input.wages * rate;
  return {
    ...input,
    operatingCashFlow,
    borderImportAdjustment,
    borderExportAdjustment,
    businessTaxBase,
    businessTax,
    wageSideTaxBeforeCredits,
    combinedTaxBeforeHouseholdCredits: businessTax + wageSideTaxBeforeCredits,
  };
}
