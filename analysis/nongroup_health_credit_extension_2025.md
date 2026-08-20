# Nongroup health-credit extension and near-term fiscal target

## Policy scored

The proposed refundable premium-purchase credit is $3,250 per covered adult and $1,250 per covered child, capped at the tax unit's aggregate second-lowest-cost Silver benchmark premium. It is a credit, not an income exclusion.

The incremental federal cost is calculated as follows:

- Nongroup coverage with no current premium tax credit (PTC): the full proposed credit.
- Nongroup coverage with a positive advance PTC below the proposed floor: `max(proposed credit − current APTC, 0)`.
- Previously uninsured people: the full proposed credit only for people induced to enroll. The central case assumes 15% take-up; zero-to-100% results are shown below.

HIPM APTC amounts are deduplicated at the health-insurance-unit level before aggregation to CPS tax units. Direct-purchase cells are reconciled to CBO's February 2026 average-month estimates for 2025: 20.9 million subsidized Marketplace enrollees, 1.6 million unsubsidized Marketplace enrollees, and 3.0 million people with nongroup coverage outside the Marketplaces. The linked CPS/HIPM sample contains 25.7 million uninsured people younger than 65, close to CBO's 26.6 million uninsured people of all ages.

## Incremental annual cost in the 2025 model

| Extension group | People/control | Annual cost |
|---|---:|---:|
| (a) Nongroup, no positive PTC | 4.6 million | $13.4B |
| (b) Current positive PTC below the proposed floor | About 6.29 million recipients out of a 20.9 million subsidized reweighting universe | $8.3B |
| (c) Previously uninsured, 15% take-up | 3.85 million induced enrollees | $11.3B |
| **Total, central case** |  | **$33.0B** |

Full take-up by all 25.7 million nonelderly uninsured people would cost $75.6 billion for group (c) and $97.3 billion for all three groups combined. The 15% central assumption is a scenario, not a behavioral estimate from HIPM. It implies 3.85 million induced enrollees, which is deliberately in the same order as CBO's estimate that permanently restoring the expanded ACA PTC would increase insurance coverage by 3.8 million in 2035; the policies are not equivalent.

| Uninsured take-up | Induced enrollees | Group (c) cost | Total extension cost | Headline rate preserving updated target | Middle wage rate |
|---:|---:|---:|---:|---:|---:|
| 0% | 0.00M | $0.0B | $21.7B | 34.801% | 24.361% |
| 10% | 2.57M | $7.6B | $29.2B | 34.840% | 24.388% |
| 15% | 3.85M | $11.3B | $33.0B | 34.860% | 24.402% |
| 25% | 6.42M | $18.9B | $40.6B | 34.899% | 24.429% |
| 50% | 12.85M | $37.8B | $59.5B | 34.996% | 24.497% |
| 100% | 25.70M | $75.6B | $97.3B | 35.191% | 24.634% |

The rate column holds the previous candidate 2146 architecture and credit amounts fixed except for its solved headline rate. Its middle wage rate is 70% of the headline rate.

## 2026 current-law enrollment sensitivity

CBO projects that in 2026 the enhanced ACA credits have expired: 13.4 million Marketplace enrollees are subsidized, 3.5 million are unsubsidized, 3.1 million buy outside the Marketplaces, and 30.0 million people are uninsured. Reweighting the same microdata cost profiles to that mix gives approximately:

- $19.2 billion for group (a),
- $5.3 billion for group (b), and
- $13.2 billion for group (c) at 15% take-up,
- or **$37.8 billion total**.

That is a sensitivity, not a fully rebased 2026 tax model; the main Pareto experiment remains in 2025 dollars.

## Near-term fiscal target and required shift

CBO's February 2026 baseline has debt held by the public rising from 99.0% of GDP at the end of 2025 to 100.6% at the end of 2026. The updated one-year stabilization anchor is therefore 1.6% of GDP. In the 2025 model this equals $492.2 billion above tax-replacement neutrality, making the total net-revenue target $5.4509 trillion. In FY2026 dollars, the same one-year ratio correction is roughly $0.51 trillion because nominal GDP is larger.

The old search used a 1.7%-of-GDP placeholder, or $523.0 billion. Updating the target reduces the modeled requirement by $30.8 billion, almost offsetting the $33.0 billion central-case extension.

Holding candidate 2146's structure fixed:

- Previous result: 34.848% headline and 24.394% middle rate.
- Updated target plus 2025 central extension: **34.860% headline and 24.402% middle rate**.
- Updated target plus the 2026 enrollment-mix sensitivity: **34.884% headline and 24.419% middle rate**.

Thus, essentially no structural change is required to the prior candidate. At the 2025 central estimate, holding tax rates fixed instead would require reducing the $500 universal adult wage credit by about $8 per adult, or the $2,000 refundable child credit by about $31 per child. Using the 2026 enrollment sensitivity, those reductions are about $26 per adult or $97 per child.

If the old 1.7%-of-GDP target is retained rather than updated, the central extension requires a 35.018% headline rate, or—holding rates fixed—roughly a $122 reduction in the universal adult wage credit or a $458 reduction in the child credit.

## Reoptimized Pareto result

Allowing every parameter to move produces a different equal-weight frontier selection: candidate 1156 has a 37.66% headline rate, a $20,000 zero bracket, a 26.36% middle rate through $80,000 per schedule adult, an $8,000 refundable child credit, and a $3,500 adult/$0 child-specific health credit. It places 86.5% of ESI-covered people in non-losing units with a 4.7 percentage-point mean absolute MTR movement.

The zero child-specific health amount does not mean zero child assistance: the search has rolled it into the much larger general refundable child credit, as contemplated. This selection is an equal-weight Pareto preference, not a fiscal necessity; preserving candidate 2146 requires only the small rate adjustment above.

## Sources and limitations

- CBO, [Federal Subsidies for Health Insurance, 2026 to 2036](https://www.cbo.gov/publication/62539), especially Table A-2.
- CBO, [The Budget and Economic Outlook: 2026 to 2036](https://www.cbo.gov/publication/62105).
- CMS, [2025 Marketplace Open Enrollment Period Public Use Files](https://www.cms.gov/data-research/statistics-trends-reports/marketplace-products/2025-marketplace-open-enrollment-period-public-use-files), used as an administrative cross-check.
- Census, [Health Inclusive Poverty Measure extract and dictionary](https://www2.census.gov/library/working-papers/2025/demo/hipm-extract-data-dictionary.pdf).

The score is static. It does not model adverse selection, premium feedback, crowd-out of Medicaid or ESI, partial-year enrollment, insurer participation, or take-up responses by income and age. CBO enrollment counts are rounded, and HIPM's estimated APTC is not an administrative payment record. The group (b) estimate is therefore less certain than group (a), and group (c) is explicitly scenario-dependent.
