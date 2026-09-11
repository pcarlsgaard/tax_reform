#!/usr/bin/env python3
"""Build anonymous nongroup and uninsured health-credit scoring cells.

The Census Health Inclusive Poverty Measure (HIPM) supplies family-level
benchmark premiums and estimated advance premium tax credits.  CPS ASEC
supplies age, tax-unit identifiers, and survey weights.  HIPM's APTC amount is
repeated for each member of a health-insurance unit, so this builder counts it
once per HIPM unit and then sums it to the CPS tax unit.

Survey reports understate Marketplace subsidy receipt.  The output therefore
contains explicit weight factors that reconcile the direct-purchase groups to
CBO's February 2026 estimates of average monthly 2025 enrollment.  Uninsured
cells retain their linked CPS/HIPM weights because the resulting 25.7 million
nonelderly people are close to CBO's 26.6 million uninsured people of all ages.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import statistics
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "src" / "data" / "health_nongroup_2025.json"

ASEC_URL = "https://www2.census.gov/programs-surveys/cps/datasets/2025/march/asecpub25csv.zip"
ASEC_SHA256 = "318845a2b5e0034eb2973898de1738f4df0025727de38499e7669cb9c0deef0b"
ASEC_PERSON_MEMBER = "pppub25.csv"
HIPM_URL = "https://www2.census.gov/library/working-papers/2025/demo/hipm-2024.csv"
HIPM_SHA256 = "2aa0d58ae7c48a04e359c0f97995f6160ed63d5666ed91097ff27209061f922f"

CBO_REPORT_URL = "https://www.cbo.gov/publication/62539"
CBO_SUBSIDIZED_MARKETPLACE_2025_MILLIONS = 20.9
CBO_UNSUBSIDIZED_MARKETPLACE_2025_MILLIONS = 1.6
CBO_OUTSIDE_MARKETPLACE_2025_MILLIONS = 3.0
CBO_UNINSURED_2025_MILLIONS = 26.6

STATUS_DIRECT_NO_APTC = 1
STATUS_DIRECT_POSITIVE_APTC = 2
STATUS_UNINSURED = 3
MONEY_BIN = 50


def as_int(value: str) -> int:
    return 0 if value == "" else int(float(value))


def as_float(value: str) -> float:
    return 0.0 if value == "" else float(value)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, path: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "tax-reform-simulator/2.0"})
    with urllib.request.urlopen(request, timeout=180) as response, path.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def rounded_money(value: float) -> int:
    return int(round(value / MONEY_BIN) * MONEY_BIN)


def read_asec(path: Path) -> tuple[dict[tuple[int, int], tuple[int, int]], dict[int, float], int]:
    people: dict[tuple[int, int], tuple[int, int]] = {}
    reference: dict[int, tuple[tuple[int, int], float]] = {}
    with zipfile.ZipFile(path) as archive, archive.open(ASEC_PERSON_MEMBER) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
        header = next(reader)
        required = ["PH_SEQ", "PPPOS", "TAX_ID", "A_AGE", "MARSUPWT", "DEP_STAT", "A_LINENO"]
        index = {name: header.index(name) for name in required}
        for row in reader:
            value = lambda name: as_int(row[index[name]])
            tax_id = value("TAX_ID")
            key = (value("PH_SEQ"), value("PPPOS"))
            age = value("A_AGE")
            weight = value("MARSUPWT") / 100
            rank = (1 if value("DEP_STAT") > 0 else 0, value("A_LINENO"))
            people[key] = (tax_id, age)
            if tax_id not in reference or rank < reference[tax_id][0]:
                reference[tax_id] = (rank, weight)
    return people, {tax_id: item[1] for tax_id, item in reference.items()}, len(reference)


def read_hipm(path: Path, people: dict[tuple[int, int], tuple[int, int]]) -> tuple[list[dict], dict[int, float]]:
    rows: list[dict] = []
    positive_needs: dict[int, list[float]] = defaultdict(list)
    with path.open(newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            person = people.get((as_int(row["h_seq"]), as_int(row["pppos"])))
            if person is None:
                continue
            tax_id, age = person
            need = as_float(row["ind_need"])
            if age < 65 and need > 0:
                positive_needs[age].append(need)
            rows.append({
                "taxId": tax_id,
                "age": age,
                "hitype": as_int(row["hitype"]),
                "hipmId": as_int(row["hipm_id"]),
                "benchmark": need,
                "aptc": as_float(row["aptc2"]),
            })
    medians = {age: statistics.median(values) for age, values in positive_needs.items()}
    return rows, medians


def build_units(rows: list[dict], weights: dict[int, float], medians: dict[int, float]) -> list[dict]:
    units: dict[int, dict] = {}
    for person in rows:
        if person["age"] >= 65 or person["hitype"] not in (7, 12, 14):
            continue
        unit = units.setdefault(person["taxId"], {
            "weight": weights[person["taxId"]],
            "directAdults": 0,
            "directChildren": 0,
            "directBenchmark": 0.0,
            "aptcByHipmId": {},
            "uninsuredAdults": 0,
            "uninsuredChildren": 0,
            "uninsuredBenchmark": 0.0,
        })
        benchmark = person["benchmark"] or medians.get(person["age"], 0.0)
        if person["hitype"] in (7, 12):
            unit["directAdults"] += int(person["age"] >= 18)
            unit["directChildren"] += int(person["age"] < 18)
            unit["directBenchmark"] += benchmark
            if person["hipmId"]:
                unit["aptcByHipmId"][person["hipmId"]] = max(
                    unit["aptcByHipmId"].get(person["hipmId"], 0.0), person["aptc"]
                )
        else:
            unit["uninsuredAdults"] += int(person["age"] >= 18)
            unit["uninsuredChildren"] += int(person["age"] < 18)
            unit["uninsuredBenchmark"] += benchmark

    result: list[dict] = []
    for unit in units.values():
        direct_people = unit["directAdults"] + unit["directChildren"]
        if direct_people:
            current_aptc = sum(unit["aptcByHipmId"].values())
            result.append({
                "status": STATUS_DIRECT_POSITIVE_APTC if current_aptc > 0 else STATUS_DIRECT_NO_APTC,
                "adults": unit["directAdults"],
                "children": unit["directChildren"],
                "benchmark": unit["directBenchmark"],
                "currentAptc": current_aptc,
                "weight": unit["weight"],
            })
        uninsured_people = unit["uninsuredAdults"] + unit["uninsuredChildren"]
        if uninsured_people:
            result.append({
                "status": STATUS_UNINSURED,
                "adults": unit["uninsuredAdults"],
                "children": unit["uninsuredChildren"],
                "benchmark": unit["uninsuredBenchmark"],
                "currentAptc": 0.0,
                "weight": unit["weight"],
            })
    return result


def analytical_cells(units: list[dict]) -> list[list[float]]:
    cells: dict[tuple[int, ...], float] = defaultdict(float)
    for unit in units:
        key = (
            unit["status"],
            unit["adults"],
            unit["children"],
            rounded_money(unit["benchmark"]),
            rounded_money(unit["currentAptc"]),
        )
        cells[key] += unit["weight"]
    return [[*key, weight] for key, weight in sorted(cells.items())]


def weighted_people(units: list[dict], status: int) -> float:
    return sum(
        unit["weight"] * (unit["adults"] + unit["children"])
        for unit in units if unit["status"] == status
    )


def build(asec_path: Path, hipm_path: Path, output: Path) -> dict:
    if sha256(asec_path) != ASEC_SHA256:
        raise RuntimeError("ASEC archive hash does not match the pinned source")
    if sha256(hipm_path) != HIPM_SHA256:
        raise RuntimeError("HIPM file hash does not match the pinned source")
    people, weights, tax_units = read_asec(asec_path)
    hipm_rows, medians = read_hipm(hipm_path, people)
    units = build_units(hipm_rows, weights, medians)

    no_aptc_people = weighted_people(units, STATUS_DIRECT_NO_APTC)
    positive_aptc_people = weighted_people(units, STATUS_DIRECT_POSITIVE_APTC)
    uninsured_people = weighted_people(units, STATUS_UNINSURED)
    cbo_no_aptc_people = (
        CBO_UNSUBSIDIZED_MARKETPLACE_2025_MILLIONS
        + CBO_OUTSIDE_MARKETPLACE_2025_MILLIONS
    ) * 1e6
    snapshot = {
        "schemaVersion": 1,
        "snapshot": "cps-asec-2025-hipm-2024-cbo-february-2026-v1",
        "source": {
            "asecUrl": ASEC_URL,
            "asecSha256": ASEC_SHA256,
            "hipmUrl": HIPM_URL,
            "hipmSha256": HIPM_SHA256,
            "cboUrl": CBO_REPORT_URL,
            "incomeAndCoverageYear": 2024,
            "projectionYear": 2025,
        },
        "method": {
            "population": "People younger than 65 with HIPM direct-purchase coverage (hitype 7 or 12) or uninsured status (hitype 14), aggregated to Census TAX_ID.",
            "currentAptc": "HIPM aptc2 counted once per HIPM health-insurance unit and summed within TAX_ID; positive receipt defines the subsidized direct-purchase cells.",
            "benchmark": "Sum of HIPM individual second-lowest-cost silver benchmark needs within the coverage group; exact-age median imputation only when missing.",
            "cboCalibration": "Direct-purchase cell weights are separately reconciled to CBO average-month 2025 subsidized and unsubsidized nongroup enrollment; uninsured weights are not calibrated.",
            "moneyRounding": f"Benchmark and APTC amounts rounded to the nearest ${MONEY_BIN} before analytical-cell aggregation.",
        },
        "statusCodes": {
            "1": "direct purchase, no positive APTC",
            "2": "direct purchase, positive APTC",
            "3": "uninsured",
        },
        "sample": {
            "asecPersons": len(people),
            "asecTaxUnits": tax_units,
            "linkedHipmPersons": len(hipm_rows),
            "analyticalUnitsBeforeAggregation": len(units),
        },
        "surveyWeightedPeopleMillions": {
            "directNoPositiveAptc": no_aptc_people / 1e6,
            "directPositiveAptc": positive_aptc_people / 1e6,
            "uninsuredNonelderly": uninsured_people / 1e6,
        },
        "cboAverageMonthly2025Millions": {
            "marketplaceSubsidized": CBO_SUBSIDIZED_MARKETPLACE_2025_MILLIONS,
            "marketplaceUnsubsidized": CBO_UNSUBSIDIZED_MARKETPLACE_2025_MILLIONS,
            "outsideMarketplace": CBO_OUTSIDE_MARKETPLACE_2025_MILLIONS,
            "uninsuredAllAges": CBO_UNINSURED_2025_MILLIONS,
        },
        "statusWeightScales": {
            "1": cbo_no_aptc_people / no_aptc_people,
            "2": CBO_SUBSIDIZED_MARKETPLACE_2025_MILLIONS * 1e6 / positive_aptc_people,
            "3": 1.0,
        },
        "distributionColumns": [
            "statusCode", "coveredAdults", "coveredChildren",
            "benchmarkPremium2024", "currentAptc2024", "taxUnitWeight",
        ],
        "distribution": analytical_cells(units),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, separators=(",", ":")) + "\n", encoding="utf-8")
    return snapshot


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asec", type=Path)
    parser.add_argument("--hipm", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        asec_path = args.asec or temporary / "asecpub25csv.zip"
        hipm_path = args.hipm or temporary / "hipm-2024.csv"
        if args.asec is None:
            download(ASEC_URL, asec_path)
        if args.hipm is None:
            download(HIPM_URL, hipm_path)
        snapshot = build(asec_path, hipm_path, args.output)
    print(f"Wrote {args.output}")
    print(json.dumps({
        "surveyWeightedPeopleMillions": snapshot["surveyWeightedPeopleMillions"],
        "statusWeightScales": snapshot["statusWeightScales"],
        "analyticalCells": len(snapshot["distribution"]),
    }, indent=2))


if __name__ == "__main__":
    main()
