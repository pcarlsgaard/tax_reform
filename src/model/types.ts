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
  federalTransferSavings: number;
  adjustedTargetRevenue: number;
  adjustedTargetRevenuePercentGdp: number;
  surplusDeficit: number;
  surplusDeficitPercentGdp: number;
  adjustedSurplusDeficit: number;
  adjustedSurplusDeficitPercentGdp: number;
  revenueNeutralRate: number;
  adjustedRevenueNeutralRate: number;
  revenueNeutralRateReduction: number;
}

export interface MacroAdjustment {
  /** FY2025 federal program spending removed outside the tax system, in billions. */
  federalTransferSavings?: number;
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
  employerFicaPassThroughRate: number;
  employerFicaPassThrough: number;
  reformGrossResources: number;
  reformWageBase: number;
  currentPreCreditTaxLiability: number;
  currentTaxCredits: number;
  reformTaxBeforeCredits: number;
  adultCreditMaximum: number;
  adultCredit: number;
  childCredit: number;
  totalReformCredit: number;
  retainedCurrentTaxBeforeCredits: number;
  retainedCurrentTaxCredits: number;
  retainedCurrentTaxes: number;
  reformPreCreditTaxLiability: number;
  reformTotalCredits: number;
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

export type TransferProgramId = 'snap' | 'wic' | 'schoolMeals' | 'summerEbt' | 'tanf' | 'liheap' | 'housing';
export type TransferKind = 'cash' | 'near_cash' | 'in_kind';
export type TransferMethod = 'rule_based' | 'preset_assumption' | 'manual_receipt';
export type TransferReceiptMode = 'assumed' | 'user_entered';

export interface TransferReplacementSettings {
  replacedPrograms: Record<TransferProgramId, boolean>;
}

export interface TransferHouseholdInput {
  household: HouseholdInput;
  /** Share of repealed employer FICA converted into reform wages; defaults to 100%. */
  employerFicaPassThroughRate: number;
  preschoolChildren: number;
  schoolAgeChildren: number;
  monthlyShelterCost: number;
  monthlyDependentCareExpense: number;
  inKindValuationFactor: number;
  receives: Record<TransferProgramId, boolean>;
  manualAnnualBenefits: Partial<Record<TransferProgramId, number>>;
}

export interface TransferProgramDefinition {
  id: TransferProgramId;
  name: string;
  shortName: string;
  kind: TransferKind;
  method: TransferMethod;
  financing: string;
  receiptAccess: string;
  federalFiscalAmountBillions: number;
  federalFiscalMeasure: string;
  stateFinancingIncludedBillions: number;
  policyYear: string;
  fiscalYear: string;
  agency: string;
  sourceUrl: string;
  ruleSourceUrl: string;
  householdMethod: string;
  limitations: string[];
}

export interface TransferProgramResult {
  program: TransferProgramDefinition;
  eligible: boolean | null;
  receives: boolean;
  potentialAnnualBenefit: number;
  annualGovernmentBenefit: number;
  resourceEquivalentValue: number;
  valuationFactor: number;
  calculationStatus: 'exact_rule' | 'approximate_rule' | 'illustrative' | 'user_entered';
  calculationNote: string;
}

export interface ResourceScenario {
  annual: number;
  monthly: number;
  fplShare: number;
  changeFromCurrent: number;
  percentChangeFromCurrent: number | null;
}

export interface TransferAnalysisResult {
  tax: HouseholdResult;
  programs: TransferProgramResult[];
  povertyGuideline: number;
  totalCurrentExternalTransfers: number;
  eliminatedHouseholdBenefits: number;
  federalProgramSavingsBillions: number;
  currentLaw: ResourceScenario;
  reformRetained: ResourceScenario;
  reformAfterReplacement: ResourceScenario;
  householdReplacementRatio: number | null;
  heldHarmless: boolean;
}

export interface TransferPreset {
  id: string;
  label: string;
  input: TransferHouseholdInput;
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
