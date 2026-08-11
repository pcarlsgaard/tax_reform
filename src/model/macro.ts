import baseline from '../data/baseline_2025.json';
import type { MacroResult, ReformSettings, ReplacedTax } from './types';

const receiptKeys: ReplacedTax[] = ['individualIncome', 'payroll', 'corporateIncome', 'customs'];

export function theoreticalConsumptionBase(): number {
  const c = baseline.components;
  return c.compensation + c.netCapitalIncomeAfterInvestment + c.netImports + c.housingAdjustment;
}

export function calculateMacro(settings: ReformSettings): MacroResult {
  const theoreticalBase = theoreticalConsumptionBase();
  const noncomplianceLoss = theoreticalBase * settings.noncomplianceRate;
  const baseAfterCompliance = theoreticalBase - noncomplianceLoss;
  const exemptionLoss = baseAfterCompliance * settings.exemptionShare;
  const taxableBase = baseAfterCompliance - exemptionLoss;
  const retainedBaseShare = (1 - settings.noncomplianceRate) * (1 - settings.exemptionShare);
  const wageTaxableBase = baseline.components.compensation * retainedBaseShare;
  const businessTaxableBase = taxableBase - wageTaxableBase;
  const wageRateFactor = settings.wageTaxMode === 'flat' ? 1 : settings.progressiveAverageWageRateShare;
  const rateAdjustedBase = businessTaxableBase + wageTaxableBase * wageRateFactor;

  const adultBudgetShare = settings.adultCreditMode === 'universal' ? 1 : settings.adultCreditBudgetShare;
  const adultCreditCost = baseline.populationsMillions.adults * settings.adultCredit * adultBudgetShare / 1000;
  const childCreditCost = baseline.populationsMillions.children * settings.childCredit / 1000;
  const otherRebates = 0;
  const grossRevenue = rateAdjustedBase * settings.rate;
  const netRevenue = grossRevenue - adultCreditCost - childCreditCost - otherRebates;

  const targetRevenue = receiptKeys.reduce(
    (sum, key) => sum + (settings.replacedTaxes[key] ? baseline.federalReceipts[key] : 0),
    0,
  );
  const revenueNeutralRate = rateAdjustedBase > 0
    ? (targetRevenue + adultCreditCost + childCreditCost + otherRebates) / rateAdjustedBase
    : Number.POSITIVE_INFINITY;

  return {
    gdp: baseline.gdp,
    theoreticalBase,
    noncomplianceLoss,
    baseAfterCompliance,
    exemptionLoss,
    taxableBase,
    basePercentGdp: taxableBase / baseline.gdp,
    wageTaxableBase,
    businessTaxableBase,
    rateAdjustedBase,
    grossRevenue,
    grossRevenuePercentGdp: grossRevenue / baseline.gdp,
    adultCreditCost,
    childCreditCost,
    otherRebates,
    creditCostPercentGdp: (adultCreditCost + childCreditCost + otherRebates) / baseline.gdp,
    netRevenue,
    netRevenuePercentGdp: netRevenue / baseline.gdp,
    targetRevenue,
    targetRevenuePercentGdp: targetRevenue / baseline.gdp,
    surplusDeficit: netRevenue - targetRevenue,
    surplusDeficitPercentGdp: (netRevenue - targetRevenue) / baseline.gdp,
    revenueNeutralRate,
  };
}

export const defaultSettings: ReformSettings = {
  rate: 0.30,
  wageTaxMode: 'flat',
  progressiveZeroBracketPerAdult: 30000,
  progressiveTopBracketPerAdult: 100000,
  progressiveMiddleRateShare: 0.5,
  progressiveAverageWageRateShare: 0.65,
  adultCredit: 4800,
  adultCreditMode: 'earned',
  adultCreditPhaseInRate: 0.30,
  adultCreditPhaseOutStartPerAdult: 50000,
  adultCreditPhaseOutRate: 0.075,
  adultCreditBudgetShare: 0.75,
  childCredit: 4800,
  noncomplianceRate: baseline.defaultNoncomplianceRate,
  exemptionShare: baseline.defaultExemptionShare,
  replacedTaxes: {
    individualIncome: true,
    payroll: true,
    corporateIncome: true,
    customs: true,
  },
};

export { baseline };
