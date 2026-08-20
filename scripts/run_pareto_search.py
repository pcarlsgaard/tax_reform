#!/usr/bin/env python3
"""Search X-tax and refundable-credit designs against selectable fiscal targets.

This is an offline policy search, not part of the browser bundle.  It combines
the checked-in national CPS tax-unit cells for the fiscal score with the linked
CPS/HIPM/MEPS health cells for employer-health transition incidence.  Keeping
the samples separate avoids treating the ESI population as nationally
representative.

The search solves the headline/business rate for every credit design.  It then
constructs a Pareto frontier that maximizes the share of ESI-covered people in
non-losing tax units while minimizing the mean absolute change in their
effective marginal tax rate and the headline business rate.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path

try:
    import numpy as np
except ImportError as error:  # pragma: no cover - exercised only in an incomplete environment
    raise SystemExit("The Pareto search requires NumPy (python3 -m pip install numpy)") from error


ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "src" / "data" / "baseline_2025.json"
CURRENT_LAW_PATH = ROOT / "src" / "data" / "current_law_2025.json"
MICRODATA_PATH = ROOT / "src" / "data" / "microdata_2025.json"
HEALTH_PATH = ROOT / "src" / "data" / "health_esi_2025.json"
NONGROUP_HEALTH_PATH = ROOT / "src" / "data" / "health_nongroup_2025.json"
REFUNDABLE_OUTLAYS_PATH = ROOT / "src" / "data" / "refundable_tax_credit_outlays_2025.json"
DEFAULT_OUTPUT_DIR = ROOT / "analysis"

NONCOMPLIANCE_RATE = 0.075
BENCHMARK_SCALE = 1.03
EMPLOYER_FICA_PASS_THROUGH = 1.0
EMPLOYER_HEALTH_PASS_THROUGH = 1.0
EMPLOYEE_PREMIUM_PRETAX_SHARE = 1.0
MTR_HALF_WINDOW = 500.0
RATE_FLOOR = 0.10
RATE_CEILING = 0.60
RATE_STEP = 0.005
FISCAL_TARGETS = {
    "replacement": {
        "additional_revenue_percent_gdp": 0.0,
        "label": "Tax-replacement neutrality",
    },
    "near_term_debt": {
        "additional_revenue_percent_gdp": 0.016,
        "label": "CBO February 2026 one-year debt-to-GDP stabilization anchor",
    },
    "long_run_debt": {
        "additional_revenue_percent_gdp": 0.047,
        "label": "Treasury 75-year debt-to-GDP stabilization anchor",
    },
}


@dataclass(frozen=True)
class Candidate:
    candidate_id: int
    family: str
    adult_relief_architecture: str
    zero_bracket: float
    middle_rate_share: float
    top_bracket: float
    nonrefundable_adult_credit: float
    wage_credit: float
    wage_credit_mode: str
    wage_credit_phase_in: float
    child_credit: float
    adult_health_credit: float
    child_health_credit: float


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def weighted_quantile(values: np.ndarray, weights: np.ndarray, quantile: float) -> float:
    usable = np.isfinite(values) & (weights > 0)
    if not np.any(usable):
        return 0.0
    ordered = np.argsort(values[usable])
    selected_values = values[usable][ordered]
    selected_weights = weights[usable][ordered]
    threshold = float(np.sum(selected_weights)) * min(1.0, max(0.0, quantile))
    index = int(np.searchsorted(np.cumsum(selected_weights), threshold, side="left"))
    return float(selected_values[min(index, len(selected_values) - 1)])


def bracket_tax(income: np.ndarray, married: np.ndarray, current_law: dict) -> np.ndarray:
    result = np.zeros_like(income)
    for is_married, status in ((False, "single"), (True, "married")):
        mask = married == is_married
        taxable = income[mask]
        tax = np.zeros_like(taxable)
        lower = 0.0
        for upper_raw, rate in current_law["brackets"][status]:
            upper = math.inf if upper_raw is None else float(upper_raw)
            tax += np.maximum(0.0, np.minimum(taxable, upper) - lower) * rate
            lower = upper
        result[mask] = tax
    return result


def current_law_tax(
    primary: np.ndarray,
    secondary: np.ndarray,
    children_raw: np.ndarray,
    married: np.ndarray,
    current_law: dict,
) -> dict[str, np.ndarray]:
    wage = primary + secondary
    children = np.minimum(4.0, np.maximum(0.0, np.floor(children_raw)))
    deduction = np.where(
        married,
        current_law["standardDeduction"]["married"],
        current_law["standardDeduction"]["single"],
    )
    income_before_credits = bracket_tax(np.maximum(0.0, wage - deduction), married, current_law)

    ctc = current_law["childTaxCredit"]
    phaseout_threshold = np.where(
        married, ctc["phaseoutThreshold"]["married"], ctc["phaseoutThreshold"]["single"]
    )
    excess = np.maximum(0.0, wage - phaseout_threshold)
    phaseout = np.where(excess > 0, np.ceil(excess / 1000.0) * ctc["phaseoutPerThousand"], 0.0)
    available_ctc = np.maximum(0.0, children * ctc["perChild"] - phaseout)
    nonrefundable_ctc = np.minimum(income_before_credits, available_ctc)
    refundable_ctc = np.minimum.reduce([
        available_ctc - nonrefundable_ctc,
        children * ctc["refundablePerChild"],
        np.maximum(0.0, wage - ctc["refundEarnedIncomeFloor"]) * ctc["refundRate"],
    ])

    eitc = np.zeros_like(wage)
    child_category = np.minimum(3, children.astype(int))
    for category in range(4):
        rule = current_law["eitc"][str(category)]
        for is_married, status in ((False, "single"), (True, "married")):
            mask = (child_category == category) & (married == is_married)
            phase_in = np.minimum(rule["maximum"], wage[mask] * rule["phaseInRate"])
            phase_out = np.maximum(0.0, wage[mask] - rule["phaseOutStart"][status]) * rule["phaseOutRate"]
            eitc[mask] = np.maximum(0.0, phase_in - phase_out)

    payroll = current_law["payroll"]
    employee_social_security = (
        np.minimum(primary, payroll["socialSecurityWageCap"])
        + np.minimum(secondary, payroll["socialSecurityWageCap"])
    ) * payroll["socialSecurityRateEach"]
    employee_medicare = wage * payroll["medicareRateEach"]
    additional_threshold = np.where(
        married,
        payroll["additionalMedicareThreshold"]["married"],
        payroll["additionalMedicareThreshold"]["single"],
    )
    additional_medicare = np.maximum(0.0, wage - additional_threshold) * payroll["additionalMedicareRate"]
    employee_payroll = employee_social_security + employee_medicare + additional_medicare
    employer_payroll = employee_social_security + employee_medicare
    credits = nonrefundable_ctc + refundable_ctc + eitc
    total_federal = income_before_credits - credits + employee_payroll + employer_payroll
    return {
        "income_before_credits": income_before_credits,
        "credits": credits,
        "employee_payroll": employee_payroll,
        "employer_payroll": employer_payroll,
        "total_federal": total_federal,
    }


def split_after_premium(
    primary: np.ndarray, secondary: np.ndarray, premium: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    total = primary + secondary
    remaining = np.divide(
        np.maximum(0.0, total - np.minimum(total, premium)),
        total,
        out=np.zeros_like(total),
        where=total > 0,
    )
    return primary * remaining, secondary * remaining


def progressive_bases(
    compensation: np.ndarray,
    schedule_adults: np.ndarray,
    candidate: Candidate,
) -> tuple[np.ndarray, np.ndarray]:
    if candidate.family == "flat":
        return compensation, np.zeros_like(compensation)
    zero = schedule_adults * candidate.zero_bracket
    top = np.maximum(zero, schedule_adults * candidate.top_bracket)
    middle_base = np.maximum(0.0, np.minimum(compensation, top) - zero)
    top_base = np.maximum(0.0, compensation - top)
    return middle_base, top_base


def rate_on_step(value: float) -> float:
    return math.floor(value / RATE_STEP + 0.5 + 1e-12) * RATE_STEP


def effective_middle_rate(candidate: Candidate, headline_rate: float) -> float:
    if candidate.family == "flat":
        return headline_rate
    return min(headline_rate, max(0.0, rate_on_step(headline_rate * candidate.middle_rate_share)))


def reform_wage_tax(
    compensation: np.ndarray,
    schedule_adults: np.ndarray,
    candidate: Candidate,
    headline_rate: float,
) -> np.ndarray:
    middle_base, top_base = progressive_bases(compensation, schedule_adults, candidate)
    return middle_base * effective_middle_rate(candidate, headline_rate) + top_base * headline_rate


def wage_credit(compensation: np.ndarray, adults: np.ndarray, candidate: Candidate) -> np.ndarray:
    maximum = adults * candidate.wage_credit
    if candidate.wage_credit_mode == "universal":
        return maximum
    return np.minimum(maximum, compensation * candidate.wage_credit_phase_in)


class SearchModel:
    def __init__(
        self,
        fiscal_target_mode: str = "replacement",
        uninsured_takeup: float = 0.15,
    ) -> None:
        if fiscal_target_mode not in FISCAL_TARGETS:
            raise ValueError(f"Unknown fiscal target mode: {fiscal_target_mode}")
        self.fiscal_target_mode = fiscal_target_mode
        self.fiscal_target = FISCAL_TARGETS[fiscal_target_mode]
        self.baseline = load_json(BASELINE_PATH)
        self.current_law = load_json(CURRENT_LAW_PATH)
        self.microdata = load_json(MICRODATA_PATH)
        self.health = load_json(HEALTH_PATH)
        self.nongroup_health = load_json(NONGROUP_HEALTH_PATH)
        if not 0 <= uninsured_takeup <= 1:
            raise ValueError("Uninsured take-up must be between zero and one")
        self.uninsured_takeup = uninsured_takeup
        refundable_outlays = load_json(REFUNDABLE_OUTLAYS_PATH)

        micro = np.asarray(self.microdata["distribution"], dtype=np.float64)
        self.micro_cash = micro[:, 0] * self.microdata["calibration"]["cashWageScaleToBea2025"]
        self.micro_schedule_adults = micro[:, 1]
        self.micro_credit_adults = micro[:, 2]
        self.micro_weight = micro[:, 3]
        compensation_ratio = (
            self.baseline["components"]["compensation"]
            / self.baseline["compensationComponents"]["cashWagesAndSalaries"]
        )
        self.micro_compensation = self.micro_cash * compensation_ratio
        self.adult_population_scale = self.microdata["calibration"]["adultPopulationScaleToCensus2025"]

        rows = np.asarray(self.health["distribution"], dtype=np.float64)
        wage_scale = self.health["calibration"]["cashWageScaleToBea2025"]
        self.health_primary = rows[:, 0] * wage_scale
        self.health_secondary = rows[:, 1] * wage_scale
        self.health_schedule_adults = rows[:, 2]
        self.health_credit_adults = rows[:, 3]
        self.health_children = rows[:, 4]
        self.health_covered_people = rows[:, 5]
        self.health_covered_adults = rows[:, 6]
        self.health_covered_children = np.maximum(0.0, self.health_covered_people - self.health_covered_adults)
        self.health_employee_premium = rows[:, 7]
        self.health_employer_contribution = rows[:, 8]
        self.health_benchmark_2024 = rows[:, 9]
        self.health_wage = rows[:, 10]
        self.health_decile = rows[:, 20].astype(int)
        self.health_weight = rows[:, 21]
        self.covered_weight = self.health_weight * self.health_covered_people
        self.total_covered_weight = float(np.sum(self.covered_weight))

        nongroup_rows = np.asarray(self.nongroup_health["distribution"], dtype=np.float64)
        self.nongroup_status = nongroup_rows[:, 0].astype(int)
        self.nongroup_adults = nongroup_rows[:, 1]
        self.nongroup_children = nongroup_rows[:, 2]
        self.nongroup_benchmark_2024 = nongroup_rows[:, 3]
        self.nongroup_current_aptc_2024 = nongroup_rows[:, 4]
        self.nongroup_weight = nongroup_rows[:, 5]
        status_scales = self.nongroup_health["statusWeightScales"]
        self.nongroup_status_scale = np.asarray(
            [float(status_scales[str(status)]) for status in self.nongroup_status]
        )

        pretax_premium = self.health_employee_premium * EMPLOYEE_PREMIUM_PRETAX_SHARE
        current_primary, current_secondary = split_after_premium(
            self.health_primary, self.health_secondary, pretax_premium
        )
        self.health_current = current_law_tax(
            current_primary,
            current_secondary,
            self.health_children,
            self.health_schedule_adults == 2,
            self.current_law,
        )
        self.current_disposable = (
            self.health_primary
            + self.health_secondary
            - self.health_current["income_before_credits"]
            - self.health_current["employee_payroll"]
            + self.health_current["credits"]
            - self.health_employee_premium
        )
        self.health_fica = self.health_current["employer_payroll"] * EMPLOYER_FICA_PASS_THROUGH

        current_down, down_employer_comp, down_employer_payroll = self._current_tax_wedge_at(-MTR_HALF_WINDOW)
        current_up, up_employer_comp, up_employer_payroll = self._current_tax_wedge_at(MTR_HALF_WINDOW)
        denominator = up_employer_comp - down_employer_comp
        self.current_mtr = np.divide(
            current_up - current_down,
            denominator,
            out=np.zeros_like(denominator),
            where=denominator > 0,
        )
        self.mtr_denominator = denominator
        self.health_fica_by_delta = {
            -MTR_HALF_WINDOW: down_employer_payroll * EMPLOYER_FICA_PASS_THROUGH,
            0.0: self.health_fica,
            MTR_HALF_WINDOW: up_employer_payroll * EMPLOYER_FICA_PASS_THROUGH,
        }

        components = self.baseline["components"]
        theoretical_base = (
            components["compensation"]
            + components["netCapitalIncomeAfterInvestment"]
            + components["netImports"]
            + components["housingAdjustment"]
        )
        self.business_base = (
            theoretical_base - components["compensation"]
        ) * (1 - NONCOMPLIANCE_RATE)
        replaced_receipts = sum(self.baseline["federalReceipts"].values())
        outlay_savings = sum(item["actualOutlaysBillions"] for item in refundable_outlays["items"])
        self.replacement_target_revenue = replaced_receipts - outlay_savings
        self.additional_revenue_percent_gdp = self.fiscal_target["additional_revenue_percent_gdp"]
        self.additional_revenue_billions = (
            self.baseline["gdp"] * self.additional_revenue_percent_gdp
        )
        self.target_revenue = self.replacement_target_revenue + self.additional_revenue_billions
        self.child_population_millions = self.baseline["populationsMillions"]["children"]
        self.health_cost_cache: dict[tuple[float, float, float], float] = {}
        self.nongroup_health_cost_cache: dict[tuple[float, float, float, float], dict] = {}
        self.validation = self._validate_inputs()

    def _validate_inputs(self) -> dict:
        micro_cash_billions = float(np.sum(self.micro_cash * self.micro_weight) / 1e9)
        cash_control = self.baseline["compensationComponents"]["cashWagesAndSalaries"]
        cash_gap = micro_cash_billions - cash_control
        allocated_health_wages = float(np.sum(self.health_wage * self.health_weight) / 1e9)
        health_pool = self.health["browserReconciliation"]["employerContributionPoolBillions"]
        health_gap = allocated_health_wages - health_pool
        covered_lives = self.total_covered_weight / 1e6
        covered_lives_control = self.health["browserReconciliation"]["weightedEsiCoveredPeopleMillions"]
        covered_lives_gap = covered_lives - covered_lives_control
        current_primary, current_secondary = split_after_premium(
            self.health_primary,
            self.health_secondary,
            self.health_employee_premium * EMPLOYEE_PREMIUM_PRETAX_SHARE,
        )
        no_exclusion_tax = current_law_tax(
            self.health_primary + self.health_employer_contribution,
            self.health_secondary,
            self.health_children,
            self.health_schedule_adults == 2,
            self.current_law,
        )
        employer_exclusion_removed_tax = current_law_tax(
            current_primary + self.health_employer_contribution,
            current_secondary,
            self.health_children,
            self.health_schedule_adults == 2,
            self.current_law,
        )
        employee_exclusion_removed_tax = current_law_tax(
            self.health_primary,
            self.health_secondary,
            self.health_children,
            self.health_schedule_adults == 2,
            self.current_law,
        )
        exclusion_value = no_exclusion_tax["total_federal"] - self.health_current["total_federal"]
        employer_exclusion_value = (
            employer_exclusion_removed_tax["total_federal"]
            - self.health_current["total_federal"]
        )
        employee_exclusion_value = (
            employee_exclusion_removed_tax["total_federal"]
            - self.health_current["total_federal"]
        )
        exclusion_value_billions = float(np.sum(exclusion_value * self.health_weight) / 1e9)
        exclusion_value_per_covered_person = float(
            np.sum(exclusion_value * self.health_weight) / self.total_covered_weight
        )
        excluded_premiums_billions = float(
            np.sum(
                (self.health_employer_contribution + self.health_employee_premium)
                * self.health_weight
            ) / 1e9
        )
        if abs(cash_gap) > 0.001:
            raise RuntimeError("National CPS cash wages do not reconcile to the BEA control")
        if abs(health_gap) > 3:
            raise RuntimeError("Allocated employer-health wages do not reconcile to the transition pool")
        if abs(covered_lives_gap) > 0.01:
            raise RuntimeError("ESI covered-person weights do not reconcile to the browser snapshot")

        test_wage = np.asarray([15750.0, 27675.0, 27676.0, 200000.0, 200001.0])
        test_result = current_law_tax(
            test_wage,
            np.zeros_like(test_wage),
            np.asarray([0.0, 0.0, 0.0, 1.0, 1.0]),
            np.zeros_like(test_wage, dtype=bool),
            self.current_law,
        )
        expected_income_tax = np.asarray([0.0, 1192.5, 1192.62, 37067.0, 37067.24])
        if not np.allclose(test_result["income_before_credits"], expected_income_tax, atol=1e-8):
            raise RuntimeError("Vector current-law bracket engine failed its boundary checks")
        return {
            "micro_cash_wages_billions": micro_cash_billions,
            "bea_cash_wage_control_billions": cash_control,
            "micro_cash_wage_gap_billions": cash_gap,
            "allocated_health_wages_billions": allocated_health_wages,
            "employer_health_pool_billions": health_pool,
            "health_wage_gap_billions": health_gap,
            "esi_covered_lives_millions": covered_lives,
            "esi_covered_lives_gap_millions": covered_lives_gap,
            "current_esi_exclusion_federal_tax_value_billions": exclusion_value_billions,
            "current_employer_esi_exclusion_federal_tax_value_billions": float(
                np.sum(employer_exclusion_value * self.health_weight) / 1e9
            ),
            "current_employee_premium_exclusion_federal_tax_value_billions": float(
                np.sum(employee_exclusion_value * self.health_weight) / 1e9
            ),
            "current_esi_exclusion_value_per_covered_person": exclusion_value_per_covered_person,
            "current_excluded_employer_and_employee_premiums_billions": excluded_premiums_billions,
            "current_exclusion_effective_federal_tax_rate": (
                exclusion_value_billions / excluded_premiums_billions
            ),
            "current_law_boundary_tests": "passed",
        }

    def _current_tax_wedge_at(self, delta: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        primary = np.maximum(0.0, self.health_primary + delta)
        total = primary + self.health_secondary
        pretax = np.minimum(total, self.health_employee_premium * EMPLOYEE_PREMIUM_PRETAX_SHARE)
        taxable_primary, taxable_secondary = split_after_premium(primary, self.health_secondary, pretax)
        tax = current_law_tax(
            taxable_primary,
            taxable_secondary,
            self.health_children,
            self.health_schedule_adults == 2,
            self.current_law,
        )
        employer_compensation = total + tax["employer_payroll"]
        return tax["total_federal"], employer_compensation, tax["employer_payroll"]

    def health_credit_cost(
        self,
        adult_credit: float,
        child_credit: float,
        benchmark_scale: float = BENCHMARK_SCALE,
    ) -> float:
        key = (adult_credit, child_credit, benchmark_scale)
        if key not in self.health_cost_cache:
            amount = np.minimum(
                self.health_benchmark_2024 * benchmark_scale,
                self.health_covered_adults * adult_credit
                + self.health_covered_children * child_credit,
            )
            self.health_cost_cache[key] = float(np.sum(amount * self.health_weight) / 1e9)
        return self.health_cost_cache[key]

    def nongroup_health_credit_cost(
        self,
        adult_credit: float,
        child_credit: float,
        benchmark_scale: float = BENCHMARK_SCALE,
        uninsured_takeup: float | None = None,
    ) -> dict[str, float]:
        takeup = self.uninsured_takeup if uninsured_takeup is None else uninsured_takeup
        key = (adult_credit, child_credit, benchmark_scale, takeup)
        if key not in self.nongroup_health_cost_cache:
            proposed = np.minimum(
                self.nongroup_benchmark_2024 * benchmark_scale,
                self.nongroup_adults * adult_credit
                + self.nongroup_children * child_credit,
            )
            current_aptc = self.nongroup_current_aptc_2024 * benchmark_scale
            no_aptc = self.nongroup_status == 1
            positive_aptc = self.nongroup_status == 2
            uninsured = self.nongroup_status == 3
            no_aptc_cost = float(np.sum(
                proposed[no_aptc]
                * self.nongroup_weight[no_aptc]
                * self.nongroup_status_scale[no_aptc]
            ) / 1e9)
            aptc_floor_cost = float(np.sum(
                np.maximum(0.0, proposed[positive_aptc] - current_aptc[positive_aptc])
                * self.nongroup_weight[positive_aptc]
                * self.nongroup_status_scale[positive_aptc]
            ) / 1e9)
            uninsured_full_cost = float(np.sum(
                proposed[uninsured] * self.nongroup_weight[uninsured]
            ) / 1e9)
            self.nongroup_health_cost_cache[key] = {
                "nongroup_no_aptc_cost_billions": no_aptc_cost,
                "nongroup_aptc_floor_topup_cost_billions": aptc_floor_cost,
                "uninsured_full_takeup_cost_billions": uninsured_full_cost,
                "uninsured_takeup": takeup,
                "uninsured_induced_enrollment_cost_billions": uninsured_full_cost * takeup,
                "nongroup_extension_cost_billions": (
                    no_aptc_cost + aptc_floor_cost + uninsured_full_cost * takeup
                ),
            }
        return self.nongroup_health_cost_cache[key]

    def fiscal_score(
        self,
        candidate: Candidate,
        benchmark_scale: float = BENCHMARK_SCALE,
    ) -> dict | None:
        middle_base, top_base = progressive_bases(
            self.micro_compensation, self.micro_schedule_adults, candidate
        )
        refundable_adult = wage_credit(
            self.micro_compensation, self.micro_credit_adults, candidate
        )
        refundable_adult_cost = float(
            np.sum(refundable_adult * self.micro_weight) * self.adult_population_scale / 1e9
        )
        child_cost = self.child_population_millions * candidate.child_credit / 1000.0
        health_cost = self.health_credit_cost(
            candidate.adult_health_credit,
            candidate.child_health_credit,
            benchmark_scale,
        )
        nongroup_health_cost = self.nongroup_health_credit_cost(
            candidate.adult_health_credit,
            candidate.child_health_credit,
            benchmark_scale,
        )
        total_health_cost = health_cost + nongroup_health_cost["nongroup_extension_cost_billions"]
        fixed_cost = refundable_adult_cost + child_cost + total_health_cost

        def score_at(rate: float) -> tuple[float, float, float, float]:
            middle_rate = effective_middle_rate(candidate, rate)
            compliant_wage_tax = (
                middle_base * middle_rate + top_base * rate
            ) * (1 - NONCOMPLIANCE_RATE)
            nonrefundable = np.minimum(
                compliant_wage_tax,
                self.micro_credit_adults * candidate.nonrefundable_adult_credit,
            )
            nonrefundable_cost = float(
                np.sum(nonrefundable * self.micro_weight) * self.adult_population_scale / 1e9
            )
            gross_revenue = (
                self.business_base * rate
                + float(np.sum(compliant_wage_tax * self.micro_weight) / 1e9)
            )
            net_revenue = gross_revenue - nonrefundable_cost - fixed_cost
            return net_revenue, nonrefundable_cost, gross_revenue, middle_rate

        low_score, _, _, _ = score_at(RATE_FLOOR)
        high_score, _, _, _ = score_at(RATE_CEILING)
        if low_score > self.target_revenue or high_score < self.target_revenue:
            return None
        low_step = int(round(RATE_FLOOR / RATE_STEP))
        high_step = int(round(RATE_CEILING / RATE_STEP))
        while low_step < high_step:
            middle_step = (low_step + high_step) // 2
            middle_score, _, _, _ = score_at(middle_step * RATE_STEP)
            if middle_score < self.target_revenue:
                low_step = middle_step + 1
            else:
                high_step = middle_step
        rate = low_step * RATE_STEP
        net_revenue, nonrefundable_cost, gross_revenue, middle_rate = score_at(rate)
        return {
            "rate": rate,
            "middle_wage_rate": middle_rate,
            "rate_step": RATE_STEP,
            "rate_adjusted_base_billions": gross_revenue / rate,
            "gross_revenue_billions": gross_revenue,
            "nonrefundable_adult_cost_billions": nonrefundable_cost,
            "refundable_wage_credit_cost_billions": refundable_adult_cost,
            "child_credit_cost_billions": child_cost,
            "health_credit_cost_billions": health_cost,
            **nongroup_health_cost,
            "total_health_credit_cost_billions": total_health_cost,
            "total_credit_cost_billions": nonrefundable_cost + fixed_cost,
            "net_revenue_billions": net_revenue,
            "target_revenue_billions": self.target_revenue,
            "fiscal_gap_billions": net_revenue - self.target_revenue,
        }

    def _reform_values(
        self,
        candidate: Candidate,
        rate: float,
        primary_delta: float = 0.0,
        benchmark_scale: float = BENCHMARK_SCALE,
        health_pass_through: float = EMPLOYER_HEALTH_PASS_THROUGH,
    ) -> tuple[np.ndarray, np.ndarray]:
        primary = np.maximum(0.0, self.health_primary + primary_delta)
        cash = primary + self.health_secondary
        fica = self.health_fica_by_delta.get(primary_delta)
        if fica is None:
            pretax = np.minimum(cash, self.health_employee_premium * EMPLOYEE_PREMIUM_PRETAX_SHARE)
            taxable_primary, taxable_secondary = split_after_premium(primary, self.health_secondary, pretax)
            current = current_law_tax(
                taxable_primary,
                taxable_secondary,
                self.health_children,
                self.health_schedule_adults == 2,
                self.current_law,
            )
            fica = current["employer_payroll"] * EMPLOYER_FICA_PASS_THROUGH
        health_wage = self.health_wage * health_pass_through
        gross_resources = cash + fica + health_wage
        wage_tax = reform_wage_tax(
            gross_resources, self.health_schedule_adults, candidate, rate
        )
        nonrefundable = np.minimum(
            wage_tax,
            self.health_credit_adults * candidate.nonrefundable_adult_credit,
        )
        refundable = wage_credit(gross_resources, self.health_credit_adults, candidate)
        child_credit = self.health_children * candidate.child_credit
        benchmark = self.health_benchmark_2024 * benchmark_scale
        health_credit = np.minimum(
            benchmark,
            self.health_covered_adults * candidate.adult_health_credit
            + self.health_covered_children * candidate.child_health_credit,
        )
        net_tax = wage_tax - nonrefundable - refundable - child_credit - health_credit
        disposable = gross_resources - wage_tax + nonrefundable + refundable + child_credit + health_credit - benchmark
        return disposable, net_tax

    def incidence_score(
        self,
        candidate: Candidate,
        rate: float,
        benchmark_scale: float = BENCHMARK_SCALE,
        health_pass_through: float = EMPLOYER_HEALTH_PASS_THROUGH,
        include_distribution: bool = False,
    ) -> dict:
        reform_disposable, _ = self._reform_values(
            candidate,
            rate,
            benchmark_scale=benchmark_scale,
            health_pass_through=health_pass_through,
        )
        change = reform_disposable - self.current_disposable
        winners = change >= -0.005
        winner_share = float(np.sum(self.covered_weight[winners]) / self.total_covered_weight)

        _, reform_down = self._reform_values(
            candidate,
            rate,
            primary_delta=-MTR_HALF_WINDOW,
            benchmark_scale=benchmark_scale,
            health_pass_through=health_pass_through,
        )
        _, reform_up = self._reform_values(
            candidate,
            rate,
            primary_delta=MTR_HALF_WINDOW,
            benchmark_scale=benchmark_scale,
            health_pass_through=health_pass_through,
        )
        reform_mtr = np.divide(
            reform_up - reform_down,
            self.mtr_denominator,
            out=np.zeros_like(self.mtr_denominator),
            where=self.mtr_denominator > 0,
        )
        mtr_change = reform_mtr - self.current_mtr
        mean_abs_mtr_change = float(
            np.sum(np.abs(mtr_change) * self.covered_weight) / self.total_covered_weight
        )
        mtr_preserved_share = float(
            np.sum(self.covered_weight[np.abs(mtr_change) <= 0.02]) / self.total_covered_weight
        )
        result = {
            "esi_winner_share": winner_share,
            "esi_mean_change_dollars": float(
                np.sum(change * self.covered_weight) / self.total_covered_weight
            ),
            "mean_absolute_mtr_change": mean_abs_mtr_change,
            "mtr_within_two_points_share": mtr_preserved_share,
            "mean_current_mtr": float(
                np.sum(self.current_mtr * self.covered_weight) / self.total_covered_weight
            ),
            "mean_reform_mtr": float(
                np.sum(reform_mtr * self.covered_weight) / self.total_covered_weight
            ),
        }
        if include_distribution:
            result.update({
                "esi_p10_change_dollars": weighted_quantile(change, self.covered_weight, 0.10),
                "esi_median_change_dollars": weighted_quantile(change, self.covered_weight, 0.50),
                "esi_p90_change_dollars": weighted_quantile(change, self.covered_weight, 0.90),
                "mtr_change_p90": weighted_quantile(mtr_change, self.covered_weight, 0.90),
                "winner_share_by_esi_cash_wage_decile": [
                    {
                        "decile": decile,
                        "winner_share": float(
                            np.sum(self.covered_weight[(self.health_decile == decile) & winners])
                            / np.sum(self.covered_weight[self.health_decile == decile])
                        ),
                        "mean_change_dollars": float(
                            np.sum(change[self.health_decile == decile] * self.covered_weight[self.health_decile == decile])
                            / np.sum(self.covered_weight[self.health_decile == decile])
                        ),
                    }
                    for decile in range(1, 11)
                ],
            })
        return result


def candidate_from_values(candidate_id: int, family: str, values: dict) -> Candidate:
    wage_credit_value = float(values["wage_credit"])
    wage_credit_mode = str(values["wage_credit_mode"]) if wage_credit_value > 0 else "none"
    wage_credit_phase_in = (
        float(values.get("wage_credit_phase_in", 0))
        if wage_credit_value > 0 and wage_credit_mode == "earned"
        else 0.0
    )
    return Candidate(
        candidate_id=candidate_id,
        family=family,
        adult_relief_architecture=str(values.get("adult_relief_architecture", "nonrefundable_credit")),
        zero_bracket=float(values.get("zero_bracket", 0)),
        middle_rate_share=float(values.get("middle_rate_share", 1)),
        top_bracket=float(values.get("top_bracket", 0)),
        nonrefundable_adult_credit=float(values["nonrefundable_adult_credit"]),
        wage_credit=wage_credit_value,
        wage_credit_mode=wage_credit_mode,
        wage_credit_phase_in=wage_credit_phase_in,
        child_credit=float(values["child_credit"]),
        adult_health_credit=float(values["adult_health_credit"]),
        child_health_credit=float(values["child_health_credit"]),
    )


def generate_candidates(count: int, seed: int) -> list[Candidate]:
    rng = np.random.default_rng(seed)
    candidates: list[Candidate] = []
    anchors = [
        {"family": "flat", "adult_relief_architecture": "nonrefundable_credit", "nonrefundable_adult_credit": 0, "wage_credit": 4800, "wage_credit_mode": "earned", "wage_credit_phase_in": 0.30, "child_credit": 4800, "adult_health_credit": 2000, "child_health_credit": 1000},
        {"family": "flat", "adult_relief_architecture": "nonrefundable_credit", "nonrefundable_adult_credit": 4000, "wage_credit": 4000, "wage_credit_mode": "earned", "wage_credit_phase_in": 0.30, "child_credit": 6000, "adult_health_credit": 2000, "child_health_credit": 1000},
        {"family": "progressive", "adult_relief_architecture": "zero_bracket", "zero_bracket": 30000, "middle_rate_share": 0.50, "top_bracket": 100000, "nonrefundable_adult_credit": 0, "wage_credit": 9000, "wage_credit_mode": "earned", "wage_credit_phase_in": 0.35, "child_credit": 6000, "adult_health_credit": 2000, "child_health_credit": 1000},
        {"family": "progressive", "adult_relief_architecture": "nonrefundable_credit", "zero_bracket": 0, "middle_rate_share": 0.60, "top_bracket": 100000, "nonrefundable_adult_credit": 4000, "wage_credit": 4000, "wage_credit_mode": "earned", "wage_credit_phase_in": 0.30, "child_credit": 6000, "adult_health_credit": 2000, "child_health_credit": 1000},
    ]
    for anchor in anchors[:count]:
        family = str(anchor.pop("family"))
        candidates.append(candidate_from_values(len(candidates) + 1, family, anchor))

    grid = {
        "nonrefundable_adult_credit": np.arange(0, 8001, 500),
        "wage_credit": np.arange(0, 9001, 500),
        "wage_credit_phase_in": np.arange(0.15, 0.501, 0.05),
        "child_credit": np.arange(2000, 10001, 500),
        "adult_health_credit": np.arange(0, 3501, 250),
        "child_health_credit": np.arange(0, 1501, 250),
        "zero_bracket": np.arange(5000, 50001, 5000),
        "middle_rate_share": np.arange(0.25, 0.851, 0.05),
        "top_bracket": np.arange(60000, 200001, 10000),
    }
    while len(candidates) < count:
        family = "flat" if len(candidates) % 2 == 0 else "progressive"
        mode = "universal" if rng.random() < 0.30 else "earned"
        architecture = (
            "nonrefundable_credit"
            if family == "flat" or rng.random() < 0.50
            else "zero_bracket"
        )
        values = {
            "adult_relief_architecture": architecture,
            "nonrefundable_adult_credit": (
                rng.choice(grid["nonrefundable_adult_credit"])
                if architecture == "nonrefundable_credit" else 0
            ),
            "wage_credit": rng.choice(grid["wage_credit"]),
            "wage_credit_mode": mode,
            "wage_credit_phase_in": rng.choice(grid["wage_credit_phase_in"]),
            "child_credit": rng.choice(grid["child_credit"]),
            "adult_health_credit": rng.choice(grid["adult_health_credit"]),
            "child_health_credit": rng.choice(grid["child_health_credit"]),
        }
        if family == "progressive":
            zero = (
                float(rng.choice(grid["zero_bracket"]))
                if architecture == "zero_bracket" else 0.0
            )
            possible_top = grid["top_bracket"][grid["top_bracket"] >= zero + 20000]
            values.update({
                "zero_bracket": zero,
                "middle_rate_share": rng.choice(grid["middle_rate_share"]),
                "top_bracket": rng.choice(possible_top),
            })
        candidates.append(candidate_from_values(len(candidates) + 1, family, values))
    return candidates


def dominates(left: dict, right: dict) -> bool:
    no_worse = (
        left["esi_winner_share"] >= right["esi_winner_share"]
        and left["mean_absolute_mtr_change"] <= right["mean_absolute_mtr_change"]
        and left["rate"] <= right["rate"]
    )
    strictly_better = (
        left["esi_winner_share"] > right["esi_winner_share"] + 1e-12
        or left["mean_absolute_mtr_change"] < right["mean_absolute_mtr_change"] - 1e-12
        or left["rate"] < right["rate"] - 1e-12
    )
    return no_worse and strictly_better


def pareto_front(rows: list[dict]) -> list[dict]:
    frontier: list[dict] = []
    for row in sorted(rows, key=lambda item: (-item["esi_winner_share"], item["mean_absolute_mtr_change"], item["rate"])):
        if any(dominates(other, row) for other in frontier):
            continue
        frontier = [other for other in frontier if not dominates(row, other)]
        frontier.append(row)
    return sorted(frontier, key=lambda item: (item["mean_absolute_mtr_change"], item["rate"]))


def add_balanced_scores(rows: list[dict]) -> None:
    for key, higher_is_better in (
        ("esi_winner_share", True),
        ("mean_absolute_mtr_change", False),
        ("rate", False),
    ):
        values = np.asarray([row[key] for row in rows])
        low, high = float(np.min(values)), float(np.max(values))
        span = high - low
        for row in rows:
            normalized = 1.0 if span <= 1e-12 else (row[key] - low) / span
            row.setdefault("balanced_score", 0.0)
            row["balanced_score"] += normalized if higher_is_better else 1 - normalized
    for row in rows:
        row["balanced_score"] /= 3


def selected_designs(rows: list[dict], frontier: list[dict]) -> dict[str, dict]:
    def best(pool: list[dict], key) -> dict:
        return max(pool, key=key)

    winner_pool = [row for row in rows if row["rate"] <= 0.50] or rows
    preserved_pool = [row for row in rows if row["esi_winner_share"] >= 0.67 and row["rate"] <= 0.50] or rows
    no_health = [
        row for row in rows
        if row["adult_health_credit"] == 0 and row["child_health_credit"] == 0
    ] or rows
    reference_split = [
        row for row in rows
        if row["adult_health_credit"] == 2000 and row["child_health_credit"] == 1000
    ] or rows
    exclusion_value_split = [
        row for row in rows
        if row["adult_health_credit"] == 3000 and row["child_health_credit"] == 1500
    ] or rows
    selections = {
        "balanced": best(frontier, lambda row: row["balanced_score"]),
        "maximum_esi_protection": best(winner_pool, lambda row: (row["esi_winner_share"], -row["mean_absolute_mtr_change"], -row["rate"])),
        "mtr_preservation_at_67pct_winners": best(preserved_pool, lambda row: (-row["mean_absolute_mtr_change"], -row["rate"], row["esi_winner_share"])),
        "flat_leader": best([row for row in rows if row["family"] == "flat"], lambda row: row["balanced_score"]),
        "progressive_leader": best([row for row in rows if row["family"] == "progressive"], lambda row: row["balanced_score"]),
        "no_health_credit_leader": best(no_health, lambda row: row["balanced_score"]),
        "reference_split_health_credit_leader": best(reference_split, lambda row: row["balanced_score"]),
        "exclusion_value_split_health_credit_leader": best(exclusion_value_split, lambda row: row["balanced_score"]),
    }
    return selections


def candidate_from_row(row: dict) -> Candidate:
    return Candidate(
        candidate_id=int(row["candidate_id"]),
        family=str(row["family"]),
        adult_relief_architecture=str(row["adult_relief_architecture"]),
        zero_bracket=float(row["zero_bracket"]),
        middle_rate_share=float(row["middle_rate_share"]),
        top_bracket=float(row["top_bracket"]),
        nonrefundable_adult_credit=float(row["nonrefundable_adult_credit"]),
        wage_credit=float(row["wage_credit"]),
        wage_credit_mode=str(row["wage_credit_mode"]),
        wage_credit_phase_in=float(row["wage_credit_phase_in"]),
        child_credit=float(row["child_credit"]),
        adult_health_credit=float(row["adult_health_credit"]),
        child_health_credit=float(row["child_health_credit"]),
    )


def schedule_diagnostics(candidate: Candidate, rate: float) -> dict:
    middle_rate = effective_middle_rate(candidate, rate)
    if candidate.wage_credit_mode == "earned" and candidate.wage_credit > 0:
        full_phase_in_income = candidate.wage_credit / candidate.wage_credit_phase_in
        phase_in_rate = candidate.wage_credit_phase_in
        net_mtr_in_zero_bracket = -phase_in_rate if candidate.zero_bracket > 0 else None
        first_positive_net_mtr = middle_rate - phase_in_rate
        rate_equivalent = abs(first_positive_net_mtr) <= 0.005
        replicates_zero_rate_range = (
            rate_equivalent
            and candidate.zero_bracket <= 0
            and candidate.nonrefundable_adult_credit <= 0
        )
    else:
        full_phase_in_income = None
        phase_in_rate = None
        net_mtr_in_zero_bracket = None
        first_positive_net_mtr = None
        rate_equivalent = False
        replicates_zero_rate_range = False

    if candidate.nonrefundable_adult_credit <= 0:
        nonref_zero_threshold = candidate.zero_bracket if candidate.family == "progressive" else 0.0
    else:
        low, high = 0.0, 2_000_000.0
        one_adult = np.asarray([1.0])
        for _ in range(48):
            middle = (low + high) / 2
            liability = float(reform_wage_tax(
                np.asarray([middle]), one_adult, candidate, rate
            )[0])
            if liability < candidate.nonrefundable_adult_credit:
                low = middle
            else:
                high = middle
        nonref_zero_threshold = (low + high) / 2
    return {
        "middle_wage_rate": middle_rate,
        "refundable_wage_credit_phase_in_rate": phase_in_rate,
        "refundable_wage_credit_full_phase_in_income_per_adult": full_phase_in_income,
        "net_mtr_in_statutory_zero_bracket_during_phase_in": net_mtr_in_zero_bracket,
        "net_mtr_at_first_positive_wage_rate_during_phase_in": first_positive_net_mtr,
        "phase_in_approximately_equals_first_positive_tax_rate": rate_equivalent,
        "phase_in_replicates_initial_zero_rate_range": replicates_zero_rate_range,
        "nonrefundable_effective_zero_tax_threshold_per_adult": nonref_zero_threshold,
    }


def enrich(model: SearchModel, row: dict) -> dict:
    candidate = candidate_from_row(row)
    return {
        **row,
        **model.incidence_score(candidate, row["rate"], include_distribution=True),
        **schedule_diagnostics(candidate, row["rate"]),
        "covered_child_refundable_credit": candidate.child_credit + candidate.child_health_credit,
    }


def write_csv(path: Path, rows: list[dict]) -> None:
    fields = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_summary(path: Path, result: dict) -> None:
    display_names = {
        "balanced": "Balanced",
        "maximum_esi_protection": "Maximum ESI protection",
        "mtr_preservation_at_67pct_winners": "MTR preservation (at least 67% winners)",
        "flat_leader": "Flat leader",
        "progressive_leader": "Progressive leader",
        "no_health_credit_leader": "No-health-credit leader",
        "reference_split_health_credit_leader": "$2,000 adult / $1,000 child health-credit leader",
        "exclusion_value_split_health_credit_leader": "$3,000 adult / $1,500 child health-credit leader",
    }

    def money(value: float) -> str:
        sign = "-" if value < 0 else ""
        return f"{sign}${abs(value):,.0f}"

    lines = [
        f"# Expanded 2025 X-tax and health-credit Pareto search — {result['fiscal_identity']['target_label']}",
        "",
        f"The seeded search scored {result['candidate_draws']:,} designs; "
        f"{result['feasible_candidates']:,} balanced within the 10%-60% headline-rate range, "
        f"and {result['pareto_candidates']:,} were nondominated.",
        f"The net-revenue target is ${result['fiscal_identity']['target_revenue_billions']:,.1f}B, including "
        f"${result['fiscal_identity']['additional_revenue_billions']:,.1f}B "
        f"({result['fiscal_identity']['additional_revenue_percent_gdp']:.1%} of GDP) above tax-replacement neutrality.",
        f"Headline/business/top rates are restricted to {result['fiscal_identity']['headline_rate_step']:.1%} steps and rounded up to the first target-meeting rate; statutory middle wage rates are rounded to the nearest step. "
        f"The resulting candidate surpluses range from ${result['validation']['minimum_fiscal_surplus_billions']:,.1f}B to "
        f"${result['validation']['maximum_fiscal_surplus_billions']:,.1f}B.",
        f"The modeled current ESI exclusions are worth ${result['validation']['current_esi_exclusion_federal_tax_value_billions']:,.1f}B "
        f"in combined federal income and payroll taxes, or about "
        f"${result['validation']['current_esi_exclusion_value_per_covered_person']:,.0f} per ESI-covered person. "
        "The health amounts below are true refundable credits, not income exclusions, and are deliberately searched near that tax-value scale.",
        "",
        "| Selection | Schedule | Headline | Middle | Fiscal surplus | Adult nonref. | Adult refundable schedule | Child | Adult health | Child health | ESI winners | Mean absolute MTR change (pp) | Stress winners |",
        "|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|",
    ]
    for name, pair in result["selected"].items():
        row = pair["default"]
        stress = pair["stress"]
        middle = row["middle_wage_rate"]
        schedule = row["family"]
        if row["family"] == "progressive":
            lower_description = (
                f"${row['zero_bracket']:,.0f} zero"
                if row["zero_bracket"] > 0
                else "no statutory zero"
            )
            schedule += f" ({lower_description}; ${row['top_bracket']:,.0f} top per adult)"
        if row["wage_credit"] <= 0:
            refundable_schedule = "none"
        elif row["wage_credit_mode"] == "universal":
            refundable_schedule = f"${row['wage_credit']:,.0f} universal"
        else:
            refundable_schedule = (
                f"${row['wage_credit']:,.0f} earned @ {row['wage_credit_phase_in']:.0%}; "
                f"full at ${row['refundable_wage_credit_full_phase_in_income_per_adult']:,.0f}"
            )
        lines.append(
            f"| {display_names[name]} | {schedule} | {row['rate']:.1%} | {middle:.1%} | ${row['fiscal_gap_billions']:,.1f}B | "
            f"${row['nonrefundable_adult_credit']:,.0f} | {refundable_schedule} | "
            f"${row['child_credit']:,.0f} | ${row['adult_health_credit']:,.0f} | "
            f"${row['child_health_credit']:,.0f} | {row['esi_winner_share']:.1%} | "
            f"{row['mean_absolute_mtr_change'] * 100:.1f} | {stress.get('esi_winner_share', 0):.1%} |"
        )
    balanced = result["selected"]["balanced"]["default"]
    if balanced["family"] == "progressive":
        zero_description = (
            f"a ${balanced['zero_bracket']:,.0f} zero bracket per schedule adult"
            if balanced["zero_bracket"] > 0
            else "no statutory zero bracket"
        )
        schedule_sentence = (
            f"{zero_description}, a {balanced['middle_wage_rate']:.1%} middle rate through "
            f"${balanced['top_bracket']:,.0f} per schedule adult, and the headline rate above that threshold"
        )
    else:
        schedule_sentence = "the same flat rate on the wage side"
    refundable_description = (
        f"a ${balanced['wage_credit']:,.0f} {balanced['wage_credit_mode']} refundable adult wage credit"
        if balanced["wage_credit"] > 0
        else "no refundable adult wage credit"
    )
    lines.extend([
        "",
        "## Reading the balanced design",
        "",
        f"The equal-weight compromise is candidate {balanced['candidate_id']}: a {balanced['rate']:.1%} headline/business rate, "
        f"{schedule_sentence}. "
        f"It combines a ${balanced['nonrefundable_adult_credit']:,.0f} adult nonrefundable credit, "
        f"{refundable_description}, "
        f"a ${balanced['child_credit']:,.0f} refundable child credit, and a "
        f"${balanced['adult_health_credit']:,.0f} adult / ${balanced['child_health_credit']:,.0f} child refundable health credit.",
        f"The discrete rate raises ${balanced['fiscal_gap_billions']:,.1f}B above the modeled target.",
        "",
        f"Its health-credit score is ${balanced['total_health_credit_cost_billions']:,.1f}B: "
        f"${balanced['health_credit_cost_billions']:,.1f}B for the ESI transition plus "
        f"${balanced['nongroup_no_aptc_cost_billions']:,.1f}B for nongroup enrollees without APTC, "
        f"${balanced['nongroup_aptc_floor_topup_cost_billions']:,.1f}B of APTC floor top-ups, and "
        f"${balanced['uninsured_induced_enrollment_cost_billions']:,.1f}B for induced enrollment "
        f"at {balanced['uninsured_takeup']:.0%} take-up.",
        "",
        f"Its adult-relief architecture is {balanced['adult_relief_architecture'].replace('_', ' ')}. "
        + (
            f"The nonrefundable credit makes the effective zero-net-wage-tax threshold "
            f"${balanced['nonrefundable_effective_zero_tax_threshold_per_adult']:,.0f} per adult. "
            if balanced['nonrefundable_adult_credit'] > 0
            else (
                f"The statutory zero bracket is ${balanced['zero_bracket']:,.0f} per schedule adult. "
                if balanced['zero_bracket'] > 0
                else "There is no nonrefundable adult credit or statutory zero bracket. "
            )
        )
        + (
            f"The refundable wage credit phases in at {balanced['wage_credit_phase_in']:.1%} and reaches its maximum "
            f"at ${balanced['refundable_wage_credit_full_phase_in_income_per_adult']:,.0f} per adult; its net MTR is "
            + (
                f"{balanced['net_mtr_in_statutory_zero_bracket_during_phase_in']:.1%} inside the statutory zero bracket and "
                if balanced['net_mtr_in_statutory_zero_bracket_during_phase_in'] is not None
                else ""
            )
            + f"{balanced['net_mtr_at_first_positive_wage_rate_during_phase_in']:.1%} when the first positive wage rate applies."
            if balanced['wage_credit_mode'] == 'earned' and balanced['wage_credit'] > 0
            else "The refundable wage credit has no earnings phase-in."
        ),
        "",
        f"At the default assumptions, {balanced['esi_winner_share']:.1%} of ESI-covered people are in non-losing tax units; "
        f"the covered-person median annual resource change is {money(balanced['esi_median_change_dollars'])}, "
        f"the 10th percentile is {money(balanced['esi_p10_change_dollars'])}, and the mean absolute MTR change is "
        f"{balanced['mean_absolute_mtr_change'] * 100:.1f} percentage points "
        f"({balanced['mtr_within_two_points_share']:.1%} remain within two points).",
        "",
        "The stress case uses 75% employer-health wage pass-through and raises the benchmark factor from 1.03 to 1.15. "
        "See the JSON for decile results, exact fiscal identities, scope limits, and the full frontier.",
        "",
    ])
    path.write_text("\n".join(lines), encoding="utf-8")


def run(
    count: int,
    seed: int,
    output_dir: Path,
    fiscal_target_mode: str = "replacement",
    uninsured_takeup: float = 0.15,
) -> dict:
    model = SearchModel(fiscal_target_mode, uninsured_takeup)
    candidates = generate_candidates(count, seed)
    rows: list[dict] = []
    for index, candidate in enumerate(candidates, start=1):
        fiscal = model.fiscal_score(candidate)
        if fiscal is None:
            continue
        incidence = model.incidence_score(candidate, fiscal["rate"])
        rows.append({
            **candidate.__dict__,
            **fiscal,
            **incidence,
            **schedule_diagnostics(candidate, fiscal["rate"]),
        })
        if index % 500 == 0:
            print(f"Scored {index:,}/{len(candidates):,} candidates ({len(rows):,} fiscally feasible)", flush=True)
    if not rows:
        raise RuntimeError("No candidate balanced within the permitted rate range")
    minimum_fiscal_gap = min(row["fiscal_gap_billions"] for row in rows)
    maximum_fiscal_gap = max(row["fiscal_gap_billions"] for row in rows)
    if minimum_fiscal_gap < -0.000001:
        raise RuntimeError(f"A candidate missed the fiscal floor by ${-minimum_fiscal_gap:,.6f}B")
    if any(
        abs(row[key] / RATE_STEP - round(row[key] / RATE_STEP)) > 1e-9
        for row in rows
        for key in ("rate", "middle_wage_rate")
    ):
        raise RuntimeError("A statutory headline or middle wage rate fell off the 0.5-point grid")
    if any(not 0 <= row["esi_winner_share"] <= 1 for row in rows):
        raise RuntimeError("An ESI winner share fell outside zero to one")

    add_balanced_scores(rows)
    frontier = pareto_front(rows)
    selections = selected_designs(rows, frontier)
    enriched_frontier = [enrich(model, row) for row in frontier]
    enriched_selections: dict[str, dict] = {}
    for label, row in selections.items():
        candidate = candidate_from_row(row)
        default = enrich(model, row)
        stress_fiscal = model.fiscal_score(candidate, benchmark_scale=1.15)
        if stress_fiscal is None:
            stress = {"feasible": False}
        else:
            stress = {
                "feasible": True,
                **stress_fiscal,
                **model.incidence_score(
                    candidate,
                    stress_fiscal["rate"],
                    benchmark_scale=1.15,
                    health_pass_through=0.75,
                    include_distribution=True,
                ),
            }
        enriched_selections[label] = {"default": default, "stress": stress}

    result = {
        "schema_version": 2,
        "experiment": "expanded-x-tax-split-health-credit-debt-target-pareto-search",
        "seed": seed,
        "candidate_draws": len(candidates),
        "feasible_candidates": len(rows),
        "pareto_candidates": len(frontier),
        "validation": {
            **model.validation,
            "minimum_fiscal_surplus_billions": minimum_fiscal_gap,
            "maximum_fiscal_surplus_billions": maximum_fiscal_gap,
        },
        "objective_definition": {
            "maximize": ["esi_winner_share"],
            "minimize": ["mean_absolute_mtr_change", "rate"],
            "balanced_score": "Equal-weight min-max score across the three Pareto objectives over all feasible candidates.",
            "winner_unit": "ESI-covered people are assigned their tax unit's annual resource change.",
            "mtr": "Centered $1,000 change in net federal tax or subsidy divided by the change in pre-reform employer compensation; covered-person weighted.",
        },
        "fiscal_identity": {
            "target_mode": fiscal_target_mode,
            "target_label": model.fiscal_target["label"],
            "replacement_target_billions": model.replacement_target_revenue,
            "additional_revenue_percent_gdp": model.additional_revenue_percent_gdp,
            "additional_revenue_billions": model.additional_revenue_billions,
            "target_revenue_billions": model.target_revenue,
            "rate_rule": "Choose the lowest 0.5-percentage-point flat business/headline rate that meets the target; progressive statutory middle rates are the candidate share times headline rounded to the nearest 0.5 percentage point.",
            "headline_rate_step": RATE_STEP,
            "noncompliance_rate": NONCOMPLIANCE_RATE,
        },
        "health_transition": {
            "benchmark_premium_scale": BENCHMARK_SCALE,
            "employer_fica_pass_through": EMPLOYER_FICA_PASS_THROUGH,
            "employer_health_pass_through": EMPLOYER_HEALTH_PASS_THROUGH,
            "employee_premium_pretax_share": EMPLOYEE_PREMIUM_PRETAX_SHARE,
            "redistribution": "National equal dollars among in-unit ESI policyholder workers; household members share the resulting resources.",
            "health_credit": "Separate refundable adult and child amounts, summed within the tax unit and capped at its age-specific aggregate benchmark premium.",
            "health_credit_interpretation": "A true refundable premium-purchase credit, not an income exclusion. The policy search range is calibrated around the estimated federal tax value of current ESI exclusions rather than the full premium.",
            "nongroup_extension": "The same credit is available as a floor to unsubsidized nongroup enrollees and current APTC recipients below the floor; induced uninsured enrollees receive the credit at the stated take-up rate.",
            "uninsured_takeup": model.uninsured_takeup,
            "stress_test": "Benchmark scale 1.15 and employer-health wage pass-through 75%; rate re-solved for the larger capped health-credit cost.",
        },
        "search_ranges": {
            "families": ["flat", "progressive"],
            "adult_relief_architectures": ["nonrefundable_credit", "zero_bracket"],
            "architecture_rule": "Flat designs use the equivalent nonrefundable-credit representation. Progressive designs may use a zero bracket or a nonrefundable adult credit, never both.",
            "nonrefundable_adult_credit": "$0-$8,000 in $500 increments",
            "refundable_wage_credit": "$0-$9,000 in $500 increments; universal or earned with 15%-50% phase-in and no phaseout",
            "refundable_child_credit": "$2,000-$10,000 in $500 increments",
            "refundable_adult_health_credit": "$0-$3,500 in $250 increments; deliberately bounded near the current ESI exclusion's estimated tax value rather than the full premium",
            "refundable_child_health_credit": "$0-$1,500 in $250 increments; deliberately below the adult range",
            "progressive_zero_bracket_per_schedule_adult": "$5,000-$50,000 in $5,000 increments when that architecture is selected; no zero bracket in the nonrefundable-credit architecture",
            "progressive_middle_rate_share": "Target share of 25%-85% of the headline rate in 5-point increments; the actual statutory middle rate is rounded to the nearest 0.5 percentage point",
            "progressive_top_threshold_per_schedule_adult": "$60,000-$200,000 in $10,000 increments",
            "business_and_top_wage_rate": "10%-60% in 0.5-percentage-point increments; the lowest target-meeting step is selected",
        },
        "scope_limits": [
            "National CPS cells identify wage, schedule-adult, and credit-adult counts but not children; they therefore determine revenue, not national winner shares.",
            "Distributional objectives are measured in the nonelderly ESI-linked CPS/HIPM sample, the population directly affected by ending employer ESI.",
            "Static annual incidence: no labor-supply, employer-plan, premium-equilibrium, take-up, or insurer-risk-pool response.",
            "The long-run debt target applies Treasury's 4.7%-of-GDP 75-year fiscal-gap estimate as a static annual revenue increment; it is not a dynamic debt-service simulation.",
            "The 1.6%-of-GDP near-term target equals the rounded one-year increase in CBO's February 2026 debt-to-GDP projection, from 99.0% at the end of 2025 to 100.6% at the end of 2026. It is a static one-year anchor, not a multiyear debt-service simulation.",
            "Nongroup enrollment is reconciled to CBO's average-month 2025 counts. HIPM supplies family composition and the APTC top-up distribution; its APTC estimates are not administrative payment records.",
        ],
        "selected": enriched_selections,
        "frontier": enriched_frontier,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    stem = f"pareto_search_{fiscal_target_mode}_2025"
    csv_path = output_dir / f"{stem}.csv"
    json_path = output_dir / f"{stem}.json"
    summary_path = output_dir / f"{stem}.md"
    write_csv(csv_path, rows)
    json_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    write_summary(summary_path, result)
    print(f"Feasible candidates: {len(rows):,}")
    print(f"Pareto frontier: {len(frontier):,}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {json_path}")
    print(f"Wrote {summary_path}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=20250819)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--target-mode", choices=sorted(FISCAL_TARGETS), default="near_term_debt")
    parser.add_argument("--uninsured-takeup", type=float, default=0.15)
    args = parser.parse_args()
    if args.candidates <= 0:
        parser.error("--candidates must be positive")
    if not 0 <= args.uninsured_takeup <= 1:
        parser.error("--uninsured-takeup must be between zero and one")
    run(args.candidates, args.seed, args.output_dir, args.target_mode, args.uninsured_takeup)


if __name__ == "__main__":
    main()
