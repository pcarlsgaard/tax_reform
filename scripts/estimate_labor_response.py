#!/usr/bin/env python3
"""Tax-unit labor incentives and a CBO-inspired long-run response sensitivity.

Usage: python3 scripts/estimate_labor_response.py --archive /path/to/asecpub25csv.zip
Never stores Census respondents or tax-unit identifiers in the repository.
The current-law calculator is the repo's wage-only 2025 illustration translated
from src/model/household.ts; it is not CBO's confidential return-based model.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from build_microdata import EXPECTED_SOURCE_SHA256, ROOT, read_person_units, source_sha256

LAW = json.loads((ROOT / "src/data/current_law_2025.json").read_text())
BASELINE = json.loads((ROOT / "src/data/baseline_2025.json").read_text())
TRANSFERS = json.loads((ROOT / "src/data/transfers_2025.json").read_text())
SWAP_CHILD_CREDIT = 7200 + sum(
    row["federalFiscalAmountBillions"] for row in TRANSFERS["programs"]
) * 1000 / BASELINE["populationsMillions"]["children"]
OTHER_BENEFITS_PER_CASH_WAGE = (
    BASELINE["compensationComponents"]["employerHealthInsurance"]
    + BASELINE["compensationComponents"]["employerPensionAndOtherInsurance"]
) / BASELINE["compensationComponents"]["cashWagesAndSalaries"]


def current_tax(earners: list[float], married: bool, children: int,
                children_under17: int | None = None) -> tuple[float, float]:
    """Federal tax including both payroll sides, per-person SS caps; returns employer FICA."""
    status = "married" if married else "single"
    wage = sum(earners)
    taxable = max(0.0, wage - LAW["standardDeduction"][status])
    regular = 0.0
    lower = 0.0
    for upper, rate in LAW["brackets"][status]:
        if taxable <= lower:
            break
        upper = upper if upper is not None else float("inf")
        regular += (min(taxable, upper) - lower) * rate
        lower = upper
    ctc = LAW["childTaxCredit"]
    count = min(4, children if children_under17 is None else children_under17)
    phased = (math.ceil(max(0, wage - ctc["phaseoutThreshold"][status]) / 1000)
              * ctc["phaseoutPerThousand"])
    available = max(0, count * ctc["perChild"] - phased)
    nonrefundable = min(regular, available)
    refundable = min(available - nonrefundable, count * ctc["refundablePerChild"],
                     max(0, wage - ctc["refundEarnedIncomeFloor"]) * ctc["refundRate"])
    eitc = LAW["eitc"][str(min(3, children))]
    earned = max(0, min(eitc["maximum"], wage * eitc["phaseInRate"])
                 - max(0, wage - eitc["phaseOutStart"][status]) * eitc["phaseOutRate"])
    payroll = LAW["payroll"]
    ss = sum(min(w, payroll["socialSecurityWageCap"]) for w in earners)
    employer_fica = ss * payroll["socialSecurityRateEach"] + wage * payroll["medicareRateEach"]
    extra_medicare = max(0, wage - payroll["additionalMedicareThreshold"][status]) * payroll["additionalMedicareRate"]
    return regular - nonrefundable - refundable - earned + 2 * employer_fica + extra_medicare, employer_fica


def reform_tax(earners: list[float], married: bool, credit_adults: int, children: int,
               *, zero_bracket: int = 0, child_credit: int = 7200,
               insurance_credit: bool = True,
               health_adults_under65: int | None = None,
               benefit_cash_out_share: float = 0.0,
               fica_cash_credit_share: float = 1.0,
               employer_pass_through: float = 1.0, benefit_share: float = OTHER_BENEFITS_PER_CASH_WAGE,
               benefit_amount: float | None = None) -> float:
    wage = sum(earners)
    employer_fica = current_tax(earners, married, children)[1]
    benefits = wage * benefit_share if benefit_amount is None else benefit_amount
    compensation = wage + benefits
    compensation += employer_pass_through * employer_fica
    schedule_adults = 2 if married else 1
    zero = schedule_adults * zero_bracket
    top = max(zero, schedule_adults * 75000)
    business_wage_tax = .25 * max(0, min(compensation, top) - zero) + .35 * max(0, compensation - top)
    # Cash-out changes earned-credit eligibility, not the wage-tax base:
    # compensation is taxed at the same rate whether paid by employers in kind or cash.
    cash_earnings_for_credit = wage + benefit_cash_out_share * benefits
    cash_earnings_for_credit += fica_cash_credit_share * employer_pass_through * employer_fica
    adult_credit = min(credit_adults * 2000, .10 * cash_earnings_for_credit)
    # A flat purchase credit affects the tax level but not the marginal tax rate.
    # We assume full qualifying coverage for these units; enrollment is not in this sample.
    health_credit = (3000 * (credit_adults if health_adults_under65 is None else health_adults_under65)
                     + 1500 * children) if insurance_credit else 0
    return business_wage_tax - adult_credit - child_credit * children - health_credit


def weighted_quantile(items: list[tuple[float, float]], quantile: float) -> float:
    total = sum(weight for _, weight in items)
    target = total * quantile
    running = 0.0
    for value, weight in sorted(items):
        running += weight
        if running >= target:
            return value
    return items[-1][0]


def score(units: list[dict], *, zero_bracket: int = 0, child_credit: float = 7200,
          insurance_credit: bool = True,
          benefit_cash_out_share: float = 0.0,
          fica_cash_credit_share: float = 1.0,
          employer_pass_through: float = 1.0, substitution_primary: float = .25,
          substitution_secondary: float = .32, income_elasticity: float = -.05,
          benefit_share: float = OTHER_BENEFITS_PER_CASH_WAGE,
          marginal_benefit_share: float = OTHER_BENEFITS_PER_CASH_WAGE,
          capital_wage_ratio: float = 1.0083745732907252) -> dict:
    cash_scale = BASELINE["compensationComponents"]["cashWagesAndSalaries"] * 1e9 / sum(
        u["headWeight"] * u["rawCashWage"] for u in units)
    totals = {k: 0.0 for k in ["wages", "responding_wages", "old_marginal", "new_marginal",
                               "lowering_wages", "raising_wages", "lowering_workers", "raising_workers",
                               "workers", "substitution", "income", "old_average", "new_average"]}
    histogram = {label: {"wages": 0.0, "workers": 0.0, "old_mtr": 0.0, "new_mtr": 0.0,
                         "substitution": 0.0, "income": 0.0} for label in
                 ["0–20k", "20–75k", "75–150k", "150–300k", "300k+"]}
    sample_marginal: list[tuple[float, float]] = []
    for unit in units:
        if not unit["earnerCashWages"]:
            continue
        earners = [w * cash_scale for w in unit["earnerCashWages"]]
        weight = unit["headWeight"]
        married = unit["scheduleAdults"] == 2
        children = unit["children"]
        children_under17 = unit["childrenUnder17"]
        adults = unit["creditAdults"]
        health_adults = unit["healthCreditAdultsUnder65"]
        base_benefit_amount = sum(earners) * benefit_share
        old_tax, employer_fica = current_tax(earners, married, children, children_under17)
        new_tax = reform_tax(earners, married, adults, children, zero_bracket=zero_bracket,
                             child_credit=child_credit, insurance_credit=insurance_credit,
                             health_adults_under65=health_adults,
                             benefit_cash_out_share=benefit_cash_out_share,
                             fica_cash_credit_share=fica_cash_credit_share,
                             employer_pass_through=employer_pass_through,
                             benefit_amount=base_benefit_amount)
        old_comp = sum(earners) + base_benefit_amount + employer_fica
        for index, wage in enumerate(earners):
            if wage <= 0:
                continue
            perturbed = earners.copy()
            perturbed[index] += 1000
            old_plus, fica_plus = current_tax(perturbed, married, children, children_under17)
            new_plus = reform_tax(perturbed, married, adults, children,
                                  zero_bracket=zero_bracket, child_credit=child_credit,
                                  insurance_credit=insurance_credit,
                                  health_adults_under65=health_adults,
                                  benefit_cash_out_share=benefit_cash_out_share,
                                  fica_cash_credit_share=fica_cash_credit_share,
                                  employer_pass_through=employer_pass_through,
                                  benefit_amount=base_benefit_amount + marginal_benefit_share * 1000)
            increment = 1000 * (1 + marginal_benefit_share) + fica_plus - employer_fica
            # Both compared against baseline labor cost per $1000 of cash wages.
            old_mtr = (old_plus - old_tax) / increment
            new_mtr = (new_plus - new_tax) / increment
            old_avg = old_tax / old_comp
            new_avg = new_tax / old_comp
            if old_mtr >= .99 or old_avg >= .99:
                raise ValueError("Tax wedge at or above 99%; inspect the source unit")
            eps = substitution_primary if index == 0 else substitution_secondary
            substitution = eps * (capital_wage_ratio * (1 - new_mtr) / (1 - old_mtr) - 1)
            income = income_elasticity * (capital_wage_ratio * (1 - new_avg) / (1 - old_avg) - 1)
            work_weight = wage * weight
            totals["wages"] += work_weight
            totals["responding_wages"] += work_weight * (1 + substitution + income)
            totals["old_marginal"] += work_weight * old_mtr
            totals["new_marginal"] += work_weight * new_mtr
            totals["old_average"] += work_weight * old_avg
            totals["new_average"] += work_weight * new_avg
            totals["substitution"] += work_weight * substitution
            totals["income"] += work_weight * income
            totals["workers"] += weight
            if new_mtr < old_mtr - .0001:
                totals["lowering_wages"] += work_weight
                totals["lowering_workers"] += weight
            if new_mtr > old_mtr + .0001:
                totals["raising_wages"] += work_weight
                totals["raising_workers"] += weight
            label = ("0–20k" if wage < 20000 else "20–75k" if wage < 75000
                     else "75–150k" if wage < 150000 else "150–300k" if wage < 300000 else "300k+")
            bucket = histogram[label]
            for key, value in [("wages", work_weight), ("workers", weight),
                               ("old_mtr", old_mtr * work_weight), ("new_mtr", new_mtr * work_weight),
                               ("substitution", substitution * work_weight), ("income", income * work_weight)]:
                bucket[key] += value
            sample_marginal.append((new_mtr - old_mtr, work_weight))
    wage_total = totals["wages"]
    return {
        "settings": {"zeroBracketPerAdult": zero_bracket, "middleRate": .25,
                     "topThresholdPerAdult": 75000, "topRate": .35,
                     "adultCreditPerAdult": 2000, "adultCreditPhaseIn": .10,
                     "childCreditPerChild": child_credit,
                     "insuranceCreditAdultUnder65": 3000 if insurance_credit else 0,
                     "insuranceCreditChild": 1500 if insurance_credit else 0,
                     "benefitCashOutShareIntoEarnedCredit": benefit_cash_out_share,
                     "employerFicaPassThroughInEarnedCredit": fica_cash_credit_share,
                     "employerPayrollPassThrough": employer_pass_through,
                     "employerBenefitPerCashWage": benefit_share,
                     "marginalBenefitPerDollarCashWage": marginal_benefit_share,
                     "capitalInducedWageRatio": capital_wage_ratio},
        "cashWageControlBillions": wage_total / 1e9,
        "weightedWorkersMillions": totals["workers"] / 1e6,
        "oldEarningsWeightedFederalMTR": totals["old_marginal"] / wage_total,
        "newEarningsWeightedFederalMTR": totals["new_marginal"] / wage_total,
        "oldEarningsWeightedFederalATR": totals["old_average"] / wage_total,
        "newEarningsWeightedFederalATR": totals["new_average"] / wage_total,
        "workerShareLowerMTR": totals["lowering_workers"] / totals["workers"],
        "earningsShareLowerMTR": totals["lowering_wages"] / wage_total,
        "workerShareHigherMTR": totals["raising_workers"] / totals["workers"],
        "earningsShareHigherMTR": totals["raising_wages"] / wage_total,
        "medianEarningsWeightedMTRChange": weighted_quantile(sample_marginal, .5),
        "substitutionHoursChange": totals["substitution"] / wage_total,
        "incomeHoursChange": totals["income"] / wage_total,
        "totalHoursChange": totals["responding_wages"] / wage_total - 1,
        "byIndividualEarnings": {
            name: {"earningsShare": b["wages"] / wage_total,
                   "workersMillions": b["workers"] / 1e6,
                   "oldMTR": b["old_mtr"] / b["wages"] if b["wages"] else None,
                   "newMTR": b["new_mtr"] / b["wages"] if b["wages"] else None,
                   "substitutionHoursChange": b["substitution"] / b["wages"] if b["wages"] else None,
                   "incomeHoursChange": b["income"] / b["wages"] if b["wages"] else None}
            for name, b in histogram.items()},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "analysis/labor_response_2025.json")
    args = parser.parse_args()
    if source_sha256(args.archive) != EXPECTED_SOURCE_SHA256:
        raise ValueError("Census archive does not match the pinned public input")
    units, sample = read_person_units(args.archive)
    central = score(units)
    variants = {
        "oldZeroBracket17k": score(units, zero_bracket=17000),
        "childCredit6k": score(units, child_credit=6000),
        "childCredit12k": score(units, child_credit=12000),
        "universalChildCreditSwap": score(units, child_credit=SWAP_CHILD_CREDIT),
        "illustrativeFamilySafeguard16k2": score(units, child_credit=16200),
        "employerFicaNotCreditedAsCash": score(units, fica_cash_credit_share=0),
        "halfBenefitsCashOut": score(units, benefit_cash_out_share=.5, fica_cash_credit_share=1),
        "allBenefitsCashOut": score(units, benefit_cash_out_share=1, fica_cash_credit_share=1),
        "noInsurancePurchaseCredit": score(units, insurance_credit=False),
        "halfEmployerFicaPassThrough": score(units, employer_pass_through=.5),
        "cashAndFicaOnly": score(units, benefit_share=0),
        "benefitsFixedAtMargin": score(units, marginal_benefit_share=0),
        "pensionBenefitsMarginal": score(units, marginal_benefit_share=(
            BASELINE["compensationComponents"]["employerPensionAndOtherInsurance"]
            / BASELINE["compensationComponents"]["cashWagesAndSalaries"])),
        "allBenefitsMarginal": score(units, marginal_benefit_share=OTHER_BENEFITS_PER_CASH_WAGE),
        "noCapitalWageBoost": score(units, capital_wage_ratio=1),
        "lowSubstitutionResponse": score(units, substitution_primary=.15, substitution_secondary=.22),
        "highSubstitutionResponse": score(units, substitution_primary=.35, substitution_secondary=.42),
    }
    output = {"schemaVersion": 1, "source": "2025 CPS ASEC, income year 2024, projected to 2025 BEA wages",
              "archiveSha256": EXPECTED_SOURCE_SHA256, "sample": sample,
              "method": "Wage-only current law; +$1,000 per worker; employer cost denominator; proportional employer health/pension benefits taxable under reform; full insurance purchase-credit take-up assumed; earnings weights; CBO 2026 elasticities .25/.32 and income -.05; no social-program receipt, transfer withdrawal or participation of current nonworkers",
              "central": central,
              "sensitivities": {name: {"oldEarningsWeightedFederalMTR": v["oldEarningsWeightedFederalMTR"],
                                       "newEarningsWeightedFederalMTR": v["newEarningsWeightedFederalMTR"],
                                       "totalHoursChange": v["totalHoursChange"],
                                       "substitutionHoursChange": v["substitutionHoursChange"],
                                       "incomeHoursChange": v["incomeHoursChange"]}
                               for name, v in variants.items()}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "central": {k: central[k] for k in
                      ["oldEarningsWeightedFederalMTR", "newEarningsWeightedFederalMTR",
                       "workerShareLowerMTR", "earningsShareLowerMTR", "totalHoursChange"]}}, indent=2))


if __name__ == "__main__":
    main()
