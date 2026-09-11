import { describe, expect, it } from 'vitest';
import {
  calculateHousehold,
  calculateTransferAnalysis,
  cloneTransferPreset,
  defaultSettings,
  defaultTransferReplacementSettings,
  transferPresets,
} from '../src/model';

const noReplacements = () => ({
  replacedPrograms: { ...defaultTransferReplacementSettings.replacedPrograms },
});

const reform = {
  ...defaultSettings,
  childCredit: 4000,
  under6ChildCredit: 6000,
  childCreditBaselineRefundableShare: 1,
  childCreditPhaseInRate: 0,
};

describe('social spending under-6 credit', () => {
  it('maps preschool children into the household under-6 credit calculation', () => {
    const input = cloneTransferPreset(transferPresets.find((row) => row.id === 'parent-one')!);
    input.preschoolChildren = 1;

    const transfer = calculateTransferAnalysis(input, reform, noReplacements());
    const direct = calculateHousehold({ ...input.household, childrenUnder6: 1 }, reform);

    expect(transfer.tax.childCredit).toBe(10000);
    expect(transfer.tax).toEqual(direct);
  });

  it('changes reform resources by exactly the under-6 supplement', () => {
    const input = cloneTransferPreset(transferPresets.find((row) => row.id === 'parent-one')!);
    input.preschoolChildren = 1;
    const withUnder6 = calculateTransferAnalysis(input, reform, noReplacements());
    const withoutUnder6 = calculateTransferAnalysis({ ...input, preschoolChildren: 0 }, reform, noReplacements());

    expect(withUnder6.tax.childCredit - withoutUnder6.tax.childCredit).toBe(6000);
    expect(withUnder6.reformRetained.annual - withoutUnder6.reformRetained.annual).toBeCloseTo(6000, 8);
  });
});
