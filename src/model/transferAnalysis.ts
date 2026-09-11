import {
  calculateTransferAnalysis as calculateTransferAnalysisBase,
  defaultTransferReplacementSettings,
  type ResourceScenarioId,
} from './transfers';
import type {
  ReformSettings,
  TransferAnalysisResult,
  TransferHouseholdInput,
  TransferReplacementSettings,
} from './types';

function withChildAges(input: TransferHouseholdInput, reform: ReformSettings): TransferHouseholdInput {
  if ((reform.under6ChildCredit ?? 0) <= 0) return input;

  const children = Math.max(0, Math.trunc(input.household.children));
  const childrenUnder6 = Math.max(0, Math.min(children, Math.trunc(input.preschoolChildren)));
  return {
    ...input,
    household: {
      ...input.household,
      childrenUnder6,
    },
  };
}

/**
 * Social-spending households already distinguish preschool and school-age children.
 * Translate that information into the household tax engine's under-6 count when the
 * policy includes an under-6 supplement, so every resource identity includes it.
 */
export function calculateTransferAnalysis(
  input: TransferHouseholdInput,
  reform: ReformSettings,
  replacements: TransferReplacementSettings = defaultTransferReplacementSettings,
): TransferAnalysisResult {
  return calculateTransferAnalysisBase(withChildAges(input, reform), reform, replacements);
}

export function calculateMarginalResourceWithdrawalRate(
  input: TransferHouseholdInput,
  reform: ReformSettings,
  replacements: TransferReplacementSettings,
  scenario: ResourceScenarioId,
  window = 1000,
): number {
  const half = window / 2;
  const down = calculateTransferAnalysis({
    ...input,
    household: { ...input.household, cashWage: Math.max(0, input.household.cashWage - half) },
  }, reform, replacements);
  const up = calculateTransferAnalysis({
    ...input,
    household: { ...input.household, cashWage: input.household.cashWage + half },
  }, reform, replacements);
  const downResources = scenario === 'current'
    ? down.currentLaw.annual
    : scenario === 'retained'
      ? down.reformRetained.annual
      : down.reformAfterReplacement.annual;
  const upResources = scenario === 'current'
    ? up.currentLaw.annual
    : scenario === 'retained'
      ? up.reformRetained.annual
      : up.reformAfterReplacement.annual;
  const deltaCompensation = up.tax.employerCompensation - down.tax.employerCompensation;
  return deltaCompensation > 0 ? 1 - (upResources - downResources) / deltaCompensation : 0;
}
