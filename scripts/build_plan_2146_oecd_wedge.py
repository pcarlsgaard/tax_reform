#!/usr/bin/env python3
"""Build a transparent OECD-style household tax-wedge table for plan 2146.

The standard OECD denominator is gross wage earnings plus employer social
security contributions.  Because this experiment converts voluntary employer
health insurance into taxable cash, the report also supplies a comprehensive
employer-cost denominator that includes current employer ESI.  The latter is
the relevant denominator for the after-insurance cash comparison.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
CURRENT_LAW_PATH = ROOT / "src" / "data" / "current_law_2025.json"
HEALTH_PATH = ROOT / "src" / "data" / "health_esi_2025.json"
DEFAULT_MARKDOWN = ROOT / "analysis" / "plan_2146_oecd_tax_wedge_2025.md"
DEFAULT_CSV = ROOT / "analysis" / "plan_2146_oecd_tax_wedge_2025.csv"

AVERAGE_WAGE = 73_520.0
BENCHMARK_SCALE = 1.03
TOP_RATE = 0.35
MIDDLE_RATE_SHARE = 0.70
MIDDLE_RATE = TOP_RATE * MIDDLE_RATE_SHARE
TOP_THRESHOLD_PER_ADULT = 80_000.0
NONREFUNDABLE_ADULT_CREDIT = 3_000.0
REFUNDABLE_ADULT_CREDIT = 500.0
REFUNDABLE_CHILD_CREDIT = 2_000.0
ADULT_HEALTH_CREDIT = 3_250.0
CHILD_HEALTH_CREDIT = 1_250.0


@dataclass(frozen=True)
class Scenario:
    label: str
    status: str
    children: int
    primary_share: float
    secondary_share: float


SCENARIOS = (
    Scenario("Single, no children · 67% AW", "single", 0, 0.67, 0.0),
    Scenario("Single, no children · 100% AW", "single", 0, 1.0, 0.0),
    Scenario("Single, no children · 167% AW", "single", 0, 1.67, 0.0),
    Scenario("Single, 2 children · 67% AW", "single", 2, 0.67, 0.0),
    Scenario("Married, 2 children · 100% + 0% AW", "married", 2, 1.0, 0.0),
    Scenario("Married, 2 children · 100% + 33% AW", "married", 2, 1.0, 0.33),
    Scenario("Married, no children · 100% + 33% AW", "married", 0, 1.0, 0.33),
    Scenario("Married, 2 children · 100% + 67% AW", "married", 2, 1.0, 0.67),
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def bracket_tax(taxable_income: float, status: str, law: dict) -> float:
    result = 0.0
    lower = 0.0
    for upper_raw, rate in law["brackets"][status]:
        upper = math.inf if upper_raw is None else float(upper_raw)
        if taxable_income <= lower:
            break
        result += (min(taxable_income, upper) - lower) * rate
        lower = upper
    return result


def earned_income_credit(wage: float, status: str, children: int, law: dict) -> float:
    rule = law["eitc"][str(min(children, 3))]
    phase_in = min(float(rule["maximum"]), wage * rule["phaseInRate"])
    phase_out = max(0.0, wage - rule["phaseOutStart"][status]) * rule["phaseOutRate"]
    return max(0.0, phase_in - phase_out)


def current_law(primary: float, secondary: float, status: str, children: int, law: dict) -> dict:
    wage = primary + secondary
    taxable_income = max(0.0, wage - law["standardDeduction"][status])
    income_before_credits = bracket_tax(taxable_income, status, law)

    ctc = law["childTaxCredit"]
    excess = max(0.0, wage - ctc["phaseoutThreshold"][status])
    phaseout = math.ceil(excess / 1_000.0) * ctc["phaseoutPerThousand"] if excess else 0.0
    available_ctc = max(0.0, children * ctc["perChild"] - phaseout)
    nonrefundable_ctc = min(income_before_credits, available_ctc)
    unused_ctc = available_ctc - nonrefundable_ctc
    refundable_ctc = min(
        unused_ctc,
        children * ctc["refundablePerChild"],
        max(0.0, wage - ctc["refundEarnedIncomeFloor"]) * ctc["refundRate"],
    )
    eitc = earned_income_credit(wage, status, children, law)

    payroll = law["payroll"]
    social_security_base = (
        min(primary, payroll["socialSecurityWageCap"])
        + min(secondary, payroll["socialSecurityWageCap"])
    )
    employee_ss = social_security_base * payroll["socialSecurityRateEach"]
    employer_ss = employee_ss
    employee_medicare = wage * payroll["medicareRateEach"]
    employer_medicare = employee_medicare
    additional_medicare = max(
        0.0, wage - payroll["additionalMedicareThreshold"][status]
    ) * payroll["additionalMedicareRate"]
    income_after_credits = income_before_credits - nonrefundable_ctc - refundable_ctc - eitc
    employee_social = employee_ss + employee_medicare + additional_medicare
    employer_social = employer_ss + employer_medicare
    precredit_federal = income_before_credits + employee_social + employer_social
    net_federal = income_after_credits + employee_social + employer_social
    return {
        "income_before_credits": income_before_credits,
        "nonrefundable_ctc": nonrefundable_ctc,
        "refundable_ctc": refundable_ctc,
        "eitc": eitc,
        "income_after_credits": income_after_credits,
        "employee_ss": employee_ss,
        "employee_medicare": employee_medicare,
        "additional_medicare": additional_medicare,
        "employer_ss": employer_ss,
        "employer_medicare": employer_medicare,
        "employee_social": employee_social,
        "employer_social": employer_social,
        "precredit_federal": precredit_federal,
        "net_federal": net_federal,
    }


def split_after_premium(primary: float, secondary: float, premium: float) -> tuple[float, float]:
    total = primary + secondary
    if total <= 0:
        return 0.0, 0.0
    remaining_share = max(0.0, total - min(total, premium)) / total
    return primary * remaining_share, secondary * remaining_share


def benchmark_coefficients(health: dict) -> tuple[float, float]:
    """Linearize HIPM unit benchmarks into national adult and child amounts."""
    rows = np.asarray(health["distribution"], dtype=np.float64)
    adults = rows[:, 6]
    children = rows[:, 5] - rows[:, 6]
    benchmark = rows[:, 9]
    weights = rows[:, -1]
    design = np.column_stack([adults, children])
    root_weight = np.sqrt(weights)
    adult, child = np.linalg.lstsq(
        design * root_weight[:, None], benchmark * root_weight, rcond=None
    )[0]
    return float(adult) * BENCHMARK_SCALE, float(child) * BENCHMARK_SCALE


def plan_wage_tax(compensation: float, schedule_adults: int) -> float:
    top_threshold = schedule_adults * TOP_THRESHOLD_PER_ADULT
    middle_base = min(compensation, top_threshold)
    top_base = max(0.0, compensation - top_threshold)
    return middle_base * MIDDLE_RATE + top_base * TOP_RATE


def money(value: float) -> str:
    sign = "-" if value < -0.005 else ""
    return f"{sign}${abs(value):,.0f}"


def percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def tier_for(scenario: Scenario) -> int:
    if scenario.children:
        return 3
    return 2 if scenario.status == "married" else 1


def calculate_scenario(scenario: Scenario, law: dict, health: dict, adult_benchmark: float, child_benchmark: float) -> dict:
    primary = AVERAGE_WAGE * scenario.primary_share
    secondary = AVERAGE_WAGE * scenario.secondary_share
    original_cash = primary + secondary
    adults = 2 if scenario.status == "married" else 1
    tier = tier_for(scenario)

    employer_scale = health["calibration"]["employerContributionScaleToBea"]
    employer_health = health["mepsMeansDollars"]["privateEmployer2025"][str(tier)]["0"] * employer_scale
    employee_premium = health["mepsMeansDollars"]["privateEmployee2025"][str(tier)]
    current_primary, current_secondary = split_after_premium(primary, secondary, employee_premium)
    current = current_law(current_primary, current_secondary, scenario.status, scenario.children, law)

    social_cashout = current["employer_social"]
    health_cashout = health["calibration"]["nationalEqualWagePerPolicyholderWorker"]
    plan_cash = original_cash + social_cashout + health_cashout
    wage_tax = plan_wage_tax(plan_cash, adults)
    adult_nonrefundable = min(wage_tax, adults * NONREFUNDABLE_ADULT_CREDIT)
    adult_refundable = adults * REFUNDABLE_ADULT_CREDIT
    child_refundable = scenario.children * REFUNDABLE_CHILD_CREDIT
    benchmark = adults * adult_benchmark + scenario.children * child_benchmark
    health_credit = min(
        benchmark,
        adults * ADULT_HEALTH_CREDIT + scenario.children * CHILD_HEALTH_CREDIT,
    )
    plan_net_before_health = wage_tax - adult_nonrefundable - adult_refundable - child_refundable
    plan_net_after_health = plan_net_before_health - health_credit

    current_standard_cost = original_cash + current["employer_social"]
    current_full_cost = current_standard_cost + employer_health
    plan_standard_cost = plan_cash
    plan_full_cost = plan_cash
    current_takehome = (
        original_cash
        - employee_premium
        - current["income_after_credits"]
        - current["employee_social"]
    )
    plan_net_premium = benchmark - health_credit
    plan_takehome = plan_cash - plan_net_before_health - plan_net_premium

    current_values = {
        "Original gross cash wage": original_cash,
        "Employer Social Security contribution": current["employer_ss"],
        "Employer Medicare contribution": current["employer_medicare"],
        "Employer social-insurance contribution, total": current["employer_social"],
        "Employer health-insurance contribution": employer_health,
        "Employer social-insurance cashout into wages": 0.0,
        "Employer health-pool cashout into wages": 0.0,
        "Gross cash wage after cashouts": original_cash,
        "Taxable cash wage": current_primary + current_secondary,
        "Individual/wage tax before credits": current["income_before_credits"],
        "Employee Social Security contribution": current["employee_ss"],
        "Employee Medicare contribution": current["employee_medicare"],
        "Additional employee Medicare tax": current["additional_medicare"],
        "Pre-credit federal tax and social contributions": current["precredit_federal"],
        "Nonrefundable child tax credit": current["nonrefundable_ctc"],
        "Nonrefundable adult credit": 0.0,
        "Refundable child credit": current["refundable_ctc"],
        "Refundable adult wage credit": 0.0,
        "Earned income tax credit": current["eitc"],
        "Health-insurance credit": 0.0,
        "Net federal tax before health credit": current["net_federal"],
        "Net federal tax after health credit": current["net_federal"],
        "Gross annual health premium": employer_health + employee_premium,
        "Household-paid premium net of health credit": employee_premium,
        "OECD labour-cost denominator": current_standard_cost,
        "Comprehensive employer labour cost": current_full_cost,
        "OECD-style federal tax wedge": current["net_federal"] / current_standard_cost,
        "Full-compensation federal tax wedge": current["net_federal"] / current_full_cost,
        "Spendable cash after federal tax and insurance": current_takehome,
        "Spendable-cash wedge on comprehensive cost": 1.0 - current_takehome / current_full_cost,
    }
    plan_values = {
        "Original gross cash wage": original_cash,
        "Employer Social Security contribution": 0.0,
        "Employer Medicare contribution": 0.0,
        "Employer social-insurance contribution, total": 0.0,
        "Employer health-insurance contribution": 0.0,
        "Employer social-insurance cashout into wages": social_cashout,
        "Employer health-pool cashout into wages": health_cashout,
        "Gross cash wage after cashouts": plan_cash,
        "Taxable cash wage": plan_cash,
        "Individual/wage tax before credits": wage_tax,
        "Employee Social Security contribution": 0.0,
        "Employee Medicare contribution": 0.0,
        "Additional employee Medicare tax": 0.0,
        "Pre-credit federal tax and social contributions": wage_tax,
        "Nonrefundable child tax credit": 0.0,
        "Nonrefundable adult credit": adult_nonrefundable,
        "Refundable child credit": child_refundable,
        "Refundable adult wage credit": adult_refundable,
        "Earned income tax credit": 0.0,
        "Health-insurance credit": health_credit,
        "Net federal tax before health credit": plan_net_before_health,
        "Net federal tax after health credit": plan_net_after_health,
        "Gross annual health premium": benchmark,
        "Household-paid premium net of health credit": plan_net_premium,
        "OECD labour-cost denominator": plan_standard_cost,
        "Comprehensive employer labour cost": plan_full_cost,
        "OECD-style federal tax wedge": plan_net_after_health / plan_standard_cost,
        "Full-compensation federal tax wedge": plan_net_after_health / plan_full_cost,
        "Spendable cash after federal tax and insurance": plan_takehome,
        "Spendable-cash wedge on comprehensive cost": 1.0 - plan_takehome / plan_full_cost,
    }
    return {
        "scenario": scenario,
        "current": current_values,
        "plan": plan_values,
        "takehome_change": plan_takehome - current_takehome,
        "wedge_change": (
            plan_values["OECD-style federal tax wedge"]
            - current_values["OECD-style federal tax wedge"]
        ),
        "full_wedge_change": (
            plan_values["Full-compensation federal tax wedge"]
            - current_values["Full-compensation federal tax wedge"]
        ),
    }


def write_csv(path: Path, results: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for result in results:
        for component, current_value in result["current"].items():
            rows.append({
                "scenario": result["scenario"].label,
                "component": component,
                "current_law": current_value,
                "plan_2146": result["plan"][component],
                "change": result["plan"][component] - current_value,
            })
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(
    path: Path,
    results: list[dict],
    adult_benchmark: float,
    child_benchmark: float,
    health_cashout: float,
) -> None:
    lines = [
        "# Plan 2146 — OECD-style federal tax wedge",
        "",
        "## Summary",
        "",
        "| Household | Current OECD-style wedge | Plan 2146 | Change | Current spendable cash | Plan spendable cash | Cash change |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        current = result["current"]
        plan = result["plan"]
        lines.append(
            f"| {result['scenario'].label} | {percent(current['OECD-style federal tax wedge'])} "
            f"| {percent(plan['OECD-style federal tax wedge'])} | {result['wedge_change'] * 100:+.1f} pp "
            f"| {money(current['Spendable cash after federal tax and insurance'])} "
            f"| {money(plan['Spendable cash after federal tax and insurance'])} "
            f"| {money(result['takehome_change'])} |"
        )

    lines += [
        "",
        "The OECD-style wedge is federal income/wage tax plus employee and employer social contributions, net of modeled credits, divided by gross cash earnings plus employer social contributions. Plan 2146's health credit is treated as a cash benefit. Voluntary employer ESI is not in that standard denominator, so each detailed table also reports a comprehensive denominator and an after-insurance spendable-cash measure.",
        "",
        "## Detailed component tables",
        "",
    ]
    percent_rows = {
        "OECD-style federal tax wedge",
        "Full-compensation federal tax wedge",
        "Spendable-cash wedge on comprehensive cost",
    }
    for result in results:
        lines += [
            f"### {result['scenario'].label}",
            "",
            "| Component | Current law | Plan 2146 | Change |",
            "|---|---:|---:|---:|",
        ]
        for component, current_value in result["current"].items():
            plan_value = result["plan"][component]
            if component in percent_rows:
                current_text = percent(current_value)
                plan_text = percent(plan_value)
                change_text = f"{(plan_value - current_value) * 100:+.1f} pp"
            else:
                current_text = money(current_value)
                plan_text = money(plan_value)
                change_text = money(plan_value - current_value)
            lines.append(f"| {component} | {current_text} | {plan_text} | {change_text} |")
        lines.append("")

    lines += [
        "## Assumptions and interpretation",
        "",
        f"- OECD average wage used by the simulator: {money(AVERAGE_WAGE)}.",
        f"- Plan 2146: {percent(MIDDLE_RATE)} through {money(TOP_THRESHOLD_PER_ADULT)} per schedule adult, then {percent(TOP_RATE)}; {money(NONREFUNDABLE_ADULT_CREDIT)} nonrefundable adult credit; {money(REFUNDABLE_ADULT_CREDIT)} universal refundable adult credit; {money(REFUNDABLE_CHILD_CREDIT)} refundable child credit; and {money(ADULT_HEALTH_CREDIT)} adult/{money(CHILD_HEALTH_CREDIT)} child refundable health credit.",
        f"- One ESI policyholder per OECD household. The corrected CPS/MEPS/BEA health file reallocates {money(health_cashout)} per policyholder worker as wages regardless of plan tier.",
        "- Current ESI uses the BEA-raked 2025 private MEPS national mean: self-only for single adults, plus-one for married couples without children, and family for households with children. Employee premium contributions are treated as pretax for current income and payroll tax.",
        f"- The 2025 benchmark is a weighted linearization of linked CPS/HIPM second-lowest-cost Silver premiums: {money(adult_benchmark)} per adult and {money(child_benchmark)} per child. It is a national-average illustration, not an age/location quote.",
        "- Employer payroll-tax and employer-health cashouts are assumed to pass through 100%. Current employer health dollars are redistributed nationally among policyholder workers, so a particular household's Plan 2146 labour cost need not equal its current labour cost even though the aggregate pool reconciles.",
        "- Federal-only, wage-only calculation. It omits state/local income tax, sales tax, nonwage income, itemized deductions, take-up failures, and changes in hours, wages, premiums, or coverage.",
        "",
        "## Source definitions",
        "",
        "- OECD Taxing Wages methodology: https://www.oecd.org/en/publications/taxing-wages-2026_3a5169ef-en/full-report/methodology-and-limitations_f25b8cbc.html",
        "- Census 2025 ASEC data dictionary (GRPFTYP2 codes): https://www2.census.gov/programs-surveys/cps/techdocs/cpsmar25.pdf",
        "- MEPS-IC private-sector 2025 premium table: https://meps.ahrq.gov/data_stats/summ_tables/insr/national/series_1/2025/ic25_ia_g.pdf",
        "- Census HIPM benchmark-premium extract dictionary: https://www2.census.gov/library/working-papers/2025/demo/hipm-extract-data-dictionary.pdf",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--markdown", type=Path, default=DEFAULT_MARKDOWN)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    args = parser.parse_args()
    law = load_json(CURRENT_LAW_PATH)
    health = load_json(HEALTH_PATH)
    adult_benchmark, child_benchmark = benchmark_coefficients(health)
    results = [
        calculate_scenario(scenario, law, health, adult_benchmark, child_benchmark)
        for scenario in SCENARIOS
    ]
    write_csv(args.csv, results)
    health_cashout = health["calibration"]["nationalEqualWagePerPolicyholderWorker"]
    write_markdown(
        args.markdown,
        results,
        adult_benchmark,
        child_benchmark,
        health_cashout,
    )
    print(f"Adult benchmark: {money(adult_benchmark)}")
    print(f"Child benchmark: {money(child_benchmark)}")
    print(f"Wrote {args.markdown}")
    print(f"Wrote {args.csv}")


if __name__ == "__main__":
    main()
