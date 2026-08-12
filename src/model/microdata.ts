import baseline from '../data/baseline_2025.json';
import microdataJson from '../data/microdata_2025.json';
import type { ReformSettings } from './types';

type DistributionCell = [
  asecCashWageDollars: number,
  scheduleAdults: number,
  creditAdults: number,
  taxUnitWeight: number,
];

export interface MicrodataScore {
  grossCompensationBase: number;
  taxableCompensationBase: number;
  exemptCompensationBase: number;
  progressiveEquivalentCompensationBase: number;
  progressiveAverageWageRateShare: number;
  adultCreditStatutoryCost: number;
  adultCreditCost: number;
}

function share(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function adultCredit(compensation: number, adults: number, settings: ReformSettings): number {
  if (adults <= 0) return 0;
  const maximum = adults * settings.adultCredit;
  if (settings.adultCreditMode === 'universal') return maximum;
  const phaseIn = Math.min(maximum, compensation * settings.adultCreditPhaseInRate);
  const phaseOutStart = adults * settings.adultCreditPhaseOutStartPerAdult;
  const phaseOut = Math.max(0, compensation - phaseOutStart) * settings.adultCreditPhaseOutRate;
  return Math.max(0, phaseIn - phaseOut);
}

function progressiveEquivalentBase(compensation: number, scheduleAdults: number, settings: ReformSettings): number {
  const zeroCeiling = scheduleAdults * settings.progressiveZeroBracketPerAdult;
  const topThreshold = Math.max(zeroCeiling, scheduleAdults * settings.progressiveTopBracketPerAdult);
  const middleBase = Math.max(0, Math.min(compensation, topThreshold) - zeroCeiling);
  const topBase = Math.max(0, compensation - topThreshold);
  return middleBase * settings.progressiveMiddleRateShare + topBase;
}

export function calculateMicrodataScore(settings: ReformSettings): MicrodataScore {
  const controls = microdataJson.compensationControlsBillions;
  const cashScale = microdataJson.calibration.cashWageScaleToBea2025;
  const socialInsurancePerCashDollar = controls.employerGovernmentSocialInsurance / controls.cashWagesAndSalaries;
  const pensionInsurancePerCashDollar = controls.employerPensionAndInsurance / controls.cashWagesAndSalaries;
  const adultPopulationScale = microdataJson.calibration.adultPopulationScaleToCensus2025;
  const cashTaxableShare = 1 - share(settings.cashWageExemptionShare);
  const socialTaxableShare = 1 - share(settings.employerSocialInsuranceExemptionShare);
  const pensionTaxableShare = 1 - share(settings.employerPensionInsuranceExemptionShare);

  let progressiveBaseDollars = 0;
  let statutoryAdultCreditDollars = 0;
  for (const rawCell of microdataJson.distribution) {
    const [asecCashWage, scheduleAdults, creditAdults, taxUnitWeight] = rawCell as DistributionCell;
    const projectedCashWage = asecCashWage * cashScale;
    const employerSocialInsurance = projectedCashWage * socialInsurancePerCashDollar;
    const employerPensionInsurance = projectedCashWage * pensionInsurancePerCashDollar;
    const grossCompensation = projectedCashWage + employerSocialInsurance + employerPensionInsurance;
    const taxableCompensation = projectedCashWage * cashTaxableShare
      + employerSocialInsurance * socialTaxableShare
      + employerPensionInsurance * pensionTaxableShare;
    progressiveBaseDollars += taxUnitWeight
      * progressiveEquivalentBase(taxableCompensation, scheduleAdults, settings);
    statutoryAdultCreditDollars += taxUnitWeight
      * adultCredit(grossCompensation, creditAdults, settings);
  }

  const grossCompensationBase = baseline.components.compensation;
  const exemptCompensationBase = controls.cashWagesAndSalaries * share(settings.cashWageExemptionShare)
    + controls.employerGovernmentSocialInsurance * share(settings.employerSocialInsuranceExemptionShare)
    + controls.employerPensionAndInsurance * share(settings.employerPensionInsuranceExemptionShare);
  const taxableCompensationBase = grossCompensationBase - exemptCompensationBase;
  const adultCreditStatutoryCost = settings.adultCreditMode === 'universal'
    ? baseline.populationsMillions.adults * settings.adultCredit / 1000
    : statutoryAdultCreditDollars * adultPopulationScale / 1e9;
  const adultCreditCost = adultCreditStatutoryCost * share(settings.adultCreditTakeUpRate);

  return {
    grossCompensationBase,
    taxableCompensationBase,
    exemptCompensationBase,
    progressiveEquivalentCompensationBase: progressiveBaseDollars / 1e9,
    progressiveAverageWageRateShare: taxableCompensationBase > 0
      ? (progressiveBaseDollars / 1e9) / taxableCompensationBase
      : 0,
    adultCreditStatutoryCost,
    adultCreditCost,
  };
}

export const microdata2025 = microdataJson;
