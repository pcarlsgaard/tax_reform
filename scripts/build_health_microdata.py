#!/usr/bin/env python3
"""Build the browser-ready employer-health-insurance transition sample.

The public CPS ASEC identifies ESI policyholders, plan tier, whether the
employer pays all/some/none of the premium, and household-paid premiums.  It
does not report employer contribution dollars.  This builder imputes those
dollars from MEPS-IC cells, reconciles the national total to BEA group-health
compensation, and joins Census's HIPM individual benchmark-premium measure.

The checked-in asset contains anonymous, rounded analytical cells rather than
person or household identifiers.  It supports a static transition experiment;
it is not an individual-market equilibrium model.
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
BASELINE_PATH = ROOT / "src" / "data" / "baseline_2025.json"
DEFAULT_OUTPUT = ROOT / "src" / "data" / "health_esi_2025.json"

ASEC_URL = "https://www2.census.gov/programs-surveys/cps/datasets/2025/march/asecpub25csv.zip"
ASEC_SHA256 = "318845a2b5e0034eb2973898de1738f4df0025727de38499e7669cb9c0deef0b"
ASEC_PERSON_MEMBER = "pppub25.csv"
HIPM_URL = "https://www2.census.gov/library/working-papers/2025/demo/hipm-2024.csv"
HIPM_SHA256 = "2aa0d58ae7c48a04e359c0f97995f6160ed63d5666ed91097ff27209061f922f"

# BEA County Personal Income methodology, table A (2024 detail).  BEA's annual
# health detail currently ends in 2024, so the 2025 control grows group health
# with the checked-in 2024-to-2025 employer pension-and-insurance supplement.
BEA_GROUP_HEALTH_2024_BILLIONS = 1011.360
BEA_PENSION_INSURANCE_2024_BILLIONS = 1760.476
BEA_DETAIL_URL = "https://www.bea.gov/system/files/methodologies/BEA-County-Personal-Income-Concepts-and-Methods.pdf"

# 2025 MEPS-IC employer cost means for private-sector plans.  Firm-size
# columns match ASEC NOEMP except its 100-499 and 500-999 categories, which
# both use the MEPS 100-999 estimate.  Index 0 is the national fallback.
MEPS_PRIVATE_EMPLOYER_COST_2025 = {
    1: {0: 7209, 1: 7653, 2: 6976, 3: 6691, 4: 7220, 5: 7220, 6: 7319},
    2: {0: 13125, 1: 11909, 2: 12309, 3: 10799, 4: 13135, 5: 13135, 6: 13633},
    3: {0: 18967, 1: 17655, 2: 16417, 3: 15350, 4: 19377, 5: 19377, 6: 19683},
}
MEPS_PRIVATE_EMPLOYEE_COST_2025 = {1: 1817, 2: 4776, 3: 7314}
MEPS_PRIVATE_EMPLOYEE_COST_2024 = {1: 1789, 2: 4707, 3: 7216}
MEPS_PRIVATE_URL = "https://meps.ahrq.gov/data_stats/summ_tables/insr/national/series_1/2025/ic25_ia_g.pdf"

# Public-sector MEPS-IC 2025 tables are not yet published.  Inflate the 2024
# state/local employer-cost means by the 2024-to-2025 private-sector change in
# the same tier.  Federal workers use this public-sector proxy.
MEPS_PUBLIC_EMPLOYER_COST_2024 = {1: 8631, 2: 14513, 3: 21246}
MEPS_PRIVATE_EMPLOYER_COST_2024 = {1: 6697, 2: 12224, 3: 17324}
MEPS_PUBLIC_EMPLOYEE_COST_2024 = {1: 1057, 2: 3426, 3: 4763}
MEPS_PUBLIC_URL = "https://meps.ahrq.gov/data_stats/summ_tables/insr/national/series_3/2024/ic24_iiia_g.pdf"

HIPM_DICTIONARY_URL = "https://www2.census.gov/library/working-papers/2025/demo/hipm-extract-data-dictionary.pdf"
CMS_QHP_URL = "https://www.cms.gov/files/document/2025-qhp-premiums-choice-report.pdf"

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


def public_employer_cost_2025(tier: int) -> float:
    growth = (
        MEPS_PRIVATE_EMPLOYER_COST_2025[tier][0]
        / MEPS_PRIVATE_EMPLOYER_COST_2024[tier]
    )
    return MEPS_PUBLIC_EMPLOYER_COST_2024[tier] * growth


def employer_cost(tier: int, sector: int, employer_size: int) -> float:
    if tier not in (1, 2, 3):
        return 0.0
    if sector == 1:
        return MEPS_PRIVATE_EMPLOYER_COST_2025[tier].get(
            employer_size, MEPS_PRIVATE_EMPLOYER_COST_2025[tier][0]
        )
    if sector in (2, 3, 4):
        return public_employer_cost_2025(tier)
    return MEPS_PRIVATE_EMPLOYER_COST_2025[tier][0]


def employee_cost(tier: int, sector: int) -> float:
    if tier not in (1, 2, 3):
        return 0.0
    if sector in (2, 3, 4):
        growth = MEPS_PRIVATE_EMPLOYEE_COST_2025[tier] / MEPS_PRIVATE_EMPLOYEE_COST_2024[tier]
        return MEPS_PUBLIC_EMPLOYEE_COST_2024[tier] * growth
    return MEPS_PRIVATE_EMPLOYEE_COST_2025[tier]


def sector_code(class_of_worker: int) -> int:
    if class_of_worker == 1:
        return 1  # private
    if class_of_worker == 2:
        return 2  # federal
    if class_of_worker == 3:
        return 3  # state
    if class_of_worker == 4:
        return 4  # local
    return 5


def redistribution_cell(sector: int, employer_size: int) -> str:
    if sector == 1:
        return f"private-{employer_size if employer_size in range(1, 7) else 0}"
    if sector in (2, 3, 4):
        return "public"
    return "other"


def age_band(age: int | None) -> int:
    if age is None:
        return 0
    if age < 30:
        return 1
    if age < 40:
        return 2
    if age < 50:
        return 3
    if age < 60:
        return 4
    return 5


def read_hipm(path: Path) -> dict[tuple[int, int], dict]:
    rows: dict[tuple[int, int], dict] = {}
    with path.open(newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            rows[(as_int(row["h_seq"]), as_int(row["pppos"]))] = {
                "hitype": as_int(row["hitype"]),
                "indNeed": as_float(row["ind_need"]),
            }
    return rows


def read_people(asec_path: Path, hipm: dict[tuple[int, int], dict]) -> tuple[list[dict], dict]:
    required = [
        "TAX_ID", "PH_SEQ", "PPPOS", "A_LINENO", "A_AGE", "DEP_STAT",
        "FILESTAT", "WSAL_VAL", "MARSUPWT", "GRP", "OWNGRP", "GRPFTYP2",
        "HIPAID", "PHIP_VAL2", "NOEMP", "INDUSTRY", "LJCW",
    ]
    people = []
    hipm_matches = 0
    with zipfile.ZipFile(asec_path) as archive, archive.open(ASEC_PERSON_MEMBER) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
        header = next(reader)
        index = {name: header.index(name) for name in required}
        for row in reader:
            h_seq = as_int(row[index["PH_SEQ"]])
            pppos = as_int(row[index["PPPOS"]])
            health = hipm.get((h_seq, pppos), {"hitype": 0, "indNeed": 0.0})
            hipm_matches += int((h_seq, pppos) in hipm)
            people.append({
                "taxId": as_int(row[index["TAX_ID"]]),
                "hSeq": h_seq,
                "pppos": pppos,
                "line": as_int(row[index["A_LINENO"]]),
                "age": as_int(row[index["A_AGE"]]),
                "dependent": as_int(row[index["DEP_STAT"]]),
                "fileStatus": as_int(row[index["FILESTAT"]]),
                "wage": max(0, as_int(row[index["WSAL_VAL"]])),
                "weight": as_int(row[index["MARSUPWT"]]) / 100,
                "grp": as_int(row[index["GRP"]]),
                "ownGrp": as_int(row[index["OWNGRP"]]),
                "tier": as_int(row[index["GRPFTYP2"]]),
                "employerPays": as_int(row[index["HIPAID"]]),
                "employeePremium": max(0.0, as_float(row[index["PHIP_VAL2"]])),
                "employerSize": as_int(row[index["NOEMP"]]),
                "industry": as_int(row[index["INDUSTRY"]]),
                "sector": sector_code(as_int(row[index["LJCW"]])),
                **health,
            })
    return people, {
        "samplePersons": len(people),
        "hipmMatchedPersons": hipm_matches,
        "hipmMatchRate": hipm_matches / len(people),
    }


def build_units(people: list[dict]) -> tuple[list[dict], dict]:
    positive_needs: dict[int, list[float]] = defaultdict(list)
    for person in people:
        if person["hitype"] in (6, 11) and person["age"] < 65 and person["indNeed"] > 0:
            positive_needs[person["age"]].append(person["indNeed"])
    need_by_age = {age: statistics.median(values) for age, values in positive_needs.items()}

    units: dict[int, dict] = {}
    all_policyholder_raw_pool = 0.0
    transition_raw_pool = 0.0
    policyholder_count = 0
    for person in people:
        rank = (1 if person["dependent"] > 0 else 0, person["line"])
        unit = units.setdefault(person["taxId"], {
            "taxId": person["taxId"],
            "wages": [],
            "creditAdults": 0,
            "children": 0,
            "scheduleAdults": 1,
            "headRank": (2, 999),
            "weight": 0.0,
            "coveredPeople": 0,
            "coveredAdults": 0,
            "benchmark2024": 0.0,
            "rawEmployeePremium": 0.0,
            "targetEmployeePremium": 0.0,
            "rawEmployerContribution": 0.0,
            "policyholderRecipients": [],
            "coveredWorkerRecipients": [],
            "policyholders": [],
        })
        unit["wages"].append(person["wage"])
        unit["creditAdults"] += int(person["age"] >= 18)
        unit["children"] += int(person["age"] < 18)
        unit["scheduleAdults"] = max(
            unit["scheduleAdults"], 2 if person["fileStatus"] in (1, 2, 3) else 1
        )
        if rank < unit["headRank"]:
            unit["headRank"] = rank
            unit["weight"] = person["weight"]

        nonelderly_esi = person["hitype"] in (6, 11) and person["age"] < 65
        if nonelderly_esi:
            unit["coveredPeople"] += 1
            unit["coveredAdults"] += int(person["age"] >= 18)
            unit["benchmark2024"] += person["indNeed"] if person["indNeed"] > 0 else need_by_age.get(person["age"], 0.0)
            if 18 <= person["age"] < 65 and person["wage"] > 0:
                unit["coveredWorkerRecipients"].append(
                    redistribution_cell(person["sector"], person["employerSize"])
                )

        is_policyholder = person["ownGrp"] == 1 and person["tier"] in (1, 2, 3)
        if is_policyholder and person["age"] >= 18:
            policyholder_count += 1
            predicted = employer_cost(person["tier"], person["sector"], person["employerSize"])
            if person["employerPays"] == 3:
                predicted = 0.0
            all_policyholder_raw_pool += person["weight"] * predicted
            if person["age"] < 65:
                transition_raw_pool += person["weight"] * predicted
                unit["rawEmployerContribution"] += predicted
                if person["employerPays"] != 1:
                    unit["rawEmployeePremium"] += person["employeePremium"]
                unit["targetEmployeePremium"] += employee_cost(person["tier"], person["sector"])
                cell = redistribution_cell(person["sector"], person["employerSize"])
                if person["wage"] > 0:
                    unit["policyholderRecipients"].append(cell)
                unit["policyholders"].append({
                    "tier": person["tier"],
                    "age": person["age"],
                    "sector": person["sector"],
                    "employerSize": person["employerSize"],
                    "cell": cell,
                    "predictedContribution": predicted,
                })

    health_units = []
    for unit in units.values():
        if unit["weight"] <= 0:
            raise RuntimeError(f"Tax unit {unit['taxId']} has no usable reference-person weight")
        if unit["coveredPeople"] <= 0 and unit["rawEmployerContribution"] <= 0:
            continue
        wages = sorted(unit.pop("wages"), reverse=True)
        total_wage = sum(wages)
        primary_wage = wages[0] if wages else 0
        secondary_wage = total_wage - primary_wage if unit["scheduleAdults"] == 2 else 0
        if unit["scheduleAdults"] == 1:
            primary_wage = total_wage
        unit["primaryWage"] = primary_wage
        unit["secondaryWage"] = secondary_wage
        unit.pop("headRank")
        health_units.append(unit)
    return health_units, {
        "sampleTaxUnits": len(units),
        "healthTaxUnits": len(health_units),
        "sampleEsiPolicyholders": policyholder_count,
        "rawAllPolicyholderEmployerPoolBillions": all_policyholder_raw_pool / 1e9,
        "rawTransitionEmployerPoolBillions": transition_raw_pool / 1e9,
    }


def add_calibrations(units: list[dict], baseline: dict, unit_stats: dict) -> dict:
    employer_pension_insurance_2025 = baseline["compensationComponents"]["employerPensionAndInsurance"]
    group_health_2025 = (
        BEA_GROUP_HEALTH_2024_BILLIONS
        * employer_pension_insurance_2025
        / BEA_PENSION_INSURANCE_2024_BILLIONS
    )
    all_raw = unit_stats["rawAllPolicyholderEmployerPoolBillions"]
    if all_raw <= 0:
        raise RuntimeError("Imputed employer contribution pool must be positive")
    employer_scale = group_health_2025 / all_raw
    transition_pool = unit_stats["rawTransitionEmployerPoolBillions"] * employer_scale * 1e9
    raw_employee_pool = sum(unit["weight"] * unit["rawEmployeePremium"] for unit in units)
    target_employee_pool = sum(unit["weight"] * unit["targetEmployeePremium"] for unit in units)
    if min(raw_employee_pool, target_employee_pool) <= 0:
        raise RuntimeError("Employee premium controls must be positive")
    employee_premium_scale = target_employee_pool / raw_employee_pool

    pool_by_cell: dict[str, float] = defaultdict(float)
    policyholder_recipients_by_cell: dict[str, float] = defaultdict(float)
    covered_worker_recipients_by_cell: dict[str, float] = defaultdict(float)
    total_policyholder_recipients = 0.0
    total_covered_worker_recipients = 0.0
    for unit in units:
        unit["employerContribution"] = unit["rawEmployerContribution"] * employer_scale
        unit["employeePremium"] = unit["rawEmployeePremium"] * employee_premium_scale
        policyholder_cells = unit["policyholders"]
        for policyholder in policyholder_cells:
            pool_by_cell[policyholder["cell"]] += (
                unit["weight"] * policyholder["predictedContribution"] * employer_scale
            )
        for cell in unit["policyholderRecipients"]:
            policyholder_recipients_by_cell[cell] += unit["weight"]
            total_policyholder_recipients += unit["weight"]
        for cell in unit["coveredWorkerRecipients"]:
            covered_worker_recipients_by_cell[cell] += unit["weight"]
            total_covered_worker_recipients += unit["weight"]

    if min(total_policyholder_recipients, total_covered_worker_recipients) <= 0:
        raise RuntimeError("ESI redistribution recipient controls must be positive")

    national_policyholder_amount = transition_pool / total_policyholder_recipients
    national_covered_worker_amount = transition_pool / total_covered_worker_recipients

    def cell_amounts(recipients: dict[str, float], total_recipients: float) -> dict[str, float]:
        unallocated = sum(pool for cell, pool in pool_by_cell.items() if recipients.get(cell, 0) <= 0)
        supplement = unallocated / total_recipients
        return {
            cell: pool_by_cell.get(cell, 0.0) / count + supplement
            for cell, count in recipients.items()
            if count > 0
        }

    policyholder_cell_amount = cell_amounts(policyholder_recipients_by_cell, total_policyholder_recipients)
    covered_worker_cell_amount = cell_amounts(covered_worker_recipients_by_cell, total_covered_worker_recipients)
    for unit in units:
        unit["nationalPolicyholderWage"] = national_policyholder_amount * len(unit["policyholderRecipients"])
        unit["nationalCoveredWorkerWage"] = national_covered_worker_amount * len(unit["coveredWorkerRecipients"])
        unit["cellPolicyholderWage"] = sum(
            policyholder_cell_amount.get(cell, 0.0) for cell in unit["policyholderRecipients"]
        )
        unit["cellCoveredWorkerWage"] = sum(
            covered_worker_cell_amount.get(cell, 0.0) for cell in unit["coveredWorkerRecipients"]
        )

    return {
        "beaGroupHealth2024Billions": BEA_GROUP_HEALTH_2024_BILLIONS,
        "beaPensionInsurance2024Billions": BEA_PENSION_INSURANCE_2024_BILLIONS,
        "beaPensionInsurance2025Billions": employer_pension_insurance_2025,
        "projectedBeaGroupHealth2025Billions": group_health_2025,
        "employerContributionScaleToBea": employer_scale,
        "employeePremiumScaleToMeps2025": employee_premium_scale,
        "targetEmployeePremium2025Billions": target_employee_pool / 1e9,
        "nonelderlyTransitionEmployerPoolBillions": transition_pool / 1e9,
        "weightedPolicyholderWorkersMillions": total_policyholder_recipients / 1e6,
        "weightedCoveredWorkersMillions": total_covered_worker_recipients / 1e6,
        "nationalEqualWagePerPolicyholderWorker": national_policyholder_amount,
        "nationalEqualWagePerCoveredWorker": national_covered_worker_amount,
    }


def assign_income_deciles(units: list[dict], wage_scale: float) -> None:
    ordered = sorted(units, key=lambda unit: (unit["primaryWage"] + unit["secondaryWage"]) * wage_scale)
    total_weight = sum(unit["weight"] for unit in ordered)
    cumulative = 0.0
    for unit in ordered:
        midpoint = cumulative + unit["weight"] / 2
        unit["incomeDecile"] = min(10, int(midpoint / total_weight * 10) + 1)
        cumulative += unit["weight"]


def rounded_money(value: float) -> int:
    return int(round(value / MONEY_BIN) * MONEY_BIN)


def analytical_cells(units: list[dict]) -> tuple[list[list[float]], dict]:
    cells: dict[tuple[int, ...], float] = defaultdict(float)
    for unit in units:
        primary_policyholder = max(
            unit["policyholders"], key=lambda item: item["predictedContribution"], default=None
        )
        key = (
            rounded_money(unit["primaryWage"]),
            rounded_money(unit["secondaryWage"]),
            unit["scheduleAdults"],
            unit["creditAdults"],
            unit["children"],
            unit["coveredPeople"],
            unit["coveredAdults"],
            rounded_money(unit["employeePremium"]),
            rounded_money(unit["employerContribution"]),
            rounded_money(unit["benchmark2024"]),
            rounded_money(unit["nationalPolicyholderWage"]),
            rounded_money(unit["nationalCoveredWorkerWage"]),
            rounded_money(unit["cellPolicyholderWage"]),
            rounded_money(unit["cellCoveredWorkerWage"]),
            len(unit["policyholderRecipients"]),
            len(unit["coveredWorkerRecipients"]),
            primary_policyholder["tier"] if primary_policyholder else 0,
            age_band(primary_policyholder["age"] if primary_policyholder else None),
            primary_policyholder["sector"] if primary_policyholder else 0,
            primary_policyholder["employerSize"] if primary_policyholder else 0,
            unit["incomeDecile"],
        )
        cells[key] += unit["weight"]
    distribution = [list(key) + [round(weight, 8)] for key, weight in sorted(cells.items())]

    def weighted_sum(index: int) -> float:
        return sum(row[index] * row[-1] for row in distribution)

    return distribution, {
        "analyticalCells": len(distribution),
        "weightedHealthTaxUnitsMillions": sum(row[-1] for row in distribution) / 1e6,
        "weightedEsiCoveredPeopleMillions": weighted_sum(5) / 1e6,
        "employeePremiumBillions": weighted_sum(7) / 1e9,
        "employerContributionPoolBillions": weighted_sum(8) / 1e9,
        "benchmarkPremium2024Billions": weighted_sum(9) / 1e9,
        "nationalPolicyholderAllocationBillions": weighted_sum(10) / 1e9,
        "nationalCoveredWorkerAllocationBillions": weighted_sum(11) / 1e9,
        "cellPolicyholderAllocationBillions": weighted_sum(12) / 1e9,
        "cellCoveredWorkerAllocationBillions": weighted_sum(13) / 1e9,
    }


def build(asec_path: Path, hipm_path: Path, baseline: dict) -> dict:
    if sha256(asec_path) != ASEC_SHA256:
        raise RuntimeError("Census ASEC archive digest changed; review the upstream revision")
    if sha256(hipm_path) != HIPM_SHA256:
        raise RuntimeError("Census HIPM extract digest changed; review the upstream revision")
    hipm = read_hipm(hipm_path)
    people, sample = read_people(asec_path, hipm)
    units, unit_stats = build_units(people)
    calibration = add_calibrations(units, baseline, unit_stats)
    wage_scale = json.loads((ROOT / "src" / "data" / "microdata_2025.json").read_text())["calibration"]["cashWageScaleToBea2025"]
    assign_income_deciles(units, wage_scale)
    distribution, browser = analytical_cells(units)
    snapshot = {
        "schemaVersion": 1,
        "snapshot": "cps-asec-2025-hipm-2024-meps-bea-esi-transition-v1",
        "source": {
            "asec": {"url": ASEC_URL, "sha256": ASEC_SHA256, "personFile": ASEC_PERSON_MEMBER},
            "hipm": {"url": HIPM_URL, "sha256": HIPM_SHA256, "dictionaryUrl": HIPM_DICTIONARY_URL},
            "mepsPrivate": {"year": 2025, "url": MEPS_PRIVATE_URL},
            "mepsPublic": {"year": 2024, "url": MEPS_PUBLIC_URL},
            "bea": {"year": 2024, "url": BEA_DETAIL_URL},
            "cmsBenchmarkTrend": {"year": 2025, "url": CMS_QHP_URL},
            "incomeYear": 2024,
            "projectionYear": 2025,
        },
        "method": {
            "scope": "People under 65 with ESI and their Census TAX_ID units; static transition to individual benchmark coverage",
            "employeePremium": "ASEC PHIP_VAL2 variation for in-house nonelderly ESI policyholders; zeroed when HIPAID says employer paid all and raked to the 2025 MEPS-IC tier/sector mean",
            "employerContribution": "MEPS-IC employer-cost mean by tier, private firm size, and public/private sector; HIPAID none set to zero; raked to projected BEA group health",
            "benchmarkPremium": "Census HIPM ind_need second-lowest-cost Silver benchmark by age and location for 2024; zero values replaced by the national age median; the browser's 1.03 default factor follows CMS's reported average 2025 benchmark-premium change",
            "redistribution": "National equal or sector/firm-size-cell equal wages, with policyholder-worker and all-ESI-covered-worker recipient scopes",
            "rounding": f"Browser analytical cells omit identifiers and round dollar fields to the nearest ${MONEY_BIN}",
        },
        "mepsMeansDollars": {
            "privateEmployer2025": {str(tier): values for tier, values in MEPS_PRIVATE_EMPLOYER_COST_2025.items()},
            "privateEmployee2025": MEPS_PRIVATE_EMPLOYEE_COST_2025,
            "publicEmployer2024": MEPS_PUBLIC_EMPLOYER_COST_2024,
            "publicEmployee2024": MEPS_PUBLIC_EMPLOYEE_COST_2024,
            "publicEmployer2025Proxy": {tier: public_employer_cost_2025(tier) for tier in (1, 2, 3)},
        },
        "sample": {**sample, **unit_stats},
        "calibration": {"cashWageScaleToBea2025": wage_scale, **calibration},
        "browserReconciliation": browser,
        "distributionColumns": [
            "primaryAsecCashWage", "secondaryAsecCashWage", "scheduleAdults", "creditAdults",
            "children", "esiCoveredPeople", "esiCoveredAdults", "employeePremium", "employerContribution",
            "benchmarkPremium2024", "nationalEqualPolicyholderWage", "nationalEqualCoveredWorkerWage",
            "cellEqualPolicyholderWage", "cellEqualCoveredWorkerWage", "policyholderWorkers", "coveredWorkers",
            "planTier", "primaryPolicyholderAgeBand", "primaryPolicyholderSector", "primaryEmployerSize",
            "esiCashWageDecile", "taxUnitWeight",
        ],
        "distribution": distribution,
    }
    return snapshot


def verify(snapshot: dict) -> None:
    if snapshot["source"]["asec"]["sha256"] != ASEC_SHA256:
        raise RuntimeError("Health snapshot ASEC digest does not match the pinned source")
    if snapshot["source"]["hipm"]["sha256"] != HIPM_SHA256:
        raise RuntimeError("Health snapshot HIPM digest does not match the pinned source")
    if snapshot["sample"]["hipmMatchRate"] < 0.99:
        raise RuntimeError("HIPM-to-ASEC linkage rate is below 99%")
    browser = snapshot["browserReconciliation"]
    pool = browser["employerContributionPoolBillions"]
    target = snapshot["calibration"]["nonelderlyTransitionEmployerPoolBillions"]
    if abs(pool - target) / target > 0.005:
        raise RuntimeError("Rounded browser employer pool does not reconcile to the nonelderly BEA control")
    for key in (
        "nationalPolicyholderAllocationBillions", "nationalCoveredWorkerAllocationBillions",
        "cellPolicyholderAllocationBillions", "cellCoveredWorkerAllocationBillions",
    ):
        if abs(browser[key] - pool) / pool > 0.005:
            raise RuntimeError(f"Health wage allocation {key} does not reconcile to employer contributions")
    if min(browser["weightedEsiCoveredPeopleMillions"], browser["benchmarkPremium2024Billions"]) <= 0:
        raise RuntimeError("ESI coverage and benchmark-premium controls must be positive")
    if not snapshot["distribution"]:
        raise RuntimeError("Health analytical distribution is empty")
    print(f"Health analytical cells: {browser['analyticalCells']:,}")
    print(f"Weighted nonelderly ESI lives: {browser['weightedEsiCoveredPeopleMillions']:,.1f}M")
    print(f"Employee premium spending: ${browser['employeePremiumBillions']:,.1f}B")
    print(f"Employer ESI pool: ${pool:,.1f}B")
    print(f"2024 SLCSP benchmark total: ${browser['benchmarkPremium2024Billions']:,.1f}B")
    print(f"Equal wage per policyholder worker: ${snapshot['calibration']['nationalEqualWagePerPolicyholderWorker']:,.0f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asec-zip", type=Path, help="Existing 2025 ASEC CSV archive")
    parser.add_argument("--hipm-csv", type=Path, help="Existing Census HIPM 2024 extract")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    if args.verify_only:
        snapshot = json.loads(args.output.read_text(encoding="utf-8"))
        verify(snapshot)
        return

    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(prefix="tax-reform-health-") as directory:
        asec_path = args.asec_zip or Path(directory) / "asecpub25csv.zip"
        hipm_path = args.hipm_csv or Path(directory) / "hipm-2024.csv"
        if args.asec_zip is None:
            download(ASEC_URL, asec_path)
        if args.hipm_csv is None:
            download(HIPM_URL, hipm_path)
        snapshot = build(asec_path, hipm_path, baseline)
    verify(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
