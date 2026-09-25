#!/usr/bin/env python3
"""Break down federal wage-tax marginal differences into credits and brackets.

Usage: python3 scripts/diagnose_wage_tax_marginals.py --archive /path/to/asecpub25csv.zip
Releases aggregate cells only; uses the same +$1,000 worker perturbation and
employer-cost denominator as optimize_wage_marginals.py.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from build_microdata import EXPECTED_SOURCE_SHA256, ROOT, read_person_units, source_sha256
from estimate_labor_response import (BASELINE, LAW, PENSION_PER_CASH_WAGE,
                                     current_tax, reform_tax)
from optimize_wage_marginals import (BASE_RATES, INDIVIDUAL_BINS, INDIVIDUAL_NAMES,
                                     MICRO, earned_credit_slope, summarize, revenue_base,
                                     worker_sample)


def eitc(wage: float, married: bool, children: int) -> float:
    rule = LAW["eitc"][str(min(3, children))]
    return max(0.0, min(rule["maximum"], wage * rule["phaseInRate"])
               - max(0.0, wage - rule["phaseOutStart"]["married" if married else "single"])
               * rule["phaseOutRate"])


def refundable_child_credit(wage: float, married: bool, children_under17: int) -> float:
    taxable = max(0.0, wage - LAW["standardDeduction"]["married" if married else "single"])
    regular = 0.0
    floor = 0.0
    for ceiling, rate in LAW["brackets"]["married" if married else "single"]:
        if taxable <= floor:
            break
        ceiling = float("inf") if ceiling is None else ceiling
        regular += (min(taxable, ceiling) - floor) * rate
        floor = ceiling
    rule = LAW["childTaxCredit"]
    count = min(4, children_under17)
    threshold = rule["phaseoutThreshold"]["married" if married else "single"]
    phased = np.ceil(max(0.0, wage - threshold) / 1000) * rule["phaseoutPerThousand"]
    available = max(0.0, count * rule["perChild"] - phased)
    return min(max(0.0, available - regular), count * rule["refundablePerChild"],
               max(0.0, wage - rule["refundEarnedIncomeFloor"]) * rule["refundRate"])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--output", type=Path,
                        default=ROOT / "analysis/wage_tax_credit_diagnostic_2025.json")
    args = parser.parse_args()
    if source_sha256(args.archive) != EXPECTED_SOURCE_SHA256:
        raise ValueError("Census input differs from pinned archive")
    units, _ = read_person_units(args.archive)
    sample = worker_sample(units, {})
    cash_scale = BASELINE["compensationComponents"]["cashWagesAndSalaries"] * 1e9 / sum(
        u["headWeight"] * u["rawCashWage"] for u in units)
    eitc_slopes = []
    child_slopes = []
    for unit in units:
        earners = [w * cash_scale for w in unit["earnerCashWages"]]
        if not earners:
            continue
        wage = sum(earners)
        married = unit["scheduleAdults"] == 2
        children = unit["children"]
        under17 = unit["childrenUnder17"]
        before_eitc = eitc(wage, married, children)
        before_child = refundable_child_credit(wage, married, under17)
        for index, individual_wage in enumerate(earners):
            if individual_wage <= 0:
                continue
            extra = sample["extraCost"][len(eitc_slopes)]
            eitc_slopes.append((eitc(wage + 1000, married, children) - before_eitc) / extra)
            child_slopes.append((refundable_child_credit(wage + 1000, married, under17)
                                 - before_child) / extra)
    eitc_slope, child_slope = np.asarray(eitc_slopes), np.asarray(child_slopes)
    if len(eitc_slope) != len(sample["wage"]):
        raise ValueError("Worker observations out of alignment")
    old = sample["old"]
    new = sample["matrix"] @ BASE_RATES - earned_credit_slope(sample, 2000, .1)
    weights = sample["workerWeight"]
    earning_weights = sample["earningsWeight"]
    bins = np.searchsorted(INDIVIDUAL_BINS[1:], sample["wage"], side="right")

    def share(mask: np.ndarray, weight: np.ndarray = weights) -> float:
        return round(float(weight[mask].sum() / weight.sum()), 5)

    def mean(mask: np.ndarray, values: np.ndarray, weight: np.ndarray = earning_weights) -> float:
        return round(float(np.average(values[mask], weights=weight[mask])) * 100, 2)

    groups = {}
    for index, name in enumerate(INDIVIDUAL_NAMES):
        mask = bins == index
        group_weight = weights[mask]
        increased = new[mask] > old[mask] + .0001
        groups[name] = {
            "workersMillions": round(float(group_weight.sum() / 1e6), 2),
            "currentMarginalPercent": mean(mask, old),
            "reformMarginalPercent": mean(mask, new),
            "workerShareHigher": round(float(group_weight[increased].sum() / group_weight.sum()), 4),
            "workerShareEitcPhaseIn": round(float(group_weight[eitc_slope[mask] > .0001].sum()
                                                    / group_weight.sum()), 4),
            "workerShareEitcPhaseOut": round(float(group_weight[eitc_slope[mask] < -.0001].sum()
                                                     / group_weight.sum()), 4),
            "earningsWeightedCurrentEitcCreditSlopePercent": mean(mask, eitc_slope),
            "earningsWeightedCurrentRefundableChildSlopePercent": mean(mask, child_slope),
        }
    taxable_max = LAW["payroll"]["socialSecurityWageCap"]
    under_social_security_cap = sample["wage"] < taxable_max
    stage_groups = {}
    for label, rate in (("creditPhasingIn15Percent", .15),
                        ("middle25Percent", .25),
                        ("top35Percent", .35)):
        mask = np.abs(new - rate) < .0001
        stage_groups[label] = {
            "shareOfWorkers": share(mask),
            "currentMarginalPercentEarningsWeighted": mean(mask, old),
            "reformMarginalPercentEarningsWeighted": mean(mask, new),
            "shareWithinStageWithIncrease": round(float(weights[mask & (new > old + .0001)].sum()
                                                          / weights[mask].sum()), 4),
        }
    stage_groups["crossingThresholdsOrOther"] = {
        "shareOfWorkers": round(1 - sum(row["shareOfWorkers"] for row in stage_groups.values()), 5),
    }
    micro_base, compensation, _, cell_weights, _ = revenue_base()
    filing_adults = np.asarray(MICRO["distribution"], dtype=float)[:, 1]
    retained_share = (1 - BASELINE["defaultNoncomplianceRate"]) * (
        1 - BASELINE["defaultExemptionShare"])

    def band_length(amount: np.ndarray, adults: np.ndarray,
                    start: float, end: float) -> np.ndarray:
        return np.maximum(0, np.minimum(amount, end * adults) - start * adults)

    def intermediate_scenario(start: float, end: float, rate: float = .30,
                              *, case: dict = sample) -> dict:
        case_old = case["old"]
        case_new = case["matrix"] @ BASE_RATES - earned_credit_slope(case, 2000, .1)
        case_weights = case["workerWeight"]
        case_under_cap = case["wage"] < taxable_max
        marginal_band = (band_length(case["compAfter"], case["filingAdults"], start, end)
                         - band_length(case["compBefore"], case["filingAdults"], start, end)
                         ) / case["extraCost"]
        alternative = case_new - (.35 - rate) * marginal_band
        taxable_band_billions = float(np.sum(cell_weights * band_length(
            compensation, filing_adults, start, end)) * retained_share / 1e9)
        higher = alternative > case_old + .0001
        lower = alternative < case_old - .0001
        return {
            "middle25EndsPerFilingAdult": int(start),
            "intermediateRatePercent": 100 * rate,
            "top35StartsPerFilingAdult": int(end),
            "workerShareHigher": round(float(case_weights[higher].sum()
                                             / case_weights.sum()), 5),
            "workerShareLower": round(float(case_weights[lower].sum()
                                            / case_weights.sum()), 5),
            "workerShareHigherUnderSocialSecurityCap":
                round(float(case_weights[higher & case_under_cap].sum()
                            / case_weights[case_under_cap].sum()), 5),
            "staticWageRevenueDifferenceFromStartingXTaxBillions":
                round(-(.35 - rate) * taxable_band_billions, 2),
        }
    variants = [intermediate_scenario(75_000, threshold) for threshold in
                (150_000, 176_100, 200_000, 225_000, 300_000)]
    variants.append(intermediate_scenario(100_000, 200_000))
    if abs(variants[0]["staticWageRevenueDifferenceFromStartingXTaxBillions"]
           + .05 * micro_base[2]) > .01:
        raise ValueError("The intermediate-band revenue base does not match the existing ledger")
    website_sample = worker_sample(units, {}, include_employer_benefits=False)
    website_old = website_sample["old"]
    website_weights = website_sample["workerWeight"]
    website_new = website_sample["matrix"] @ BASE_RATES - earned_credit_slope(
        website_sample, 2000, .1)
    website_under_cap = website_sample["wage"] < taxable_max
    website_higher = website_new > website_old + .0001
    website_lower = website_new < website_old - .0001
    website_scenarios = [intermediate_scenario(75_000, threshold, case=website_sample)
                         for threshold in (150_000, 200_000, 225_000)]
    if len(website_weights) != len(weights) or not np.allclose(website_weights, weights):
        raise ValueError("The full and wage-only worker samples are out of alignment")
    single_examples = []
    for wage in (10_000, 30_000, 50_000, 60_000, 75_000, 120_000,
                 175_000, 190_000, 250_000, 500_000):
        old_tax, employer_fica = current_tax([wage], False, 0)
        old_plus, employer_fica_plus = current_tax([wage + 1000], False, 0)
        reform_before = reform_tax([wage], False, 1, 0, benefit_cash_out_share=1)
        reform_after = reform_tax([wage + 1000], False, 1, 0,
                                  benefit_cash_out_share=1,
                                  benefit_amount=(wage * (
                                    (BASELINE["compensationComponents"]["employerHealthInsurance"]
                                     + BASELINE["compensationComponents"]["employerPensionAndOtherInsurance"])
                                    / BASELINE["compensationComponents"]["cashWagesAndSalaries"])
                                    + 1000 * PENSION_PER_CASH_WAGE))
        # The base reform_tax uses total benefit share, while the perturbation
        # keeps employer health fixed and varies only pension with pay.
        extra_cost = 1000 * (1 + PENSION_PER_CASH_WAGE) + employer_fica_plus - employer_fica
        single_examples.append({
            "cashWage": wage,
            "currentMarginalPercent": round(100 * (old_plus - old_tax) / extra_cost, 2),
            "reformMarginalPercent": round(100 * (reform_after - reform_before) / extra_cost, 2),
        })
    website_examples = []
    for wage in (10_000, 30_000, 50_000, 60_000, 75_000, 120_000,
                 175_000, 190_000, 250_000, 500_000):
        old_tax, fica_before = current_tax([wage], False, 0)
        old_after, fica_after = current_tax([wage + 1000], False, 0)
        new_before = reform_tax([wage], False, 1, 0, benefit_share=0,
                                benefit_cash_out_share=1)
        new_after = reform_tax([wage + 1000], False, 1, 0, benefit_share=0,
                               benefit_cash_out_share=1)
        extra_cost = 1000 + fica_after - fica_before
        website_examples.append({
            "cashWage": wage,
            "currentMarginalPercent": round(100 * (old_after - old_tax) / extra_cost, 2),
            "reformMarginalPercent": round(100 * (new_after - new_before) / extra_cost, 2),
        })
    phase_in = eitc_slope > .0001
    phase_out = eitc_slope < -.0001
    higher = new > old + .0001
    reform_keep_eitc = new - eitc_slope
    output = {
        "schemaVersion": 1,
        "sourceArchiveSha256": EXPECTED_SOURCE_SHA256,
        "method": "2025 CPS ASEC +$1,000 per individual worker; old federal income tax/EITC/CTC and both FICA sides vs proposed X-tax; employer-cost denominator. Website wage-only comparison excludes employer health and pension at level and margin. Full-compensation comparison includes fixed marginal health and wage-proportional pension as cash in the reform. Both exclude social benefit withdrawal. Bracket thresholds use tax-unit compensation per filing adult; wage-bin rows below instead use individual cash earnings and must not be read as statutory brackets. Revenue delta always comes from national full-compensation base at 7.5% noncompliance. Current-law simplification treats head-of-household as single, omits AMT, NIIT, nonwage income, other credits/deductions. Retained EITC is a derivative experiment, not a costed proposal.",
        "overall": {
            "workerShareHigherOriginal": share(higher),
            "workerShareEitcPhaseIn": share(phase_in),
            "workerShareEitcPhaseOut": share(phase_out),
            "workerShareRefundableChildPhaseIn": share(child_slope > .0001),
            "workerShareEitcPhaseInAndHigher": share(phase_in & higher),
            "workerShareHigherWithoutCurrentEitcPhaseIn": share(higher & ~phase_in),
            "earningsWeightedCurrentEitcCreditSlopePercent": mean(np.ones(len(old), dtype=bool),
                                                                     eitc_slope),
            "workerShareHigherIfOriginalEitcRetained": share(reform_keep_eitc > old + .0001),
            "workerShareHigherOnEitcPhaseInIfRetained": round(float(weights[phase_in &
                (reform_keep_eitc > old + .0001)].sum() / weights[phase_in].sum()), 4),
            "workerShareHigherOnEitcPhaseOutIfRetained": round(float(weights[phase_out &
                (reform_keep_eitc > old + .0001)].sum() / weights[phase_out].sum()), 4),
            "workerShareUnderSocialSecurityCap": share(under_social_security_cap),
            "workerShareHigherUnderSocialSecurityCap": round(float(
                weights[under_social_security_cap & higher].sum()
                / weights[under_social_security_cap].sum()), 5),
            "creditMaximumReachedPerAdultCompensation": 2000 / .1,
            "startingTopRateBeginsPerFilingAdultCompensation": 75_000,
        },
        "byIndividualAnnualCashWage": groups,
        "byActualReformMarginalRate": stage_groups,
        "intermediateBracketScenarios": variants,
        "singleChildlessExamples": single_examples,
        "websiteWageOnly": {
            "workerShareHigherOriginal": round(float(website_weights[website_higher].sum()
                                                     / website_weights.sum()), 5),
            "workerShareLowerOriginal": round(float(website_weights[website_lower].sum()
                                                    / website_weights.sum()), 5),
            "workerShareUnderSocialSecurityCap": round(float(
                website_weights[website_under_cap].sum() / website_weights.sum()), 5),
            "workerShareHigherUnderSocialSecurityCap": round(float(
                website_weights[website_under_cap & website_higher].sum()
                / website_weights[website_under_cap].sum()), 5),
            "currentEarningsWeightedPercent": round(float(np.average(
                website_old, weights=website_sample["earningsWeight"])) * 100, 2),
            "reformEarningsWeightedPercent": round(float(np.average(
                website_new, weights=website_sample["earningsWeight"])) * 100, 2),
            "workerShareAt15Percent": round(float(
                website_weights[np.abs(website_new - .15) < .0001].sum()
                / website_weights.sum()), 5),
            "workerShareAt25Percent": round(float(
                website_weights[np.abs(website_new - .25) < .0001].sum()
                / website_weights.sum()), 5),
            "workerShareAt35Percent": round(float(
                website_weights[np.abs(website_new - .35) < .0001].sum()
                / website_weights.sum()), 5),
            "intermediateBracketScenarios": website_scenarios,
            "singleChildlessExamples": website_examples,
        },
        "originalScheduleCrosscheck": summarize(BASE_RATES, sample, revenue_base())["shareWorkersWithIncrease"],
    }
    if abs(output["overall"]["workerShareHigherOriginal"]
           - output["originalScheduleCrosscheck"]) > .00002:
        raise ValueError("Diagnostic does not reproduce the optimizer's worker total")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps(output["overall"], indent=2))


if __name__ == "__main__":
    main()
