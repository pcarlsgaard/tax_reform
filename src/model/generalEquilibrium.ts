import baseline from '../data/baseline_2025.json';
import microdata from '../data/microdata_2025.json';
import { calculateMacro } from './macro';
import type { MacroAdjustment, ReformSettings } from './types';

/** An intentionally small, open-economy, long-run comparative-statics model.
 * Ratios are relative to the same economy under current law, not GDP growth rates.
 * The published Tax Foundation observation is used ONLY to calibrate exposure.
 */
export interface GEParameters {
  capitalShare: number;
  laborElasticity: number;
  realReturn: number;
  depreciation: number;
  baselineBusinessRate: number;
  baselineRecoveryPresentValue: number;
  baselineLaborMarginalRate: number;
  /** Share of modeled capital subject to the changed business user cost. */
  exposedCapitalShare: number;
  /** Share of GDP responding to modeled private production. */
  responsiveOutputShare: number;
  /** Fixed fraction of a change in economic scale reflected in taxable bases. */
  taxBaseOutputElasticity: number;
}

export const referenceParameters: GEParameters = {
  capitalShare: 0.36,
  laborElasticity: 0.30,
  realReturn: 0.05,
  depreciation: 0.08,
  baselineBusinessRate: 0.21,
  baselineRecoveryPresentValue: 0.82,
  // TF 2025 methods, table 4: federal income 19%, federal payroll 8.7%, state income 4.5%.
  baselineLaborMarginalRate: 0.322,
  exposedCapitalShare: 0.35,
  responsiveOutputShare: 1,
  taxBaseOutputElasticity: 1,
};

export interface GEPolicy {
  businessRate: number;
  recoveryPresentValue: number;
  laborMarginalRate: number;
}

export interface GEResult {
  capitalRatio: number;
  hoursRatio: number;
  outputRatio: number;
  gdpRatio: number;
  wageRatio: number;
  userCostRatio: number;
  afterTaxWageRatio: number;
}

function validate(p: GEParameters, policy: GEPolicy) {
  for (const [name, value] of Object.entries({ ...p, ...policy })) {
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  }
  for (const [name, value] of Object.entries({
    capitalShare: p.capitalShare,
    exposedCapitalShare: p.exposedCapitalShare,
    responsiveOutputShare: p.responsiveOutputShare,
    baselineRecoveryPresentValue: p.baselineRecoveryPresentValue,
    recoveryPresentValue: policy.recoveryPresentValue,
  })) {
    if (value < 0 || value > 1) throw new Error(`${name} must be within [0, 1]`);
  }
  if (p.capitalShare === 1 || p.laborElasticity < 0 || p.taxBaseOutputElasticity < 0
    || p.realReturn <= 0 || p.depreciation < 0 || p.baselineBusinessRate < 0
    || p.baselineBusinessRate >= 1 || policy.businessRate < 0 || policy.businessRate >= 1
    || p.baselineLaborMarginalRate >= 1 || policy.laborMarginalRate >= 1) {
    throw new Error('Invalid economic parameter');
  }
}

/** Jorgenson user cost with immediate expensing z=1. The real return is exogenous. */
export function userCost(rate: number, recoveryPV: number, p: GEParameters): number {
  return (p.realReturn + p.depreciation) * (1 - rate * recoveryPV) / (1 - rate);
}

export function solveLongRun(policy: GEPolicy, p: GEParameters = referenceParameters): GEResult {
  validate(p, policy);
  const rawCostRatio = userCost(policy.businessRate, policy.recoveryPresentValue, p)
    / userCost(p.baselineBusinessRate, p.baselineRecoveryPresentValue, p);
  // Geometric aggregation of affected and unaffected capital; no fixed revenue windfall assumed.
  const userCostRatio = rawCostRatio ** p.exposedCapitalShare;
  const capitalPerHour = userCostRatio ** (-1 / (1 - p.capitalShare));
  const wageRatio = capitalPerHour ** p.capitalShare;
  const afterTaxWageRatio = wageRatio * (1 - policy.laborMarginalRate)
    / (1 - p.baselineLaborMarginalRate);
  const hoursRatio = afterTaxWageRatio ** p.laborElasticity;
  const capitalRatio = capitalPerHour * hoursRatio;
  const outputRatio = capitalRatio ** p.capitalShare * hoursRatio ** (1 - p.capitalShare);
  const gdpRatio = 1 + p.responsiveOutputShare * (outputRatio - 1);
  return { capitalRatio, hoursRatio, outputRatio, gdpRatio, wageRatio, userCostRatio, afterTaxWageRatio };
}

/** Combine a separately estimated distributional labor response with the capital equilibrium.
 * Unlike solveLongRun, this does not derive hours from an aggregate marginal tax rate.
 */
export function solveLongRunAtHours(hoursRatio: number,
  businessRate: number, recoveryPresentValue: number,
  p: GEParameters = referenceParameters) {
  validate(p, { businessRate, recoveryPresentValue,
    laborMarginalRate: p.baselineLaborMarginalRate });
  if (!Number.isFinite(hoursRatio) || hoursRatio <= 0) throw new Error('Invalid hours ratio');
  const rawCostRatio = userCost(businessRate, recoveryPresentValue, p)
    / userCost(p.baselineBusinessRate, p.baselineRecoveryPresentValue, p);
  const userCostRatio = rawCostRatio ** p.exposedCapitalShare;
  const capitalPerHourRatio = userCostRatio ** (-1 / (1 - p.capitalShare));
  const capitalRatio = hoursRatio * capitalPerHourRatio;
  const wageRatio = capitalPerHourRatio ** p.capitalShare;
  const outputRatio = capitalRatio ** p.capitalShare * hoursRatio ** (1 - p.capitalShare);
  const gdpRatio = 1 + p.responsiveOutputShare * (outputRatio - 1);
  return { capitalRatio, hoursRatio, capitalPerHourRatio, outputRatio, gdpRatio,
    wageRatio, userCostRatio };
}

/** In-sample calibration on ONE published statistic; the other statistics are checks. */
export function calibrateExposure(targetCapitalRatio: number, policy: GEPolicy,
  p: GEParameters = referenceParameters): GEParameters {
  if (!Number.isFinite(targetCapitalRatio) || targetCapitalRatio <= 0) throw new Error('Invalid capital target');
  const low = solveLongRun(policy, { ...p, exposedCapitalShare: 0 }).capitalRatio;
  const high = solveLongRun(policy, { ...p, exposedCapitalShare: 1 }).capitalRatio;
  if (targetCapitalRatio < Math.min(low, high) || targetCapitalRatio > Math.max(low, high)) {
    throw new Error('Capital target is outside the feasible exposure range');
  }
  let a = 0; let b = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (a + b) / 2;
    const value = solveLongRun(policy, { ...p, exposedCapitalShare: mid }).capitalRatio;
    if ((value < targetCapitalRatio) === (low < high)) a = mid;
    else b = mid;
  }
  return { ...p, exposedCapitalShare: (a + b) / 2 };
}

export const taxFoundationDBCFT = {
  policy: { businessRate: 0.21, recoveryPresentValue: 1, laborMarginalRate: 0.322 },
  capitalRatio: 1.026,
  gdpRatio: 1.014,
  wageRatio: 1.013,
  fullTimeEquivalentJobs: 463000,
  // 2027-2036: changes in primary deficit, not comparable to FY2025 static score.
  conventionalPrimaryDeficitBillions: -2334.7,
  dynamicPrimaryDeficitBillions: -3276.6,
};

type DistributionCell = [number, number, number, number];

/** Compensation-weighted marginal rate proxy from actual ASEC cells, including earned-credit slopes.
 * This is a tax-unit approximation; it does not identify individual worker participation responses.
 */
export function estimateReformLaborMarginalRate(settings: ReformSettings): number {
  const cashScale = microdata.calibration.cashWageScaleToBea2025;
  const compensationRatio = baseline.components.compensation / baseline.compensationComponents.cashWagesAndSalaries;
  const taxableRatio = 1
    - (baseline.compensationComponents.cashWagesAndSalaries * settings.cashWageExemptionShare
      + baseline.compensationComponents.employerGovernmentSocialInsurance * settings.employerSocialInsuranceExemptionShare
      + baseline.compensationComponents.employerHealthInsurance * settings.employerHealthInsuranceExemptionShare
      + baseline.compensationComponents.employerPensionAndOtherInsurance * settings.employerPensionOtherInsuranceExemptionShare)
      / baseline.components.compensation;
  let rateSum = 0; let weightSum = 0;
  for (const row of microdata.distribution as DistributionCell[]) {
    const [cash, scheduleAdults, creditAdults, weight] = row;
    const compensation = cash * cashScale * compensationRatio;
    if (compensation <= 0 || weight <= 0) continue;
    const taxable = compensation * taxableRatio;
    const zero = scheduleAdults * settings.progressiveZeroBracketPerAdult;
    const top = Math.max(zero, scheduleAdults * settings.progressiveTopBracketPerAdult);
    const intermediateStart = settings.progressiveIntermediateStartPerAdult === null
      ? top : Math.max(zero, Math.min(top,
        scheduleAdults * settings.progressiveIntermediateStartPerAdult));
    const wageRate = settings.wageTaxMode === 'flat' ? settings.rate
      : taxable < zero ? 0 : taxable < intermediateStart
        ? Math.min(settings.rate, settings.progressiveMiddleRate)
        : taxable < top
          ? Math.min(settings.rate, Math.max(settings.progressiveMiddleRate,
            settings.progressiveIntermediateRate)) : settings.rate;
    let creditSlope = 0;
    if (settings.adultCreditMode === 'earned' && creditAdults > 0 && settings.adultCredit > 0) {
      const max = creditAdults * settings.adultCredit;
      const phaseIn = Math.min(max, compensation * settings.adultCreditPhaseInRate);
      const phaseOut = Math.max(0, compensation - creditAdults * settings.adultCreditPhaseOutStartPerAdult)
        * settings.adultCreditPhaseOutRate;
      if (phaseIn > phaseOut && phaseOut > 0) creditSlope = -settings.adultCreditPhaseOutRate;
      else if (phaseIn > phaseOut && phaseIn < max) creditSlope = settings.adultCreditPhaseInRate;
    }
    const federal = (wageRate * taxableRatio - creditSlope * settings.adultCreditTakeUpRate)
      * (1 - settings.noncomplianceRate) * (1 - settings.exemptionShare);
    // State income remains in place; federal legacy taxes are retained only if not replaced.
    const total = 0.045 + federal + (settings.replacedTaxes.individualIncome ? 0 : 0.19)
      + (settings.replacedTaxes.payroll ? 0 : 0.087);
    rateSum += weight * compensation * total;
    weightSum += weight * compensation;
  }
  return rateSum / weightSum;
}

/** @deprecated Diagnostic of the original aggregate-wedge approximation. It
 * must not be presented as the current X-tax result. Use the sampled worker
 * analysis in scripts/estimate_labor_response.py and solveLongRunAtHours.
 */
export function scoreLongRunReform(settings: ReformSettings,
  p: GEParameters = referenceParameters, adjustment: MacroAdjustment = {}) {
  const staticScore = calculateMacro(settings, adjustment);
  const laborMarginalRate = estimateReformLaborMarginalRate(settings);
  const equilibrium = solveLongRun({ businessRate: settings.rate, recoveryPresentValue: 1,
    laborMarginalRate }, p);
  // Fixed-credit fiscal feedback approximation; no time path or current-law revenue re-simulation.
  const wageScale = equilibrium.wageRatio * equilibrium.hoursRatio;
  const businessScale = equilibrium.outputRatio ** p.taxBaseOutputElasticity;
  const wageFeedback = settings.rate * staticScore.rateAdjustedWageBase * (wageScale - 1);
  const businessFeedback = settings.rate * staticScore.businessTaxableBase * (businessScale - 1);
  return { staticScore, laborMarginalRate, equilibrium,
    illustrativeReformRevenueFeedbackBillions: wageFeedback + businessFeedback,
    illustrativeDynamicDeficitReductionBillions: staticScore.deficitReduction
      + wageFeedback + businessFeedback };
}
