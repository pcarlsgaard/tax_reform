export type FilingStatus = 'single' | 'married';
export type ReplacedTax = 'individualIncome' | 'payroll' | 'corporateIncome' | 'customs';

export interface ReformSettings {
  rate: number;
  adultCredit: number;
  childCredit: number;
  noncomplianceRate: number;
  exemptionShare: number;
  replacedTaxes: Record<ReplacedTax, boolean>;
}

export interface MacroResult {
  gdp: number;
  theoreticalBase: number;
  noncomplianceLoss: number;
  baseAfterCompliance: number;
  exemptionLoss: number;
  taxableBase: number;
  basePercentGdp: number;
  grossRevenue: number;
  adultCreditCost: number;
  childCreditCost: number;
  otherRebates: number;
  netRevenue: number;
  targetRevenue: number;
  surplusDeficit: number;
  revenueNeutralRate: number;
}

export interface HouseholdInput {
  filingStatus: FilingStatus;
  children: number;
  cashWage: number;
}

export interface TaxBreakdown {
  incomeTaxBeforeCredits: number;
  nonrefundableCtc: number;
  refundableCtc: number;
  eitc: number;
  individualIncomeTax: number;
  employeeSocialSecurity: number;
  employerSocialSecurity: number;
  employeeMedicare: number;
  employerMedicare: number;
  additionalMedicare: number;
  employeePayrollTax: number;
  employerPayrollTax: number;
  totalFederalTax: number;
}

export interface HouseholdResult {
  input: HouseholdInput;
  current: TaxBreakdown;
  employerCompensation: number;
  reformWageBase: number;
  reformTaxBeforeCredits: number;
  adultCredit: number;
  childCredit: number;
  totalReformCredit: number;
  retainedCurrentTaxes: number;
  reformTaxAfterCredits: number;
  currentDisposableResources: number;
  reformDisposableResources: number;
  dollarChange: number;
  percentChange: number | null;
  currentAverageRate: number;
  reformAverageRate: number;
  currentMarginalRate: number;
  reformMarginalRate: number;
}

export interface BusinessInput {
  name: string;
  totalSales: number;
  domesticInputs: number;
  wages: number;
  newInvestment: number;
  imports: number;
  exports: number;
}

export interface BusinessResult extends BusinessInput {
  operatingCashFlow: number;
  borderImportAdjustment: number;
  borderExportAdjustment: number;
  businessTaxBase: number;
  businessTax: number;
  wageSideTaxBeforeCredits: number;
  combinedTaxBeforeHouseholdCredits: number;
}
