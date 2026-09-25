import { describe, expect, it } from 'vitest';
import { calculateMacro, defaultSettings } from '../src/model/macro';
import { calculateHealthAnalysis, defaultHealthPolicySettings } from '../src/model/health';
import { calibrateExposure, solveLongRunAtHours, taxFoundationDBCFT } from '../src/model/generalEquilibrium';
import laborResponse from '../analysis/scenario_30_150_10800_labor_2025.json';

const policy = {
  ...defaultSettings,
  rate: .35,
  wageTaxMode: 'progressive' as const,
  progressiveZeroBracketPerAdult: 0,
  progressiveMiddleRate: .25,
  progressiveIntermediateStartPerAdult: 75000,
  progressiveIntermediateRate: .30,
  progressiveTopBracketPerAdult: 150000,
  adultCredit: 2000,
  adultCreditMode: 'earned' as const,
  adultCreditEarningsBase: 'compensation' as const,
  adultCreditPhaseInRate: .10,
  adultCreditPhaseOutRate: 0,
  childCredit: 10800,
  under6ChildCredit: 0,
  childCreditBaselineRefundableShare: 1,
};

describe('25/30/35 schedule, $10,800 child and flat insurance credits', () => {
  it('scores retained social programs, with both ACA subsidy treatments stated', () => {
    const insurance = { ...defaultHealthPolicySettings,
      adultHealthCredit: 3000, childHealthCredit: 1500 };
    const retained = calculateHealthAnalysis(policy, { ...insurance, replaceAcaAptc: false });
    const replaced = calculateHealthAnalysis(policy, { ...insurance, replaceAcaAptc: true });
    const retainedFiscal = calculateMacro(policy, {
      insuranceCreditCost: retained.totalHealthCreditCostBillions,
    });
    const replacedFiscal = calculateMacro(policy, {
      federalTransferSavings: replaced.estimatedExistingAptcSavingsBillions,
      insuranceCreditCost: replaced.totalHealthCreditCostBillions,
    });
    expect(retainedFiscal.federalTransferSavings).toBe(0);
    expect(replacedFiscal.federalTransferSavings).toBeGreaterThan(0);
    expect(retainedFiscal.grossRevenue - retainedFiscal.adultCreditCost
      - retainedFiscal.childCreditCost - retainedFiscal.insuranceCreditCost)
      .toBeCloseTo(retainedFiscal.netRevenue, 7);
    expect(retainedFiscal.deficitReduction).toBeCloseTo(
      retainedFiscal.netRevenue - retainedFiscal.targetRevenue
        + retainedFiscal.refundableTaxCreditOutlaySavings, 7);
    console.log('REQUESTED_SCENARIO_FISCAL', JSON.stringify({
      retainedSocialAndAca: {
        grossRevenue: retainedFiscal.grossRevenue,
        adultCreditCost: retainedFiscal.adultCreditCost,
        childCreditCost: retainedFiscal.childCreditCost,
        insuranceCreditCost: retainedFiscal.insuranceCreditCost,
        netRevenue: retainedFiscal.netRevenue,
        currentTaxesReplaced: retainedFiscal.targetRevenue,
        currentRefundableCreditsRetired: retainedFiscal.refundableTaxCreditOutlaySavings,
        deficitReduction: retainedFiscal.deficitReduction,
      },
      retainedSocialReplacedAca: {
        insuranceCreditCost: replacedFiscal.insuranceCreditCost,
        existingAcaSavings: replacedFiscal.federalTransferSavings,
        netRevenue: replacedFiscal.netRevenue,
        deficitReduction: replacedFiscal.deficitReduction,
      },
    }));
  });

  it('keeps capital-driven real wages independent of labor-hours assumptions', () => {
    const p = calibrateExposure(taxFoundationDBCFT.capitalRatio, taxFoundationDBCFT.policy);
    const atBaselineHours = solveLongRunAtHours(1, .35, 1, p);
    const central = solveLongRunAtHours(1 + laborResponse.central.totalHoursChange, .35, 1, p);
    expect(atBaselineHours.wageRatio).toBeGreaterThan(1);
    expect(solveLongRunAtHours(.99, .35, 1, p).wageRatio)
      .toBeCloseTo(atBaselineHours.wageRatio, 12);
    expect(central.wageRatio).toBeCloseTo(laborResponse.central.settings.capitalInducedWageRatio, 10);
    console.log('REQUESTED_SCENARIO_EQUILIBRIUM', JSON.stringify({
      hoursPercent: 100 * (central.hoursRatio - 1),
      realPretaxWagesPercent: 100 * (central.wageRatio - 1),
      realGdpPercent: 100 * (central.gdpRatio - 1),
      capitalPercent: 100 * (central.capitalRatio - 1),
    }));
  });
});
