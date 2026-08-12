import baseline from '../data/baseline_2025.json';
import refundableTaxCreditOutlaysJson from '../data/refundable_tax_credit_outlays_2025.json';
import { calculateMicrodataScore } from './microdata';
import type { MacroAdjustment, MacroResult, ReformSettings, ReplacedTax, RefundableTaxCreditOutlayData } from './types';

const receiptKeys: ReplacedTax[] = ['individualIncome', 'payroll', 'corporateIncome', 'customs'];

export const refundableTaxCreditOutlays = refundableTaxCreditOutlaysJson as RefundableTaxCreditOutlayData;
export const totalRefundableTaxCreditOutlays = refundableTaxCreditOutlays.items.reduce(
  (sum, item) => sum + item.actualOutlaysBillions,
  0,
);

export function theoreticalConsumptionBase(): number {
  const c = baseline.components;
  return c.compensation + c.netCapitalIncomeAfterInvestment + c.netImports + c.housingAdjustment;
}

export function calculateMacro(settings: ReformSettings, adjustment: MacroAdjustment = {}): MacroResult {
  const theoreticalBase = theoreticalConsumptionBase();
  const noncomplianceLoss = theoreticalBase * settings.noncomplianceRate;
  const baseAfterCompliance = theoreticalBase - noncomplianceLoss;
  const retainedBaseShare = (1 - settings.noncomplianceRate) * (1 - settings.exemptionShare);
  const microdata = calculateMicrodataScore(settings);
  const broadPolicyExemptionLoss = baseAfterCompliance * settings.exemptionShare;
  const compensationExemptionLoss = microdata.exemptCompensationBase * retainedBaseShare;
  const exemptionLoss = broadPolicyExemptionLoss + compensationExemptionLoss;
  const businessTaxableBase = (theoreticalBase - baseline.components.compensation) * retainedBaseShare;
  const wageTaxableBase = microdata.taxableCompensationBase * retainedBaseShare;
  const taxableBase = businessTaxableBase + wageTaxableBase;
  const rateAdjustedWageBase = settings.wageTaxMode === 'flat'
    ? wageTaxableBase
    : microdata.progressiveEquivalentCompensationBase * retainedBaseShare;
  const rateAdjustedBase = businessTaxableBase + rateAdjustedWageBase;

  const adultCreditStatutoryCost = microdata.adultCreditStatutoryCost;
  const adultCreditCost = microdata.adultCreditCost;
  const childCreditCost = baseline.populationsMillions.children * settings.childCredit / 1000;
  const otherRebates = 0;
  const grossRevenue = rateAdjustedBase * settings.rate;
  const netRevenue = grossRevenue - adultCreditCost - childCreditCost - otherRebates;

  const targetRevenue = receiptKeys.reduce(
    (sum, key) => sum + (settings.replacedTaxes[key] ? baseline.federalReceipts[key] : 0),
    0,
  );
  const refundableTaxCreditOutlaySavings = settings.replacedTaxes.individualIncome
    ? totalRefundableTaxCreditOutlays
    : 0;
  const federalTransferSavings = Math.max(0, adjustment.federalTransferSavings ?? 0);
  const totalFederalSavings = refundableTaxCreditOutlaySavings + federalTransferSavings;
  const adjustedTargetRevenue = Math.max(0, targetRevenue - totalFederalSavings);
  const revenueNeutralRate = rateAdjustedBase > 0
    ? (targetRevenue + adultCreditCost + childCreditCost + otherRebates) / rateAdjustedBase
    : Number.POSITIVE_INFINITY;
  const adjustedRevenueNeutralRate = rateAdjustedBase > 0
    ? (adjustedTargetRevenue + adultCreditCost + childCreditCost + otherRebates) / rateAdjustedBase
    : Number.POSITIVE_INFINITY;

  return {
    gdp: baseline.gdp,
    theoreticalBase,
    noncomplianceLoss,
    baseAfterCompliance,
    broadPolicyExemptionLoss,
    compensationExemptionLoss,
    exemptionLoss,
    taxableBase,
    basePercentGdp: taxableBase / baseline.gdp,
    wageTaxableBase,
    businessTaxableBase,
    rateAdjustedWageBase,
    microdataAverageWageRateShare: microdata.progressiveAverageWageRateShare,
    rateAdjustedBase,
    grossRevenue,
    grossRevenuePercentGdp: grossRevenue / baseline.gdp,
    adultCreditStatutoryCost,
    adultCreditCost,
    adultCreditTakeUpRate: settings.adultCreditTakeUpRate,
    childCreditCost,
    otherRebates,
    creditCostPercentGdp: (adultCreditCost + childCreditCost + otherRebates) / baseline.gdp,
    netRevenue,
    netRevenuePercentGdp: netRevenue / baseline.gdp,
    targetRevenue,
    targetRevenuePercentGdp: targetRevenue / baseline.gdp,
    refundableTaxCreditOutlaySavings,
    refundableTaxCreditOutlaySavingsPercentGdp: refundableTaxCreditOutlaySavings / baseline.gdp,
    federalTransferSavings,
    totalFederalSavings,
    totalFederalSavingsPercentGdp: totalFederalSavings / baseline.gdp,
    adjustedTargetRevenue,
    adjustedTargetRevenuePercentGdp: adjustedTargetRevenue / baseline.gdp,
    surplusDeficit: netRevenue - targetRevenue,
    surplusDeficitPercentGdp: (netRevenue - targetRevenue) / baseline.gdp,
    adjustedSurplusDeficit: netRevenue - adjustedTargetRevenue,
    adjustedSurplusDeficitPercentGdp: (netRevenue - adjustedTargetRevenue) / baseline.gdp,
    revenueNeutralRate,
    adjustedRevenueNeutralRate,
    revenueNeutralRateReduction: revenueNeutralRate - adjustedRevenueNeutralRate,
  };
}

export const defaultSettings: ReformSettings = {
  rate: 0.30,
  wageTaxMode: 'flat',
  progressiveZeroBracketPerAdult: 30000,
  progressiveTopBracketPerAdult: 100000,
  progressiveMiddleRateShare: 0.5,
  adultCredit: 4800,
  adultCreditMode: 'earned',
  adultCreditPhaseInRate: 0.30,
  adultCreditPhaseOutStartPerAdult: 50000,
  adultCreditPhaseOutRate: 0.075,
  adultCreditTakeUpRate: 1,
  childCredit: 4800,
  noncomplianceRate: baseline.defaultNoncomplianceRate,
  exemptionShare: baseline.defaultExemptionShare,
  cashWageExemptionShare: 0,
  employerSocialInsuranceExemptionShare: 0,
  employerPensionInsuranceExemptionShare: 0,
  replacedTaxes: {
    individualIncome: true,
    payroll: true,
    corporateIncome: true,
    customs: true,
  },
};

export { baseline };
