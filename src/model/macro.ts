import baseline from '../data/baseline_2024.json';
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

  const adultCreditCost = baseline.populationsMillions.adults * settings.adultCredit / 1000;
  const childCreditCost = baseline.populationsMillions.children * settings.childCredit / 1000;
  const otherRebates = 0;
  const grossRevenue = taxableBase * settings.rate;
  const netRevenue = grossRevenue - adultCreditCost - childCreditCost - otherRebates;

  const targetRevenue = receiptKeys.reduce(
    (sum, key) => sum + (settings.replacedTaxes[key] ? baseline.federalReceipts[key] : 0),
    0,
  );
  const revenueNeutralRate = taxableBase > 0
    ? (targetRevenue + adultCreditCost + childCreditCost + otherRebates) / taxableBase
    : Number.POSITIVE_INFINITY;

  return {
    gdp: baseline.gdp,
    theoreticalBase,
    noncomplianceLoss,
    baseAfterCompliance,
    exemptionLoss,
    taxableBase,
    basePercentGdp: taxableBase / baseline.gdp,
    grossRevenue,
    adultCreditCost,
    childCreditCost,
    otherRebates,
    netRevenue,
    targetRevenue,
    surplusDeficit: netRevenue - targetRevenue,
    revenueNeutralRate,
  };
}

export const defaultSettings: ReformSettings = {
  rate: 0.30,
  adultCredit: 4800,
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
