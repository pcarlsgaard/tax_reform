#!/usr/bin/env python3
"""Reproducible 2025 labor response for the 25/30/35 X-tax scenario.

Usage: python3 scripts/score_30_150_10800.py --archive /path/to/asecpub25csv.zip
"""

import argparse
import json
from pathlib import Path

from build_microdata import EXPECTED_SOURCE_SHA256, ROOT, read_person_units, source_sha256
from estimate_labor_response import score


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--output", type=Path,
                        default=ROOT / "analysis/scenario_30_150_10800_labor_2025.json")
    args = parser.parse_args()
    if source_sha256(args.archive) != EXPECTED_SOURCE_SHA256:
        raise ValueError("Census archive does not match the pinned public input")
    units, sample = read_person_units(args.archive)
    policy = dict(intermediate_start_per_adult=75000, intermediate_rate=.30,
                  top_threshold_per_adult=150000, child_credit=10800)
    central = score(units, **policy)
    result = {
        "schemaVersion": 1,
        "source": "2025 CPS ASEC, income year 2024, scaled to 2025 BEA cash wages",
        "archiveSha256": EXPECTED_SOURCE_SHA256,
        "sample": sample,
        "method": "Full compensation includes employer health and pensions and employer FICA; health fixed at the margin and pensions proportional to pay; full employer benefit/FICA cash pass-through; tax-only intensive margin without participation or transfer withdrawal responses; illustrative CBO-style substitution and income elasticities",
        "central": central,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "central": {
        key: central[key] for key in ("oldEarningsWeightedFederalMTR",
                                 "newEarningsWeightedFederalMTR",
                                 "totalHoursChange", "substitutionHoursChange",
                                 "incomeHoursChange", "workerShareHigherMTR",
                                 "workerShareLowerMTR")}}, indent=2))


if __name__ == "__main__":
    main()
