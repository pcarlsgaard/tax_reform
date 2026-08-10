import parameters from '../data/current_law_2024.json';
import type { FilingStatus, HouseholdInput, HouseholdResult, ReformSettings, TaxBreakdown } from './types';

type Bracket = [number | null, number];

function bracketTax(taxableIncome: number, status: FilingStatus): number {
  const brackets = parameters.brackets[status] as Bracket[];
  let tax = 0;
  let lower = 0;
  for (const [upperRaw, rate] of brackets) {
    const upper = upperRaw ?? Number.POSITIVE_INFINITY;
    if (taxableIncome <= lower) break;
    tax += (Math.min(taxableIncome, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

function earnedIncomeCredit(wage: number, status: FilingStatus, children: number): number {
  const key = String(Math.min(children, 3)) as '0' | '1' | '2' | '3';
  const rule = parameters.eitc[key];
  const phaseIn = Math.min(rule.maximum, wage * rule.phaseInRate);
  const phaseOut = Math.max(0, wage - rule.phaseOutStart[status]) * rule.phaseOutRate;
  return Math.max(0, phaseIn - phaseOut);
}

export function calculateCurrentLaw(input: HouseholdInput): TaxBreakdown {
  const wage = Math.max(0, input.cashWage);
  const children = Math.max(0, Math.min(4, Math.trunc(input.children)));
  const status = input.filingStatus;
  const payroll = parameters.payroll;

  const taxableIncome = Math.max(0, wage - parameters.standardDeduction[status]);
  const incomeTaxBeforeCredits = bracketTax(taxableIncome, status);

  const ctc = parameters.childTaxCredit;
  const phaseoutExcess = Math.max(0, wage - ctc.phaseoutThreshold[status]);
  const phaseout = phaseoutExcess > 0
    ? Math.ceil(phaseoutExcess / 1000) * ctc.phaseoutPerThousand
    : 0;
  const availableCtc = Math.max(0, children * ctc.perChild - phaseout);
  const nonrefundableCtc = Math.min(incomeTaxBeforeCredits, availableCtc);
  const unusedCtc = availableCtc - nonrefundableCtc;
  const earnedIncomeRefundLimit = Math.max(0, wage - ctc.refundEarnedIncomeFloor) * ctc.refundRate;
  const refundableCtc = Math.min(unusedCtc, children * ctc.refundablePerChild, earnedIncomeRefundLimit);
  const eitc = earnedIncomeCredit(wage, status, children);
  const individualIncomeTax = incomeTaxBeforeCredits - nonrefundableCtc - refundableCtc - eitc;

  const socialSecurityBase = Math.min(wage, payroll.socialSecurityWageCap);
  const employeeSocialSecurity = socialSecurityBase * payroll.socialSecurityRateEach;
  const employerSocialSecurity = socialSecurityBase * payroll.socialSecurityRateEach;
  const employeeMedicare = wage * payroll.medicareRateEach;
  const employerMedicare = wage * payroll.medicareRateEach;
  const additionalMedicare = Math.max(0, wage - payroll.additionalMedicareThreshold[status])
    * payroll.additionalMedicareRate;
  const employeePayrollTax = employeeSocialSecurity + employeeMedicare + additionalMedicare;
  const employerPayrollTax = employerSocialSecurity + employerMedicare;

  return {
    incomeTaxBeforeCredits,
    nonrefundableCtc,
    refundableCtc,
    eitc,
    individualIncomeTax,
    employeeSocialSecurity,
    employerSocialSecurity,
    employeeMedicare,
    employerMedicare,
    additionalMedicare,
    employeePayrollTax,
    employerPayrollTax,
    totalFederalTax: individualIncomeTax + employeePayrollTax + employerPayrollTax,
  };
}

function totalTaxAtWage(input: HouseholdInput, settings: ReformSettings): { current: number; reform: number; employerComp: number } {
  const current = calculateCurrentLaw(input);
  const employerComp = input.cashWage + current.employerPayrollTax;
  const payrollIsReplaced = settings.replacedTaxes.payroll;
  const reformWageBase = input.cashWage + (payrollIsReplaced ? current.employerPayrollTax : 0);
  const adults = input.filingStatus === 'married' ? 2 : 1;
  const credits = adults * settings.adultCredit + input.children * settings.childCredit;
  const retainedIncome = settings.replacedTaxes.individualIncome ? 0 : current.individualIncomeTax;
  const retainedPayroll = payrollIsReplaced ? 0 : current.employeePayrollTax + current.employerPayrollTax;
  const reform = reformWageBase * settings.rate - credits + retainedIncome + retainedPayroll;
  return { current: current.totalFederalTax, reform, employerComp };
}

export function calculateHousehold(input: HouseholdInput, settings: ReformSettings): HouseholdResult {
  const normalized: HouseholdInput = {
    filingStatus: input.filingStatus,
    children: Math.max(0, Math.min(4, Math.trunc(input.children))),
    cashWage: Math.max(0, input.cashWage),
  };
  const current = calculateCurrentLaw(normalized);
  const employerCompensation = normalized.cashWage + current.employerPayrollTax;
  const payrollIsReplaced = settings.replacedTaxes.payroll;
  const reformWageBase = normalized.cashWage + (payrollIsReplaced ? current.employerPayrollTax : 0);
  const adults = normalized.filingStatus === 'married' ? 2 : 1;
  const adultCredit = adults * settings.adultCredit;
  const childCredit = normalized.children * settings.childCredit;
  const totalReformCredit = adultCredit + childCredit;
  const reformTaxBeforeCredits = reformWageBase * settings.rate;
  const retainedIncome = settings.replacedTaxes.individualIncome ? 0 : current.individualIncomeTax;
  const retainedPayroll = payrollIsReplaced ? 0 : current.employeePayrollTax + current.employerPayrollTax;
  const retainedCurrentTaxes = retainedIncome + retainedPayroll;
  const reformTaxAfterCredits = reformTaxBeforeCredits - totalReformCredit + retainedCurrentTaxes;

  const currentDisposableResources = employerCompensation - current.totalFederalTax;
  const reformDisposableResources = employerCompensation - reformTaxAfterCredits;
  const dollarChange = reformDisposableResources - currentDisposableResources;

  const step = 1;
  const upInput = { ...normalized, cashWage: normalized.cashWage + step };
  const baseTaxes = totalTaxAtWage(normalized, settings);
  const upTaxes = totalTaxAtWage(upInput, settings);
  const deltaComp = upTaxes.employerComp - baseTaxes.employerComp;

  return {
    input: normalized,
    current,
    employerCompensation,
    reformWageBase,
    reformTaxBeforeCredits,
    adultCredit,
    childCredit,
    totalReformCredit,
    retainedCurrentTaxes,
    reformTaxAfterCredits,
    currentDisposableResources,
    reformDisposableResources,
    dollarChange,
    percentChange: currentDisposableResources !== 0 ? dollarChange / currentDisposableResources : null,
    currentAverageRate: employerCompensation > 0 ? current.totalFederalTax / employerCompensation : 0,
    reformAverageRate: employerCompensation > 0 ? reformTaxAfterCredits / employerCompensation : 0,
    currentMarginalRate: deltaComp > 0 ? (upTaxes.current - baseTaxes.current) / deltaComp : 0,
    reformMarginalRate: deltaComp > 0 ? (upTaxes.reform - baseTaxes.reform) / deltaComp : 0,
  };
}

export { parameters as currentLaw2024 };
