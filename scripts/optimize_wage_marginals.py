#!/usr/bin/env python3
"""Find the least-cost monotone wage schedule that avoids *bin-average* MTR increases.

The top wage/business rate is fixed at 35%. This deliberately distinguishes the
achievable bin-average constraint from the infeasible individual no-increase goal.
Reads the pinned public Census sample; publishes only aggregate results.
Usage: python3 scripts/optimize_wage_marginals.py --archive asecpub25csv.zip
"""

from __future__ import annotations

import argparse
import csv
import io
import json
from pathlib import Path
import zipfile

import numpy as np
from scipy.optimize import linprog

from build_microdata import EXPECTED_SOURCE_SHA256, ROOT, read_person_units, source_sha256
from estimate_labor_response import (BASELINE, OTHER_BENEFITS_PER_CASH_WAGE,
                                     PENSION_PER_CASH_WAGE, current_tax)

MICRO = json.loads((ROOT / "src/data/microdata_2025.json").read_text())
REFERENCE = json.loads((ROOT / "analysis/labor_response_2025.json").read_text())["central"]
THRESHOLDS_PER_ADULT = np.array([0, 20_000, 75_000, 150_000, 300_000, np.inf])
INDIVIDUAL_BINS = np.array([0, 20_000, 75_000, 150_000, 300_000, np.inf])
INDIVIDUAL_NAMES = ["0–20k", "20–75k", "75–150k", "150–300k", "300k+"]
BASE_RATES = np.array([.25, .25, .35, .35, .35])
FISCAL_REFERENCE_BILLIONS = 190.67598860730754  # See transfer integration regression.


def bracket_lengths(compensation: np.ndarray, filing_adults: np.ndarray) -> np.ndarray:
    floor = filing_adults[:, None] * THRESHOLDS_PER_ADULT[:-1]
    ceiling = filing_adults[:, None] * THRESHOLDS_PER_ADULT[1:]
    return np.maximum(0, np.minimum(compensation[:, None], ceiling) - floor)


def transfer_receipt_by_tax_unit(archive_path: Path) -> dict[int, tuple[float, float]]:
    """Observed SPM SNAP/housing subsidies, repeated for members of each SPM unit.

    Only an explicitly labeled scenario uses these receipts as withdrawal proxies.
    SPM receipts are annual and cannot identify true local derivatives or cliffs.
    """
    result: dict[int, tuple[float, float]] = {}
    with zipfile.ZipFile(archive_path) as archive, archive.open("pppub25.csv") as raw:
        for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline="")):
            tax_id = int(row["TAX_ID"])
            if tax_id not in result:
                result[tax_id] = (float(row["SPM_SNAPSUB"] or 0),
                                  float(row["SPM_CAPHOUSESUB"] or 0))
    return result


def worker_sample(units: list[dict],
                  transfer_receipts: dict[int, tuple[float, float]],
                  *, include_employer_benefits: bool = True) -> dict[str, np.ndarray]:
    """Use the full cash-out benchmark or the website's wage-plus-FICA basis.

    The wage-only option excludes health and pension at the level and margin.
    It is useful for matching the household chart, not the national tax base.
    """
    cash_scale = BASELINE["compensationComponents"]["cashWagesAndSalaries"] * 1e9 / sum(
        u["headWeight"] * u["rawCashWage"] for u in units)
    rows = []
    for unit in units:
        raw = unit["earnerCashWages"]
        if not raw:
            continue
        earners = [w * cash_scale for w in raw]
        wage = sum(earners)
        married = unit["scheduleAdults"] == 2
        children = unit["children"]
        base_old, base_employer_fica = current_tax(earners, married, children, unit["childrenUnder17"])
        base_comp = wage * (1 + (OTHER_BENEFITS_PER_CASH_WAGE
                                 if include_employer_benefits else 0)) + base_employer_fica
        max_credit = unit["creditAdults"] * 2000
        snap, housing = transfer_receipts.get(unit["taxId"], (0, 0))
        for index, individual_wage in enumerate(earners):
            if individual_wage <= 0:
                continue
            incremented = earners.copy()
            incremented[index] += 1000
            old_plus, fica_plus = current_tax(
                incremented, married, children, unit["childrenUnder17"])
            extra_comp = 1000 * (1 + (PENSION_PER_CASH_WAGE
                                      if include_employer_benefits else 0)) + fica_plus - base_employer_fica
            # An unvalidated low-income sensitivity: 24% of extra gross wages
            # withdrawn from SNAP and 30% from housing, capped at the observed
            # annual subsidy; housing valued at 75% of government expenditure.
            snap_withdrawal = min(snap, .24 * 1000) / extra_comp
            housing_withdrawal = .75 * min(housing, .30 * 1000) / extra_comp
            rows.append((base_comp, base_comp + extra_comp, unit["scheduleAdults"],
                         (old_plus - base_old) / extra_comp,
                         snap_withdrawal, housing_withdrawal,
                         unit["creditAdults"],
                         unit["headWeight"], unit["headWeight"] * individual_wage,
                         individual_wage, extra_comp))
    data = np.asarray(rows, dtype=float)
    base, plus, adults, old, snap_withdrawal, housing_withdrawal, \
        credit_adults, weight, earnings_weight, wage, extra = data.T
    return {"old": old, "snapWithdrawalProxy": snap_withdrawal,
            "housingWithdrawalProxy": housing_withdrawal,
            "compBefore": base, "compAfter": plus,
            "creditAdults": credit_adults, "workerWeight": weight,
            "earningsWeight": earnings_weight, "wage": wage, "extraCost": extra,
            "filingAdults": adults,
            "matrix": (bracket_lengths(plus, adults) - bracket_lengths(base, adults)) / extra[:, None]}


def revenue_base() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, float]:
    distribution = np.asarray(MICRO["distribution"], dtype=float)
    wage, adults, credit_adults, weights = distribution.T
    social = BASELINE["compensationComponents"]["employerGovernmentSocialInsurance"]
    health = BASELINE["compensationComponents"]["employerHealthInsurance"]
    pension = BASELINE["compensationComponents"]["employerPensionAndOtherInsurance"]
    cash = BASELINE["compensationComponents"]["cashWagesAndSalaries"]
    compensation = wage * MICRO["calibration"]["cashWageScaleToBea2025"] * (
        1 + (social + health + pension) / cash)
    retained_share = (1 - BASELINE["defaultNoncomplianceRate"]) * (
        1 - BASELINE["defaultExemptionShare"])
    base = (bracket_lengths(compensation, adults) * weights[:, None]).sum(axis=0) \
        * retained_share / 1e9
    return base, compensation, credit_adults, weights, MICRO["calibration"]["adultPopulationScaleToCensus2025"]


def earned_credit_slope(sample: dict, maximum_per_adult: float,
                        phase_in: float) -> np.ndarray:
    maximum = sample["creditAdults"] * maximum_per_adult
    return (np.minimum(maximum, phase_in * sample["compAfter"])
            - np.minimum(maximum, phase_in * sample["compBefore"])) / sample["extraCost"]


def aggregate_credit_cost(maximum_per_adult: float, phase_in: float,
                          fiscal_data: tuple) -> float:
    _, compensation, adults, weights, adult_scale = fiscal_data
    return float(np.sum(weights * np.minimum(adults * maximum_per_adult,
                                           compensation * phase_in)) * adult_scale / 1e9)


def summarize(rates: np.ndarray, sample: dict, fiscal_data: tuple,
              maximum_per_adult: float = 2000, phase_in: float = .1) -> dict:
    old = sample["old"]
    credit = earned_credit_slope(sample, maximum_per_adult, phase_in)
    new = sample["matrix"] @ rates - credit
    weight = sample["workerWeight"]
    earnings = sample["earningsWeight"]
    increase = new > old + .0001
    bins = np.searchsorted(INDIVIDUAL_BINS[1:], sample["wage"], side="right")
    credit_cost_change = aggregate_credit_cost(maximum_per_adult, phase_in, fiscal_data) \
        - aggregate_credit_cost(2000, .1, fiscal_data)
    gross_change = float((rates - BASE_RATES) @ fiscal_data[0] - credit_cost_change)
    return {"wageRatesPercent": [round(100 * r, 3) for r in rates],
            "rate35StartsPerAdult": int(THRESHOLDS_PER_ADULT[np.flatnonzero(
                rates >= .35 - 1e-7)[0]]),
            "adultCreditMaximumPerAdult": maximum_per_adult,
            "adultCreditPhaseInPercent": round(phase_in * 100, 2),
            "extraAdultCreditCostBillions": round(credit_cost_change, 2),
            "staticWageRevenueChangeBillions": round(gross_change, 2),
            "illustrativeDeficitReductionBillions": round(FISCAL_REFERENCE_BILLIONS + gross_change, 2),
            "shareWorkersWithIncrease": round(float(weight[increase].sum() / weight.sum()), 5),
            "shareEarningsWithIncrease": round(float(earnings[increase].sum() / earnings.sum()), 5),
            "earningsWeightedOldMTR": round(float(np.average(old, weights=earnings)), 5),
            "earningsWeightedNewMTR": round(float(np.average(new, weights=earnings)), 5),
            "earningsBinMTRPercent": {
                name: {"current": round(100 * float(np.average(old[bins == idx],
                                                         weights=earnings[bins == idx])), 2),
                       "reform": round(100 * float(np.average(new[bins == idx],
                                                        weights=earnings[bins == idx])), 2)}
                for idx, name in enumerate(INDIVIDUAL_NAMES)},
            }


def optimize(sample: dict, annual_base: np.ndarray,
             maximum_per_adult: float = 2000, phase_in: float = .1) -> np.ndarray:
    # At each individual-wage bin, cap the earnings-weighted average reform MTR
    # at its own current-law value. Maximize revenue subject to monotone rates.
    groups = np.searchsorted(INDIVIDUAL_BINS[1:], sample["wage"], side="right")
    credit = earned_credit_slope(sample, maximum_per_adult, phase_in)
    a, b = [], []
    for idx in range(5):
        mask = groups == idx
        weights = sample["earningsWeight"][mask]
        a.append(np.average(sample["matrix"][mask, :4], axis=0, weights=weights))
        b.append(float(np.average(sample["old"][mask] + credit[mask]
                                     - .35 * sample["matrix"][mask, 4], weights=weights)))
    monotone = np.zeros((3, 4))
    for j in range(3):
        monotone[j, j] = 1
        monotone[j, j + 1] = -1
    result = linprog(-annual_base[:4], A_ub=np.vstack((a, monotone)),
                     b_ub=np.r_[b, 0, 0, 0], bounds=[(0, .35)] * 4, method="highs")
    if not result.success:
        raise RuntimeError(f"Group constraints infeasible: {result.message}")
    return np.r_[result.x, .35]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--output", type=Path,
                        default=ROOT / "analysis/wage_marginal_optimization_2025.json")
    args = parser.parse_args()
    if source_sha256(args.archive) != EXPECTED_SOURCE_SHA256:
        raise ValueError("Census input differs from pinned archive")
    units, _ = read_person_units(args.archive)
    sample = worker_sample(units, transfer_receipt_by_tax_unit(args.archive))
    fiscal = revenue_base()
    base = fiscal[0]
    original = summarize(BASE_RATES, sample, fiscal)
    if abs(original["earningsWeightedOldMTR"]
           - REFERENCE["oldEarningsWeightedFederalMTR"]) > .000015 \
        or abs(original["earningsWeightedNewMTR"]
               - REFERENCE["newEarningsWeightedFederalMTR"]) > .000015:
        raise ValueError("Worker method fails to reproduce the published run")
    lower = np.array([0, 0, 0, 0, .35])
    unavoidable = sample["matrix"] @ lower - earned_credit_slope(
        sample, 2000, .1) > sample["old"] + .0001
    optimized = optimize(sample, base)
    variants = {"original25to75kThen35": original,
                "leastRevenueCostWithEveryWageBinAverageProtected":
                    summarize(optimized, sample, fiscal),
                "middle25TopAt150k": summarize(np.array([.25, .25, .25, .35, .35]), sample, fiscal),
                "middle25TopAt300k": summarize(np.array([.25, .25, .25, .25, .35]), sample, fiscal)}
    credit_grid = [(maximum, phase) for maximum in (2000, 2400, 3000, 4000, 5000)
                   for phase in (.10, .12, .15, .20)]
    credit_results = []
    for maximum, phase in credit_grid:
        rates = optimize(sample, base, maximum, phase)
        credit_results.append(summarize(rates, sample, fiscal, maximum, phase))
    ranked_credit_results = sorted(credit_results,
                                   key=lambda row: row["staticWageRevenueChangeBillions"], reverse=True)
    variants["cheapestBinAverageProtectionIncludingEarnedCreditChanges"] = ranked_credit_results[0]
    # Retained state taxes are outside the requested federal-only comparison.
    # Replaced SNAP/housing withdrawals enter current law only. Their actual
    # derivatives are unknown, so score half/full hypothetical withdrawal.
    withdrawal_rankings = {}
    for label, snap_scale, housing_scale in (("half", .5, .5),
                                              ("snapOnly", 1.0, 0.0),
                                              ("full", 1.0, 1.0)):
        transfer_sample = {**sample, "old": sample["old"]
                           + snap_scale * sample["snapWithdrawalProxy"]
                           + housing_scale * sample["housingWithdrawalProxy"]}
        transfer_grid = []
        for maximum, phase in credit_grid:
            rates = optimize(transfer_sample, base, maximum, phase)
            transfer_grid.append(summarize(rates, transfer_sample, fiscal, maximum, phase))
        withdrawal_rankings[label] = sorted(
            transfer_grid, key=lambda row: row["staticWageRevenueChangeBillions"], reverse=True)
        variants[f"{label}SnapHousingWithdrawalProxyBinAverageProtection"] = withdrawal_rankings[label][0]
    fixed_top_mask = (sample["matrix"][:, 4] > .999) & (sample["old"] < .35 - .0001)
    output = {"schemaVersion": 1, "sourceArchiveSha256": EXPECTED_SOURCE_SHA256,
              "method": "2025 ASEC individual worker +$1,000 derivatives; $7,200 child and $3,000/$1,500 insurance credits unchanged; all employer benefits/FICA paid as taxable reform cash, fixed marginal health and pay-proportional pension; filing-adult wage bracket thresholds at $0/$20k/$75k/$150k/$300k, top wage and business rate fixed at 35%; monotone federal wage rates; linear program maximizes static wage revenue subject to no increase in the earnings-weighted average marginal rate of each of five individual cash-wage bins; no promise for every worker. Earned adult credit maximum and phase-in vary in a declared grid. State and local taxes are omitted from this federal comparison. SNAP and housing withdrawal proxies are separate, unvalidated sensitivities using observed SPM receipt; SPM housing includes assistance outside the tenant-based program proposed for repeal, so the full housing sensitivity overstates the affected group; retained Medicaid withdrawal omitted from both sides. ACA credit withdrawal, AMT/NIIT, and exact program cliffs are unavailable; this is not a complete all-in federal wedge. Static revenue delta uses same BEA-raked ASEC tax units and 7.5% noncompliance as web calculator; carry over $16,200 child and seven-program-swap reference deficit reduction; no behavioral or GE feedback.",
              "filingAdultWageBracketStarts": [0, 20000, 75000, 150000, 300000],
              "annualRevenueBaseBillionsByBracket": [round(float(x), 3) for x in base],
              "individualGuaranteeFeasibleWithCommonNonnegativeRates": False,
              "unavoidableIncreaseEvenWithZeroRatesBelow300k": {
                  "workerShare": round(float(sample["workerWeight"][unavoidable].sum()
                                             / sample["workerWeight"].sum()), 5),
                  "earningsShare": round(float(sample["earningsWeight"][unavoidable].sum()
                                               / sample["earningsWeight"].sum()), 5),
                  "reason": "Some old-law marginal wedges lie below the fixed 35% top rate, or below zero outside earned-credit phase-in; lower brackets alone cannot protect them. This bound holds the original earned credit fixed."},
              "workerShareWithCurrentRateBelow35InFixedTopBracket": round(
                  float(sample["workerWeight"][fixed_top_mask].sum()
                        / sample["workerWeight"].sum()), 5),
              "earnedCreditGrid": {"maximumPerAdult": [2000, 2400, 3000, 4000, 5000],
                                   "phaseInPercent": [10, 12, 15, 20]},
              "transferWithdrawalProxy": {"snapShareOfIncrementalGrossCashWage": .24,
                                          "housingShareOfIncrementalGrossCashWage": .30,
                                          "housingInKindValueShare": .75,
                                          "capAtObservedAnnualSurveyBenefit": True,
                                          "warning": "Receipt does not reveal actual marginal withdrawal, eligibility cliffs, or state rules; this scenario is exploratory only."},
              "fiveBestEarnedCreditGridRuns": [
                  {key: val for key, val in row.items() if key != "earningsBinMTRPercent"}
                  for row in ranked_credit_results[:5]],
              "fiveBestTransferProxyRuns": [
                  {key: val for key, val in row.items() if key != "earningsBinMTRPercent"}
                  for row in withdrawal_rankings["full"][:5]],
              "scenarios": variants}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(args.output), "scenarios": {
        k: {field: val for field, val in v.items() if field != "earningsBinMTRPercent"}
        for k, v in variants.items()}}, indent=2))


if __name__ == "__main__":
    main()
