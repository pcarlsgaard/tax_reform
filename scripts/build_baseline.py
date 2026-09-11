#!/usr/bin/env python3
"""Rebuild or verify the versioned NIPA/FRED baseline.

Live fetching is a data-build step only. The browser imports the generated JSON and
never calls FRED during interaction. Network errors fail closed instead of silently
turning missing series into zeros, as the historical script did.
"""

from __future__ import annotations

import argparse
import csv
import json
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERIES_PATH = ROOT / "data" / "fred_series.json"
DEFAULT_OUTPUT = ROOT / "src" / "data" / "baseline_2025.json"
HEALTH_OUTPUT = ROOT / "src" / "data" / "health_esi_2025.json"


def annual_average(series_id: str, year: int) -> float:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    request = urllib.request.Request(url, headers={"User-Agent": "tax-reform-simulator/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        rows = csv.DictReader(response.read().decode("utf-8").splitlines())
        date_field = "observation_date" if "observation_date" in (rows.fieldnames or []) else "DATE"
        values = [
            float(row[series_id])
            for row in rows
            if row[date_field].startswith(str(year)) and row[series_id] != "."
        ]
    if not values:
        raise RuntimeError(f"FRED returned no {year} observations for {series_id}")
    return sum(values) / len(values)


def build(year: int, prior: dict, allow_provisional_housing: bool = False) -> dict:
    series = json.loads(SERIES_PATH.read_text(encoding="utf-8"))
    values = {}
    estimates = {}
    for key, item in series.items():
        try:
            values[key] = annual_average(item["id"], year)
        except RuntimeError:
            if key != "housingValueAdded" or not allow_provisional_housing:
                raise
            prior_housing = annual_average(item["id"], year - 1)
            prior_gdp = annual_average(series["gdp"]["id"], year - 1)
            current_gdp = values.get("gdp") or annual_average(series["gdp"]["id"], year)
            values[key] = prior_housing * current_gdp / prior_gdp
            estimates[key] = {
                "method": "prior-year value scaled by nominal GDP growth",
                "sourceYear": year - 1,
                "sourceValue": round(prior_housing, 3),
                "formula": f"{prior_housing:.3f} × ({current_gdp:.3f} / {prior_gdp:.3f})",
            }
    net_capital = (
        values["corporateProfits"] + values["proprietorsIncome"] + values["netInterest"]
        + values["capitalConsumption"] + values["productionTaxes"] - values["investment"]
    )
    health_snapshot = json.loads(HEALTH_OUTPUT.read_text(encoding="utf-8"))
    employer_health = health_snapshot["calibration"]["projectedBeaGroupHealth2025Billions"]
    pension_other = values["employerPensionAndInsurance"] - employer_health
    if pension_other < 0:
        raise RuntimeError("Projected employer health exceeds the BEA pension-and-insurance control")
    return {
        **prior,
        "dataYear": year,
        "snapshot": "fred-build-2026-08-10-provisional" if estimates else "fred-build-2026-08-10",
        "provisional": bool(estimates),
        "estimates": estimates,
        "gdp": round(values["gdp"], 3),
        "components": {
            "compensation": round(values["compensation"], 3),
            "netCapitalIncomeAfterInvestment": round(net_capital, 3),
            "netImports": round(values["imports"] - values["exports"], 3),
            "housingAdjustment": round(values["householdInvestment"] - values["housingValueAdded"], 3),
        },
        "compensationComponents": {
            "cashWagesAndSalaries": round(values["wagesAndSalaries"], 3),
            "employerGovernmentSocialInsurance": round(values["employerGovernmentSocialInsurance"], 3),
            "employerPensionAndInsurance": round(values["employerPensionAndInsurance"], 3),
            "employerHealthInsurance": round(employer_health, 3),
            "employerPensionAndOtherInsurance": round(pension_other, 3),
        },
    }


def verify(snapshot: dict) -> None:
    components = snapshot["components"]
    theoretical = sum(components.values())
    if theoretical <= 0 or snapshot["gdp"] <= 0:
        raise RuntimeError("Baseline contains a nonpositive GDP or theoretical base")
    default_base = theoretical * (1 - snapshot["defaultNoncomplianceRate"]) * (1 - snapshot["defaultExemptionShare"])
    compensation_components = snapshot["compensationComponents"]
    split_supplements = (
        compensation_components["employerHealthInsurance"]
        + compensation_components["employerPensionAndOtherInsurance"]
    )
    if abs(split_supplements - compensation_components["employerPensionAndInsurance"]) > 0.01:
        raise RuntimeError("Employer health plus pension/other does not reconcile to the BEA supplement control")
    compensation_sum = (
        compensation_components["cashWagesAndSalaries"]
        + compensation_components["employerGovernmentSocialInsurance"]
        + split_supplements
    )
    if abs(compensation_sum - components["compensation"]) > 0.01:
        raise RuntimeError(
            f"Compensation detail does not reconcile: {compensation_sum:.3f} versus {components['compensation']:.3f}"
        )
    print(f"GDP: ${snapshot['gdp']:,.1f}B")
    print(f"Theoretical base: ${theoretical:,.1f}B")
    print(f"Compensation detail: ${compensation_sum:,.1f}B")
    print(f"Default taxable base: ${default_base:,.1f}B ({default_base / snapshot['gdp']:.1%} of GDP)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument(
        "--allow-provisional-housing",
        action="store_true",
        help="Estimate a missing annual housing value-added observation from its prior-year GDP share.",
    )
    args = parser.parse_args()
    prior = json.loads(args.output.read_text(encoding="utf-8"))
    snapshot = prior if args.verify_only else build(args.year, prior, args.allow_provisional_housing)
    verify(snapshot)
    if not args.verify_only:
        args.output.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
