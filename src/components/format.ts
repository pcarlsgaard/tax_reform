export const moneyB = (value: number, digits = 2) => `${value < 0 ? '−' : ''}$${Math.abs(value / 1000).toFixed(digits)}T`;
export const dollars = (value: number) => `${value < 0 ? '−' : ''}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
export const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
export const millions = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
