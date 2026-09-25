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
from estimate_labor_response import BASELINE, LAW
from optimize_wage_marginals import (BASE_RATES, INDIVIDUAL_BINS, INDIVIDUAL_NAMES,
                                     earned_credit_slope, summarize, revenue_base, worker_sample)


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
    phase_in = eitc_slope > .0001
    phase_out = eitc_slope < -.0001
    higher = new > old + .0001
    reform_keep_eitc = new - eitc_slope
    output = {
        "schemaVersion": 1,
        "sourceArchiveSha256": EXPECTED_SOURCE_SHA256,
        "method": "Federal income tax including EITC and CTC and both FICA sides vs X-tax on all compensation, +$1,000 per individual worker, employer-cost denominator; tax only, no social benefits, ACA credits or program withdrawals; fixed marginal employer health and wage-proportional pension; 2025 ASEC calibrated to BEA wages. Current tax calculator groups heads of household with single filers and omits AMT, NIIT, nonwage income, other credits and deductions. Phase attribution concerns local marginal slopes, not levels or lifetime incentive effects. Retain-EITC counterfactual illustrates the phase-in and phaseout mechanics; it is not a costed proposal.",
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
        },
        "byIndividualAnnualCashWage": groups,
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
