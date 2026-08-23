#!/usr/bin/env python3
"""Trim the full Pareto-search artifact to the fields used by the browser chart."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "analysis" / "pareto_search_replacement_2025.json"
OUTPUT = ROOT / "src" / "data" / "pareto_frontier_2025.json"

FIELDS = (
    "candidate_id",
    "family",
    "rate",
    "middle_wage_rate",
    "adult_health_credit",
    "child_health_credit",
    "total_health_credit_cost_billions",
    "esi_winner_share",
    "mean_absolute_mtr_change",
    "mtr_within_two_points_share",
    "esi_median_change_dollars",
)


def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    fiscal_identity = source["fiscal_identity"]
    additional_revenue = fiscal_identity["additional_revenue_billions"]
    selected = source["selected"]
    compact = {
        "schemaVersion": 2,
        "snapshot": source["experiment"],
        "referenceLabel": "Static deficit reduction versus current law",
        "currentLawReplacementBaselineBillions": fiscal_identity["replacement_target_billions"],
        "candidateDraws": source["candidate_draws"],
        "feasibleCandidates": source["feasible_candidates"],
        "selectedIds": {
            "mtrPreservation": selected["mtr_preservation_at_67pct_winners"]["default"]["candidate_id"],
            "balanced": selected["balanced"]["default"]["candidate_id"],
        },
        "points": [
            {
                **{key: row[key] for key in FIELDS},
                "deficit_reduction_billions": row["fiscal_gap_billions"] + additional_revenue,
            }
            for row in source["frontier"]
        ],
    }
    OUTPUT.write_text(json.dumps(compact, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(compact['points'])} frontier points to {OUTPUT}")


if __name__ == "__main__":
    main()
