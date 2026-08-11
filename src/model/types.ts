export type FilingStatus = 'single' | 'married';
export type ReplacedTax = 'individualIncome' | 'payroll' | 'corporateIncome' | 'customs';
export type AdultCreditMode = 'universal' | 'earned';
export type WageTaxMode = 'flat' | 'progressive';

export interface ReformSettings {
  rate: number;
  wageTaxMode: WageTaxMode;
  progressiveZeroBracketPerAdult: number;
  progressiveTopBracketPerAdult: number;
  progressiveMiddleRateShare: number;
  progressiveAverageWageRateShare: number;
  adultCredit: number;
  adultCreditMode: AdultCreditMode;
  adultCreditPhaseInRate: number;
  adultCreditPhaseOutStartPerAdult: number;
  adultCreditPhaseOutRate: number;
  adultCreditBudgetShare: number;
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
  wageTaxableBase: number;
  businessTaxableBase: number;
  rateAdjustedBase: number;
  grossRevenue: number;
  grossRevenuePercentGdp: number;
  adultCreditCost: number;
  childCreditCost: number;
  otherRebates: number;
  creditCostPercentGdp: number;
  netRevenue: number;
  netRevenuePercentGdp: number;
  targetRevenue: number;
  targetRevenuePercentGdp: number;
  surplusDeficit: number;
  surplusDeficitPercentGdp: number;
  revenueNeutralRate: number;
}

export interface HouseholdInput {
  filingStatus: FilingStatus;
  children: number;
  /** Primary earner's annual cash wage. */
  cashWage: number;
  /** Second earner's wage; used only for married-joint examples. */
  secondaryCashWage?: number;
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
  totalCashWage: number;
  employerCompensation: number;
  reformWageBase: number;
  reformTaxBeforeCredits: number;
  adultCreditMaximum: number;
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

export interface TaxWedgeScenario {
  id: string;
  label: string;
  filingStatus: FilingStatus;
  children: number;
  primaryWageShare: number;
  secondaryWageShare: number;
}

export interface TaxWedgeRow extends TaxWedgeScenario {
  primaryWage: number;
  secondaryWage: number;
  employerCompensation: number;
  currentTax: number;
  reformTax: number;
  currentAfterTaxIncome: number;
  reformAfterTaxIncome: number;
  afterTaxIncomeChange: number;
  currentWedge: number;
  reformWedge: number;
  changePercentagePoints: number;
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
