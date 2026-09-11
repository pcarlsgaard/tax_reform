import { describe, expect, it } from 'vitest';
import { calculateChildCredit, calculateHousehold, defaultSettings } from '../src/model';

const settings = {
  ...defaultSettings,
  childCredit: 4000,
  under6ChildCredit: 6000,
  childCreditBaselineRefundableShare: 1,
  childCreditPhaseInRate: 0.15,
};

describe('reform child credit', () => {
  it('adds the under-6 supplement on top of the base child credit', () => {
    expect(calculateChildCredit(0, 2, 1, settings)).toBe(14000);
    expect(calculateChildCredit(0, 1, 1, settings)).toBe(10000);
    expect(calculateChildCredit(0, 2, 0, settings)).toBe(8000);
  });

  it('makes the full credit available at zero earnings when baseline refundability is 100%', () => {
    const zero = calculateChildCredit(0, 2, 1, settings);
    const earned = calculateChildCredit(100000, 2, 1, settings);
    expect(zero).toBe(14000);
    expect(earned).toBe(14000);
  });

  it('phases in only the share not refundable at baseline', () => {
    const partial = {
      ...settings,
      childCreditBaselineRefundableShare: 0.5,
      childCreditPhaseInRate: 0.10,
    };
    expect(calculateChildCredit(0, 2, 1, partial)).toBe(7000);
    expect(calculateChildCredit(50000, 2, 1, partial)).toBe(12000);
    expect(calculateChildCredit(100000, 2, 1, partial)).toBe(14000);
  });

  it('propagates the under-6 count through household scoring', () => {
    const result = calculateHousehold({
      filingStatus: 'single',
      children: 2,
      childrenUnder6: 1,
      cashWage: 0,
    }, settings);
    expect(result.childCredit).toBe(14000);
    expect(result.input.childrenUnder6).toBe(1);
  });
});
