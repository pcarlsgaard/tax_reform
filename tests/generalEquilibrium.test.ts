import { describe, expect, it } from 'vitest';
import { calculateMacro, defaultSettings } from '../src/model/macro';
import {
  calibrateExposure, estimateReformLaborMarginalRate, referenceParameters,
  scoreLongRunReform, solveLongRun, solveLongRunAtHours, taxFoundationDBCFT, userCost,
} from '../src/model/generalEquilibrium';

describe('long-run comparative-statics prototype', () => {
  it('returns unchanged output and employment for unchanged marginal tax treatment', () => {
    const unchanged = solveLongRun({ businessRate: referenceParameters.baselineBusinessRate,
      recoveryPresentValue: referenceParameters.baselineRecoveryPresentValue,
      laborMarginalRate: referenceParameters.baselineLaborMarginalRate });
    expect(unchanged.gdpRatio).toBeCloseTo(1, 12);
    expect(unchanged.capitalRatio).toBeCloseTo(1, 12);
    expect(unchanged.hoursRatio).toBeCloseTo(1, 12);
  });

  it('full expensing removes the entity tax on marginal new investment', () => {
    expect(userCost(0.21, 1, referenceParameters)).toBeCloseTo(
      referenceParameters.realReturn + referenceParameters.depreciation, 12);
  });

  it('calibrates only exposure and checks independent published targets', () => {
    const p = calibrateExposure(taxFoundationDBCFT.capitalRatio, taxFoundationDBCFT.policy);
    const result = solveLongRun(taxFoundationDBCFT.policy, p);
    expect(p.exposedCapitalShare).toBeGreaterThan(0);
    expect(p.exposedCapitalShare).toBeLessThan(1);
    expect(result.capitalRatio).toBeCloseTo(1.026, 10);
    expect(result.gdpRatio).toBeGreaterThan(1);
    expect(result.wageRatio).toBeGreaterThan(1);
    console.log('DBCFT one-target calibration / out-of-sample checks:', JSON.stringify({
      exposedCapitalShare: p.exposedCapitalShare, computed: result,
      published: { gdpRatio: taxFoundationDBCFT.gdpRatio,
        wageRatio: taxFoundationDBCFT.wageRatio,
        capitalRatio: taxFoundationDBCFT.capitalRatio },
    }));
  });

  it('credits, brackets, and payroll repeal affect the modeled labor wedge', () => {
    const flat = { ...defaultSettings, noncomplianceRate: 0, adultCredit: 0 };
    const withPayroll = estimateReformLaborMarginalRate({ ...flat,
      replacedTaxes: { ...flat.replacedTaxes, payroll: false } });
    expect(withPayroll - estimateReformLaborMarginalRate(flat)).toBeCloseTo(0.087, 8);
    const progressive = estimateReformLaborMarginalRate({ ...flat, wageTaxMode: 'progressive',
      progressiveMiddleRate: 0.25, progressiveZeroBracketPerAdult: 17000,
      progressiveTopBracketPerAdult: 60000 });
    expect(progressive).toBeLessThan(estimateReformLaborMarginalRate(flat));
  });

  it('scores the user schedule while preserving its static revenue identity', () => {
    const settings = { ...defaultSettings, rate: 0.35, wageTaxMode: 'progressive' as const,
      progressiveMiddleRate: 0.25, progressiveZeroBracketPerAdult: 17000,
      progressiveTopBracketPerAdult: 60000, childCredit: 7200, adultCredit: 0 };
    const result = scoreLongRunReform(settings,
      calibrateExposure(taxFoundationDBCFT.capitalRatio, taxFoundationDBCFT.policy));
    expect(result.illustrativeDynamicDeficitReductionBillions).toBeCloseTo(
      result.staticScore.deficitReduction + result.illustrativeReformRevenueFeedbackBillions, 8);
    expect(result.equilibrium.gdpRatio).toBeGreaterThan(0);
    console.log('User X-tax illustrative long-run scenario:', JSON.stringify({
      staticDeficitReductionBillions: result.staticScore.deficitReduction,
      reformLaborMarginalRate: result.laborMarginalRate,
      equilibrium: result.equilibrium,
      illustrativeRevenueFeedbackBillions: result.illustrativeReformRevenueFeedbackBillions,
    }));
  });

  it('accepts a distributional labor response without reusing the aggregate labor wedge', () => {
    const calibrated = calibrateExposure(taxFoundationDBCFT.capitalRatio, taxFoundationDBCFT.policy);
    const result = solveLongRunAtHours(1.005193196678652, 0.35, 1, calibrated);
    expect(result.hoursRatio).toBeCloseTo(1.005193196678652, 12);
    expect(result.gdpRatio).toBeCloseTo(1.0136112607755758, 10);
    expect(result.capitalRatio).toBeCloseTo(1.0287511542003835, 10);
  });

  it('rescores the revised 25/35 schedule and the earned $2,000 adult credit', () => {
    const settings = { ...defaultSettings, rate: .35, wageTaxMode: 'progressive' as const,
      progressiveZeroBracketPerAdult: 0, progressiveMiddleRate: .25,
      progressiveTopBracketPerAdult: 75000,
      adultCredit: 2000, adultCreditMode: 'earned' as const,
      adultCreditPhaseInRate: .10, adultCreditPhaseOutRate: 0,
      childCredit: 7200 };
    const result = calculateMacro(settings);
    expect(result.adultCreditCost).toBeGreaterThan(0);
    expect(result.childCreditCost).toBeGreaterThan(0);
    console.log('Revised static base (credit phases in on gross imputed compensation):',
      JSON.stringify({ netRevenue: result.netRevenue,
        deficitReduction: result.deficitReduction,
        adultCreditCost: result.adultCreditCost,
        childCreditCost: result.childCreditCost }));
  });
});
