#!/usr/bin/env python3
"""Trim the full Pareto-search artifact to the fields used by the browser chart."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "analysis" / "pareto_search_near_term_debt_2025.json"
OUTPUT = ROOT / "src" / "data" / "pareto_frontier_2025.json"

FIELDS = (
    "candidate_id",
    "family",
    "rate",
    "middle_wage_rate",
    "adult_health_credit",
    "child_health_credit",
    "total_health_credit_cost_billions",
    "fiscal_gap_billions",
    "esi_winner_share",
    "mean_absolute_mtr_change",
    "mtr_within_two_points_share",
    "esi_median_change_dollars",
)


def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    compact = {
        "schemaVersion": 1,
        "snapshot": source["experiment"],
        "targetLabel": source["fiscal_identity"]["target_label"],
        "targetRevenueBillions": source["fiscal_identity"]["target_revenue_billions"],
        "candidateDraws": source["candidate_draws"],
        "feasibleCandidates": source["feasible_candidates"],
        "selectedIds": {"plan2146": 2146, "balanced": 1570},
        "points": [
            {key: row[key] for key in FIELDS}
            for row in source["frontier"]
        ],
    }
    OUTPUT.write_text(json.dumps(compact, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(compact['points'])} frontier points to {OUTPUT}")


if __name__ == "__main__":
    main()
