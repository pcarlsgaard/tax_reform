import baseline from '../data/baseline_2025.json';
import microdataJson from '../data/microdata_2025.json';
import type {
  AdultCreditAudit,
  AdultCreditAuditBucket,
  AdultCreditAuditBucketId,
  ReformSettings,
} from './types';

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
  adultCreditAudit: AdultCreditAudit;
}

interface AdultCreditCalculation {
  maximum: number;
  phaseIn: number;
  phaseOut: number;
  credit: number;
}

interface AdultCreditBucketAccumulator {
  taxUnits: number;
  adults: number;
  statutoryCost: number;
}

const adultCreditBucketOrder: AdultCreditAuditBucketId[] = [
  'noEligibleAdult',
  'zeroCompensation',
  'phaseIn',
  'fullCredit',
  'phaseInPhaseOutOverlap',
  'phaseOut',
  'fullyPhasedOut',
  'noCreditUnderSchedule',
  'universalCredit',
];

function share(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function adultCredit(compensation: number, adults: number, settings: ReformSettings): AdultCreditCalculation {
  if (adults <= 0) return { maximum: 0, phaseIn: 0, phaseOut: 0, credit: 0 };
  const maximum = adults * settings.adultCredit;
  if (settings.adultCreditMode === 'universal') {
    return { maximum, phaseIn: maximum, phaseOut: 0, credit: maximum };
  }
  const phaseIn = Math.min(maximum, compensation * settings.adultCreditPhaseInRate);
  const phaseOutStart = adults * settings.adultCreditPhaseOutStartPerAdult;
  const phaseOut = Math.max(0, compensation - phaseOutStart) * settings.adultCreditPhaseOutRate;
  return { maximum, phaseIn, phaseOut, credit: Math.max(0, phaseIn - phaseOut) };
}

function adultCreditBucket(
  compensation: number,
  adults: number,
  calculation: AdultCreditCalculation,
  mode: ReformSettings['adultCreditMode'],
): AdultCreditAuditBucketId {
  if (adults <= 0) return 'noEligibleAdult';
  if (mode === 'universal') return 'universalCredit';
  if (compensation <= 0) return 'zeroCompensation';

  const tolerance = 1e-7;
  if (calculation.credit <= tolerance) {
    return calculation.maximum > tolerance && calculation.phaseOut > tolerance
      ? 'fullyPhasedOut'
      : 'noCreditUnderSchedule';
  }
  if (calculation.phaseOut > tolerance && calculation.phaseIn < calculation.maximum - tolerance) {
    return 'phaseInPhaseOutOverlap';
  }
  if (calculation.phaseOut > tolerance) return 'phaseOut';
  if (calculation.credit >= calculation.maximum - tolerance) return 'fullCredit';
  return 'phaseIn';
}

function zeroCreditCompensationPerAdult(settings: ReformSettings): number | null {
  if (settings.adultCreditMode === 'universal' || settings.adultCreditPhaseOutRate <= 0) return null;
  if (settings.adultCredit <= 0 || settings.adultCreditPhaseInRate <= 0) return 0;

  const maximumReachedAt = settings.adultCredit / settings.adultCreditPhaseInRate;
  const phaseOutStart = settings.adultCreditPhaseOutStartPerAdult;
  if (phaseOutStart < maximumReachedAt
    && settings.adultCreditPhaseOutRate > settings.adultCreditPhaseInRate) {
    const overlapExhaustion = settings.adultCreditPhaseOutRate * phaseOutStart
      / (settings.adultCreditPhaseOutRate - settings.adultCreditPhaseInRate);
    if (overlapExhaustion <= maximumReachedAt) return overlapExhaustion;
  }
  return phaseOutStart + settings.adultCredit / settings.adultCreditPhaseOutRate;
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
  let totalTaxUnits = 0;
  let totalAdults = 0;
  let positiveCreditTaxUnits = 0;
  let adultsInPositiveCreditUnits = 0;
  const auditBuckets = new Map<AdultCreditAuditBucketId, AdultCreditBucketAccumulator>(
    adultCreditBucketOrder.map((id) => [id, { taxUnits: 0, adults: 0, statutoryCost: 0 }]),
  );
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
    const creditCalculation = adultCredit(grossCompensation, creditAdults, settings);
    const calibratedAdults = taxUnitWeight * creditAdults * adultPopulationScale;
    const calibratedCreditCost = taxUnitWeight * creditCalculation.credit * adultPopulationScale;
    const bucket = auditBuckets.get(adultCreditBucket(
      grossCompensation,
      creditAdults,
      creditCalculation,
      settings.adultCreditMode,
    ));
    if (!bucket) throw new Error('Adult-credit audit bucket is not initialized');
    bucket.taxUnits += taxUnitWeight;
    bucket.adults += calibratedAdults;
    bucket.statutoryCost += calibratedCreditCost;
    totalTaxUnits += taxUnitWeight;
    totalAdults += calibratedAdults;
    statutoryAdultCreditDollars += calibratedCreditCost;
    if (creditCalculation.credit > 0) {
      positiveCreditTaxUnits += taxUnitWeight;
      adultsInPositiveCreditUnits += calibratedAdults;
    }
  }

  const grossCompensationBase = baseline.components.compensation;
  const exemptCompensationBase = controls.cashWagesAndSalaries * share(settings.cashWageExemptionShare)
    + controls.employerGovernmentSocialInsurance * share(settings.employerSocialInsuranceExemptionShare)
    + controls.employerPensionAndInsurance * share(settings.employerPensionInsuranceExemptionShare);
  const taxableCompensationBase = grossCompensationBase - exemptCompensationBase;
  const adultCreditStatutoryCost = statutoryAdultCreditDollars / 1e9;
  const adultCreditCost = adultCreditStatutoryCost * share(settings.adultCreditTakeUpRate);
  const totalAdultsMillions = totalAdults / 1e6;
  const universalMaximumCostBillions = totalAdultsMillions * settings.adultCredit / 1000;
  const buckets: AdultCreditAuditBucket[] = adultCreditBucketOrder
    .map((id) => {
      const values = auditBuckets.get(id);
      if (!values) throw new Error('Adult-credit audit bucket is not initialized');
      const adultsMillions = values.adults / 1e6;
      const statutoryCostBillions = values.statutoryCost / 1e9;
      return {
        id,
        taxUnitsMillions: values.taxUnits / 1e6,
        adultsMillions,
        adultPopulationShare: totalAdultsMillions > 0 ? adultsMillions / totalAdultsMillions : 0,
        statutoryCostBillions,
        budgetCostBillions: statutoryCostBillions * share(settings.adultCreditTakeUpRate),
        averageStatutoryCreditPerAdult: adultsMillions > 0
          ? statutoryCostBillions * 1000 / adultsMillions
          : 0,
        statutoryCostShare: adultCreditStatutoryCost > 0
          ? statutoryCostBillions / adultCreditStatutoryCost
          : 0,
      };
    })
    .filter((bucket) => bucket.taxUnitsMillions > 0 || bucket.id === 'phaseInPhaseOutOverlap');
  const fullPhaseInCompensationPerAdult = settings.adultCreditMode === 'earned'
    && settings.adultCreditPhaseInRate > 0
    ? settings.adultCredit / settings.adultCreditPhaseInRate
    : null;
  const adultCreditAudit: AdultCreditAudit = {
    buckets,
    totalTaxUnitsMillions: totalTaxUnits / 1e6,
    totalAdultsMillions,
    positiveCreditTaxUnitsMillions: positiveCreditTaxUnits / 1e6,
    adultsInPositiveCreditUnitsMillions: adultsInPositiveCreditUnits / 1e6,
    adultsInPositiveCreditUnitsShare: totalAdults > 0
      ? adultsInPositiveCreditUnits / totalAdults
      : 0,
    universalMaximumCostBillions,
    statutoryCostShareOfUniversalMaximum: universalMaximumCostBillions > 0
      ? adultCreditStatutoryCost / universalMaximumCostBillions
      : 0,
    averageStatutoryCreditPerAdult: totalAdultsMillions > 0
      ? adultCreditStatutoryCost * 1000 / totalAdultsMillions
      : 0,
    fullPhaseInCompensationPerAdult,
    phaseOutStartCompensationPerAdult: settings.adultCreditPhaseOutStartPerAdult,
    zeroCreditCompensationPerAdult: zeroCreditCompensationPerAdult(settings),
    phaseInPhaseOutOverlap: fullPhaseInCompensationPerAdult !== null
      && settings.adultCreditPhaseOutStartPerAdult < fullPhaseInCompensationPerAdult,
  };

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
    adultCreditAudit,
  };
}

export const microdata2025 = microdataJson;
