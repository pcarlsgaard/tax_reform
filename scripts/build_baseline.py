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
DEFAULT_OUTPUT = ROOT / "src" / "data" / "baseline_2024.json"


def annual_average(series_id: str, year: int) -> float:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    request = urllib.request.Request(url, headers={"User-Agent": "tax-reform-simulator/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        rows = csv.DictReader(response.read().decode("utf-8").splitlines())
    values = [float(row[series_id]) for row in rows if row["DATE"].startswith(str(year)) and row[series_id] != "."]
    if not values:
        raise RuntimeError(f"FRED returned no {year} observations for {series_id}")
    return sum(values) / len(values)


def build(year: int, prior: dict) -> dict:
    series = json.loads(SERIES_PATH.read_text(encoding="utf-8"))
    values = {key: annual_average(item["id"], year) for key, item in series.items()}
    net_capital = (
        values["corporateProfits"] + values["proprietorsIncome"] + values["netInterest"]
        + values["capitalConsumption"] + values["productionTaxes"] - values["investment"]
    )
    return {
        **prior,
        "dataYear": year,
        "snapshot": "live-fred-build",
        "gdp": round(values["gdp"], 3),
        "components": {
            "compensation": round(values["compensation"], 3),
            "netCapitalIncomeAfterInvestment": round(net_capital, 3),
            "netImports": round(values["imports"] - values["exports"], 3),
            "housingAdjustment": round(values["householdInvestment"] - values["housingValueAdded"], 3),
        },
    }


def verify(snapshot: dict) -> None:
    components = snapshot["components"]
    theoretical = sum(components.values())
    if theoretical <= 0 or snapshot["gdp"] <= 0:
        raise RuntimeError("Baseline contains a nonpositive GDP or theoretical base")
    default_base = theoretical * (1 - snapshot["defaultNoncomplianceRate"]) * (1 - snapshot["defaultExemptionShare"])
    print(f"GDP: ${snapshot['gdp']:,.1f}B")
    print(f"Theoretical base: ${theoretical:,.1f}B")
    print(f"Default taxable base: ${default_base:,.1f}B ({default_base / snapshot['gdp']:.1%} of GDP)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    prior = json.loads(args.output.read_text(encoding="utf-8"))
    snapshot = prior if args.verify_only else build(args.year, prior)
    verify(snapshot)
    if not args.verify_only:
        args.output.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
