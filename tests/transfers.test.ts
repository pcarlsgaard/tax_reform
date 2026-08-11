import { describe, expect, it } from 'vitest';
import {
  calculateFederalProgramSavings,
  calculateHousehold,
  calculateMacro,
  calculateMarginalResourceWithdrawalRate,
  calculateSnap,
  calculateTransferAnalysis,
  calculateTransferPrograms,
  cloneTransferPreset,
  defaultSettings,
  defaultTransferReplacementSettings,
  illustrativeCoreReplacement,
  povertyGuideline,
  transferPresets,
  transferPrograms,
  type TransferHouseholdInput,
  type TransferProgramId,
  type TransferReplacementSettings,
} from '../src/model';

function noReplacements(): TransferReplacementSettings {
  return { replacedPrograms: { ...defaultTransferReplacementSettings.replacedPrograms } };
}

function only(id: TransferProgramId): TransferReplacementSettings {
  const settings = noReplacements();
  settings.replacedPrograms[id] = true;
  return settings;
}

function preset(id: string): TransferHouseholdInput {
  return cloneTransferPreset(transferPresets.find((row) => row.id === id)!);
}

describe('transfer integration regressions', () => {
  it('leaves existing macro results unchanged when no external programs are selected', () => {
    const before = calculateMacro(defaultSettings);
    const after = calculateMacro(defaultSettings, { federalTransferSavings: calculateFederalProgramSavings(noReplacements()) });
    expect(after.targetRevenue).toBe(before.targetRevenue);
    expect(after.adjustedTargetRevenue).toBe(before.targetRevenue);
    expect(after.revenueNeutralRate).toBe(before.revenueNeutralRate);
    expect(after.adjustedRevenueNeutralRate).toBe(before.revenueNeutralRate);
    expect(after.adjustedSurplusDeficit).toBe(before.surplusDeficit);
  });

  it('reuses the household tax engine without changing its output', () => {
    const input = preset('parent-two');
    const direct = calculateHousehold(input.household, defaultSettings);
    const transfer = calculateTransferAnalysis(input, defaultSettings, noReplacements());
    expect(transfer.tax).toEqual(direct);
  });

  it('defaults employer FICA pass-through to 100%', () => {
    const input = preset('parent-two');
    const result = calculateTransferAnalysis(input, defaultSettings, noReplacements());
    expect(input.employerFicaPassThroughRate).toBe(1);
    expect(result.tax.employerFicaPassThrough).toBeCloseTo(result.tax.current.employerPayrollTax, 10);
    expect(result.tax.reformGrossResources).toBeCloseTo(result.tax.totalCashWage + result.tax.employerFicaPassThrough, 10);
  });

  it('applies a partial pass-through to resources, reform wages, taxes, and credits', () => {
    const input = preset('parent-two');
    input.employerFicaPassThroughRate = 0.5;
    const half = calculateTransferAnalysis(input, defaultSettings, noReplacements());
    const full = calculateTransferAnalysis({ ...input, employerFicaPassThroughRate: 1 }, defaultSettings, noReplacements());
    expect(half.tax.employerFicaPassThrough).toBeCloseTo(half.tax.current.employerPayrollTax * 0.5, 10);
    expect(half.tax.reformWageBase).toBeCloseTo(half.tax.totalCashWage + half.tax.employerFicaPassThrough, 10);
    expect(half.tax.reformDisposableResources).toBeLessThan(full.tax.reformDisposableResources);
    expect(half.tax.reformTaxBeforeCredits).not.toBe(full.tax.reformTaxBeforeCredits);
  });

  it('makes the pass-through setting inapplicable when payroll taxes are retained', () => {
    const input = preset('parent-two');
    const retainedPayroll = {
      ...defaultSettings,
      replacedTaxes: { ...defaultSettings.replacedTaxes, payroll: false },
    };
    const zero = calculateTransferAnalysis({ ...input, employerFicaPassThroughRate: 0 }, retainedPayroll, noReplacements());
    const full = calculateTransferAnalysis({ ...input, employerFicaPassThroughRate: 1 }, retainedPayroll, noReplacements());
    expect(zero.tax.employerFicaPassThrough).toBe(0);
    expect(full.tax.employerFicaPassThrough).toBe(0);
    expect(zero.tax.reformDisposableResources).toBeCloseTo(full.tax.reformDisposableResources, 10);
    expect(zero.tax.reformTaxAfterCredits).toBeCloseTo(full.tax.reformTaxAfterCredits, 10);
  });
});

describe('federal fiscal replacement accounting', () => {
  it('sums only checked federal program amounts', () => {
    expect(calculateFederalProgramSavings(illustrativeCoreReplacement)).toBeCloseTo(163.768, 9);
    expect(calculateFederalProgramSavings(only('housing'))).toBeCloseTo(38.320, 9);
  });

  it('subtracts savings from the tax target and solves the adjusted rate algebraically', () => {
    const savings = calculateFederalProgramSavings(illustrativeCoreReplacement);
    const result = calculateMacro(defaultSettings, { federalTransferSavings: savings });
    expect(result.adjustedTargetRevenue).toBeCloseTo(result.targetRevenue - savings, 10);
    const solved = calculateMacro({ ...defaultSettings, rate: result.adjustedRevenueNeutralRate }, { federalTransferSavings: savings });
    expect(solved.adjustedSurplusDeficit).toBeCloseTo(0, 8);
  });

  it('never treats documented state financing as federal savings', () => {
    for (const program of transferPrograms) expect(program.stateFinancingIncludedBillions).toBe(0);
    const tanf = transferPrograms.find((program) => program.id === 'tanf')!;
    expect(calculateFederalProgramSavings(only('tanf'))).toBe(tanf.federalFiscalAmountBillions);
    expect(tanf.financing).toContain('state maintenance-of-effort');
  });
});

describe('household resource identities', () => {
  it('reconciles all three resource scenarios', () => {
    const result = calculateTransferAnalysis(preset('parent-two'), defaultSettings, illustrativeCoreReplacement);
    expect(result.currentLaw.annual).toBeCloseTo(
      result.tax.employerCompensation
        - result.tax.currentPreCreditTaxLiability
        + result.tax.currentTaxCredits
        + result.totalCurrentExternalTransfers,
      8,
    );
    expect(result.reformRetained.annual).toBeCloseTo(
      result.tax.reformGrossResources
        - result.tax.reformPreCreditTaxLiability
        + result.tax.reformTotalCredits
        + result.totalCurrentExternalTransfers,
      8,
    );
    expect(result.reformAfterReplacement.annual).toBeCloseTo(
      result.tax.reformGrossResources
        - result.tax.reformPreCreditTaxLiability
        + result.tax.reformTotalCredits
        + result.totalCurrentExternalTransfers
        - result.eliminatedHouseholdBenefits,
      8,
    );
  });

  it('does not double-count current EITC/CTC or reform credits', () => {
    const result = calculateTransferAnalysis(preset('parent-two'), defaultSettings, noReplacements());
    expect(result.tax.current.eitc + result.tax.current.nonrefundableCtc + result.tax.current.refundableCtc).toBeGreaterThan(0);
    expect(result.currentLaw.annual - result.totalCurrentExternalTransfers).toBeCloseTo(result.tax.currentDisposableResources, 8);
    expect(result.tax.totalReformCredit).toBeGreaterThan(0);
    expect(result.reformRetained.annual - result.totalCurrentExternalTransfers).toBeCloseTo(result.tax.reformDisposableResources, 8);
  });

  it('removes exactly the selected household resource value and retains unchecked benefits', () => {
    const input = preset('parent-two');
    const retained = calculateTransferAnalysis(input, defaultSettings, noReplacements());
    const snapReplaced = calculateTransferAnalysis(input, defaultSettings, only('snap'));
    const snap = snapReplaced.programs.find((row) => row.program.id === 'snap')!;
    expect(snapReplaced.reformRetained.annual).toBeCloseTo(retained.reformRetained.annual, 8);
    expect(snapReplaced.reformAfterReplacement.annual).toBeCloseTo(retained.reformRetained.annual - snap.resourceEquivalentValue, 8);
    const wic = snapReplaced.programs.find((row) => row.program.id === 'wic')!;
    expect(snapReplaced.reformAfterReplacement.annual).toBeGreaterThanOrEqual(wic.resourceEquivalentValue);
  });

  it('does not award assumed or rationed benefits from income eligibility alone', () => {
    const input = preset('single-zero');
    input.receives.snap = false;
    input.receives.housing = false;
    input.manualAnnualBenefits.housing = 12000;
    const rows = calculateTransferPrograms(input);
    const snap = rows.find((row) => row.program.id === 'snap')!;
    const housing = rows.find((row) => row.program.id === 'housing')!;
    expect(snap.eligible).toBe(true);
    expect(snap.potentialAnnualBenefit).toBeGreaterThan(0);
    expect(snap.annualGovernmentBenefit).toBe(0);
    expect(housing.annualGovernmentBenefit).toBe(0);
  });
});

describe('2025 rule-based program boundaries', () => {
  it('applies the FY2025 SNAP gross-income threshold and maximum allotment', () => {
    const zero = preset('single-zero');
    expect(calculateSnap(zero).monthlyBenefit).toBe(292);
    const atLimit = preset('single-zero');
    atLimit.household.cashWage = 1632 * 12;
    const above = preset('single-zero');
    above.household.cashWage = 1632 * 12 + 1;
    expect(calculateSnap(atLimit).eligible).toBe(true);
    expect(calculateSnap(above).eligible).toBe(false);
  });

  it('applies school-meal and Summer EBT income and child-age requirements', () => {
    const input = preset('parent-two');
    input.household.cashWage = povertyGuideline(3) * 1.85;
    let rows = calculateTransferPrograms(input);
    expect(rows.find((row) => row.program.id === 'schoolMeals')!.eligible).toBe(true);
    expect(rows.find((row) => row.program.id === 'summerEbt')!.eligible).toBe(true);
    input.household.cashWage += 1;
    rows = calculateTransferPrograms(input);
    expect(rows.find((row) => row.program.id === 'schoolMeals')!.eligible).toBe(false);
    expect(rows.find((row) => row.program.id === 'summerEbt')!.eligible).toBe(false);
    input.household.cashWage = 0;
    input.schoolAgeChildren = 0;
    rows = calculateTransferPrograms(input);
    expect(rows.find((row) => row.program.id === 'summerEbt')!.potentialAnnualBenefit).toBe(0);
  });

  it('calculates the contiguous-state 2025 poverty guideline by household size', () => {
    expect(povertyGuideline(1)).toBe(15650);
    expect(povertyGuideline(4)).toBe(32150);
    expect(povertyGuideline(9)).toBe(59650);
  });

  it('captures a rule-based SNAP cliff but gives fixed manual benefits no invented phaseout', () => {
    const input = preset('single-zero');
    input.household.cashWage = 1632 * 12;
    const withSnap = calculateMarginalResourceWithdrawalRate(input, defaultSettings, noReplacements(), 'current');
    input.receives.snap = false;
    input.receives.liheap = true;
    const fixedOnly = calculateMarginalResourceWithdrawalRate(input, defaultSettings, noReplacements(), 'current');
    input.receives.liheap = false;
    const noTransfers = calculateMarginalResourceWithdrawalRate(input, defaultSettings, noReplacements(), 'current');
    expect(withSnap).toBeGreaterThan(fixedOnly);
    expect(fixedOnly).toBeCloseTo(noTransfers, 10);
  });
});
