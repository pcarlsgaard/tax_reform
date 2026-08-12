#!/usr/bin/env python3
"""Build the browser-ready CPS ASEC tax-unit distribution.

The national X-tax model needs household microdata only for the distributional
parts of the score: the progressive wage schedule and refundable adult credit.
BEA remains the control for the aggregate compensation and business bases.

The checked-in JSON contains aggregated tax-unit cells, not respondent records.
The source archive is downloaded only during a deliberate data build.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "src" / "data" / "baseline_2025.json"
DEFAULT_OUTPUT = ROOT / "src" / "data" / "microdata_2025.json"
SOURCE_URL = "https://www2.census.gov/programs-surveys/cps/datasets/2025/march/asecpub25csv.zip"
EXPECTED_SOURCE_SHA256 = "318845a2b5e0034eb2973898de1738f4df0025727de38499e7669cb9c0deef0b"
PERSON_MEMBER = "pppub25.csv"
REPLICATE_MEMBER = "asec_csv_repwgt_2025.csv"
SOURCE_YEAR = 2025
INCOME_YEAR = 2024
REPLICATE_COUNT = 160

DEFAULT_POLICY = {
    "progressiveZeroBracketPerAdult": 30_000,
    "progressiveTopBracketPerAdult": 100_000,
    "progressiveMiddleRateShare": 0.5,
    "adultCredit": 4_800,
    "adultCreditPhaseInRate": 0.30,
    "adultCreditPhaseOutStartPerAdult": 50_000,
    "adultCreditPhaseOutRate": 0.075,
}


def as_int(value: str) -> int:
    if value == "":
        return 0
    return int(float(value))


def source_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_source(path: Path) -> None:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "tax-reform-simulator/2.0"})
    with urllib.request.urlopen(request, timeout=120) as response, path.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def read_person_units(archive_path: Path) -> tuple[list[dict], dict]:
    units: dict[int, dict] = {}
    person_count = 0
    required = [
        "TAX_ID", "PH_SEQ", "PPPOS", "A_LINENO", "A_AGE", "DEP_STAT",
        "FILESTAT", "WSAL_VAL", "MARSUPWT",
    ]
    with zipfile.ZipFile(archive_path) as archive, archive.open(PERSON_MEMBER) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
        header = next(reader)
        index = {name: header.index(name) for name in required}
        for row in reader:
            person_count += 1
            tax_id = as_int(row[index["TAX_ID"]])
            age = as_int(row[index["A_AGE"]])
            dependent_status = as_int(row[index["DEP_STAT"]])
            line_number = as_int(row[index["A_LINENO"]])
            head_rank = (1 if dependent_status > 0 else 0, line_number)
            unit = units.setdefault(tax_id, {
                "taxId": tax_id,
                "rawCashWage": 0,
                "creditAdults": 0,
                "children": 0,
                "joint": False,
                "headRank": (2, 999),
                "headWeight": 0.0,
                "headKey": None,
            })
            unit["rawCashWage"] += max(0, as_int(row[index["WSAL_VAL"]]))
            unit["creditAdults"] += int(age >= 18)
            unit["children"] += int(age < 18)
            unit["joint"] = unit["joint"] or as_int(row[index["FILESTAT"]]) in (1, 2, 3)
            if head_rank < unit["headRank"]:
                unit["headRank"] = head_rank
                unit["headWeight"] = as_int(row[index["MARSUPWT"]]) / 100
                unit["headKey"] = (
                    as_int(row[index["PH_SEQ"]]),
                    as_int(row[index["PPPOS"]]),
                )

    result = []
    for unit in units.values():
        if unit["headWeight"] <= 0 or unit["headKey"] is None:
            raise RuntimeError(f"Tax unit {unit['taxId']} has no usable reference-person weight")
        unit["scheduleAdults"] = 2 if unit.pop("joint") else 1
        unit.pop("headRank")
        result.append(unit)
    result.sort(key=lambda row: row["taxId"])
    return result, {"samplePersons": person_count, "sampleTaxUnits": len(result)}


def aggregate_distribution(units: list[dict]) -> list[list[float]]:
    cells: dict[tuple[int, int, int], float] = defaultdict(float)
    for unit in units:
        key = (unit["rawCashWage"], unit["scheduleAdults"], unit["creditAdults"])
        cells[key] += unit["headWeight"]
    return [
        [cash_wage, schedule_adults, credit_adults, round(weight, 8)]
        for (cash_wage, schedule_adults, credit_adults), weight in sorted(cells.items())
    ]


def adult_credit(compensation: float, adults: int, policy: dict = DEFAULT_POLICY) -> float:
    if adults <= 0:
        return 0.0
    maximum = adults * policy["adultCredit"]
    phase_in = min(maximum, compensation * policy["adultCreditPhaseInRate"])
    phase_out_start = adults * policy["adultCreditPhaseOutStartPerAdult"]
    phase_out = max(0.0, compensation - phase_out_start) * policy["adultCreditPhaseOutRate"]
    return max(0.0, phase_in - phase_out)


def progressive_equivalent_base(compensation: float, schedule_adults: int, policy: dict = DEFAULT_POLICY) -> float:
    zero_ceiling = schedule_adults * policy["progressiveZeroBracketPerAdult"]
    top_threshold = max(zero_ceiling, schedule_adults * policy["progressiveTopBracketPerAdult"])
    middle_base = max(0.0, min(compensation, top_threshold) - zero_ceiling)
    top_base = max(0.0, compensation - top_threshold)
    return middle_base * policy["progressiveMiddleRateShare"] + top_base


def point_estimates(units: list[dict], baseline: dict) -> tuple[dict, dict]:
    weighted_tax_units = sum(unit["headWeight"] for unit in units)
    weighted_cash_wages = sum(unit["headWeight"] * unit["rawCashWage"] for unit in units)
    weighted_adults = sum(unit["headWeight"] * unit["creditAdults"] for unit in units)
    weighted_children = sum(unit["headWeight"] * unit["children"] for unit in units)
    if min(weighted_cash_wages, weighted_adults, weighted_children) <= 0:
        raise RuntimeError("ASEC tax-unit controls must be positive")

    compensation = baseline["components"]["compensation"] * 1e9
    cash_wages = baseline["compensationComponents"]["cashWagesAndSalaries"] * 1e9
    adult_population = baseline["populationsMillions"]["adults"] * 1e6
    child_population = baseline["populationsMillions"]["children"] * 1e6
    compensation_scale = compensation / weighted_cash_wages
    cash_wage_scale = cash_wages / weighted_cash_wages
    adult_population_scale = adult_population / weighted_adults
    child_population_scale = child_population / weighted_children

    earned_credit = 0.0
    progressive_base = 0.0
    for unit in units:
        gross_compensation = unit["rawCashWage"] * compensation_scale
        earned_credit += unit["headWeight"] * adult_credit(gross_compensation, unit["creditAdults"])
        progressive_base += unit["headWeight"] * progressive_equivalent_base(
            gross_compensation, unit["scheduleAdults"]
        )
    earned_credit *= adult_population_scale

    survey = {
        "weightedTaxUnitsMillions": weighted_tax_units / 1e6,
        "weightedCashWagesBillions": weighted_cash_wages / 1e9,
        "weightedAdultsMillionsBeforeCalibration": weighted_adults / 1e6,
        "weightedChildrenMillionsBeforeCalibration": weighted_children / 1e6,
    }
    calibration = {
        "cashWageScaleToBea2025": cash_wage_scale,
        "grossCompensationScaleToBea2025": compensation_scale,
        "adultPopulationScaleToCensus2025": adult_population_scale,
        "childPopulationScaleToCensus2025": child_population_scale,
    }
    estimates = {
        "earnedAdultCreditCostBillions": earned_credit / 1e9,
        "universalAdultCreditCostBillions": adult_population * DEFAULT_POLICY["adultCredit"] / 1e9,
        "progressiveEquivalentCompensationBaseBillions": progressive_base / 1e9,
        "progressiveAverageWageRateShare": progressive_base / compensation,
    }
    return {"survey": survey, "calibration": calibration}, estimates


def replicate_standard_errors(archive_path: Path, units: list[dict], baseline: dict, point: dict) -> dict:
    unit_by_head = {unit["headKey"]: unit for unit in units}
    replicate_wages = [0.0] * REPLICATE_COUNT
    replicate_adults = [0.0] * REPLICATE_COUNT
    weight_names = [f"pwwgt{i}" for i in range(1, REPLICATE_COUNT + 1)]

    with zipfile.ZipFile(archive_path) as archive, archive.open(REPLICATE_MEMBER) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
        header = next(reader)
        h_seq_index = header.index("h_seq")
        pppos_index = header.index("PPPOS")
        weight_indices = [header.index(name) for name in weight_names]
        for row in reader:
            unit = unit_by_head.get((as_int(row[h_seq_index]), as_int(row[pppos_index])))
            if unit is None:
                continue
            for replicate, weight_index in enumerate(weight_indices):
                weight = float(row[weight_index])
                replicate_wages[replicate] += weight * unit["rawCashWage"]
                replicate_adults[replicate] += weight * unit["creditAdults"]

    compensation = baseline["components"]["compensation"] * 1e9
    adult_population = baseline["populationsMillions"]["adults"] * 1e6
    compensation_scales = [compensation / amount for amount in replicate_wages]
    adult_scales = [adult_population / amount for amount in replicate_adults]
    replicate_credits = [0.0] * REPLICATE_COUNT
    replicate_progressive = [0.0] * REPLICATE_COUNT

    with zipfile.ZipFile(archive_path) as archive, archive.open(REPLICATE_MEMBER) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
        header = next(reader)
        h_seq_index = header.index("h_seq")
        pppos_index = header.index("PPPOS")
        weight_indices = [header.index(name) for name in weight_names]
        for row in reader:
            unit = unit_by_head.get((as_int(row[h_seq_index]), as_int(row[pppos_index])))
            if unit is None:
                continue
            for replicate, weight_index in enumerate(weight_indices):
                weight = float(row[weight_index])
                compensation_value = unit["rawCashWage"] * compensation_scales[replicate]
                replicate_credits[replicate] += weight * adult_credit(
                    compensation_value, unit["creditAdults"]
                )
                replicate_progressive[replicate] += weight * progressive_equivalent_base(
                    compensation_value, unit["scheduleAdults"]
                )

    replicate_credits = [
        value * adult_scales[index] / 1e9 for index, value in enumerate(replicate_credits)
    ]
    replicate_progressive = [value / 1e9 for value in replicate_progressive]

    def standard_error(full_sample: float, replicates: list[float]) -> float:
        variance = (4 / REPLICATE_COUNT) * sum((value - full_sample) ** 2 for value in replicates)
        return math.sqrt(variance)

    return {
        "method": "Census ASEC 160 replicate weights; variance = (4/160) × sum((replicate − full sample)^2)",
        "earnedAdultCreditCostStandardErrorBillions": standard_error(
            point["earnedAdultCreditCostBillions"], replicate_credits
        ),
        "progressiveEquivalentBaseStandardErrorBillions": standard_error(
            point["progressiveEquivalentCompensationBaseBillions"], replicate_progressive
        ),
    }


def build(archive_path: Path, baseline: dict) -> dict:
    archive_sha256 = source_sha256(archive_path)
    if archive_sha256 != EXPECTED_SOURCE_SHA256:
        raise RuntimeError(
            "Census source archive digest changed; review the upstream revision and update the pinned digest deliberately"
        )
    units, sample = read_person_units(archive_path)
    controls, estimates = point_estimates(units, baseline)
    compensation_components = baseline["compensationComponents"]
    compensation_total = sum(compensation_components.values())
    if abs(compensation_total - baseline["components"]["compensation"]) > 0.01:
        raise RuntimeError("BEA compensation components do not reconcile to total compensation")

    snapshot = {
        "schemaVersion": 1,
        "snapshot": "cps-asec-2025-bea-2025-v1",
        "source": {
            "label": "2025 Current Population Survey Annual Social and Economic Supplement",
            "url": SOURCE_URL,
            "archiveSha256": archive_sha256,
            "personFile": PERSON_MEMBER,
            "replicateWeightFile": REPLICATE_MEMBER,
            "collectionYear": SOURCE_YEAR,
            "incomeYear": INCOME_YEAR,
            "projectionYear": baseline["dataYear"],
        },
        "method": {
            "taxUnits": "Census TAX_ID; reference-person MARSUPWT; joint schedule from FILESTAT 1-3",
            "adultCreditUnits": "All persons age 18+ assigned to the Census tax unit; calibrated to the 2025 Census adult population",
            "children": "All persons under 18 assigned to the Census tax unit; calibrated to the 2025 Census child population",
            "compensation": "ASEC WSAL_VAL distribution raked to BEA wages; employer social-insurance and pension/insurance supplements allocated in proportion to cash wages",
            "scope": "Static tax-unit distribution; no behavior, take-up response, or top-tail administrative match beyond BEA aggregate raking",
        },
        "sample": sample,
        **controls,
        "compensationControlsBillions": {
            **compensation_components,
            "totalCompensation": compensation_total,
        },
        "defaultPolicy": DEFAULT_POLICY,
        "defaultEstimates": estimates,
        "uncertainty": replicate_standard_errors(archive_path, units, baseline, estimates),
        "distributionColumns": [
            "asecCashWageDollars", "scheduleAdults", "creditAdults", "taxUnitWeight"
        ],
        "distribution": aggregate_distribution(units),
    }
    return snapshot


def verify(snapshot: dict) -> None:
    if snapshot["source"]["archiveSha256"] != EXPECTED_SOURCE_SHA256:
        raise RuntimeError("Microdata snapshot does not match the pinned Census archive digest")
    components = snapshot["compensationControlsBillions"]
    detail = (
        components["cashWagesAndSalaries"]
        + components["employerGovernmentSocialInsurance"]
        + components["employerPensionAndInsurance"]
    )
    if abs(detail - components["totalCompensation"]) > 0.01:
        raise RuntimeError("Microdata compensation components do not reconcile")
    if not (0.8 < snapshot["calibration"]["cashWageScaleToBea2025"] < 1.3):
        raise RuntimeError("ASEC-to-BEA wage calibration is outside its audit guardrail")
    factor = snapshot["defaultEstimates"]["progressiveAverageWageRateShare"]
    if not 0 < factor < 1:
        raise RuntimeError("Progressive rate-equivalent factor must be between zero and one")
    earned = snapshot["defaultEstimates"]["earnedAdultCreditCostBillions"]
    universal = snapshot["defaultEstimates"]["universalAdultCreditCostBillions"]
    if not 0 <= earned <= universal:
        raise RuntimeError("Earned adult credit must not exceed the universal-credit maximum")
    if not snapshot["distribution"]:
        raise RuntimeError("Microdata distribution is empty")
    print(f"Tax units: {snapshot['sample']['sampleTaxUnits']:,}")
    print(f"ASEC cash wages: ${snapshot['survey']['weightedCashWagesBillions']:,.1f}B")
    print(f"BEA cash-wage scale: {snapshot['calibration']['cashWageScaleToBea2025']:.4f}")
    print(f"All-compensation scale: {snapshot['calibration']['grossCompensationScaleToBea2025']:.4f}")
    print(f"Earned adult credit: ${earned:,.1f}B")
    print(f"Progressive equivalent compensation base: ${snapshot['defaultEstimates']['progressiveEquivalentCompensationBaseBillions']:,.1f}B")
    print(f"Progressive average/top rate share: {factor:.2%}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-zip", type=Path, help="Existing Census ASEC CSV archive")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    if args.verify_only:
        snapshot = json.loads(args.output.read_text(encoding="utf-8"))
        verify(snapshot)
        return

    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    if args.input_zip:
        snapshot = build(args.input_zip, baseline)
    else:
        with tempfile.TemporaryDirectory(prefix="tax-reform-microdata-") as directory:
            archive_path = Path(directory) / "asecpub25csv.zip"
            download_source(archive_path)
            snapshot = build(archive_path, baseline)
    verify(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
