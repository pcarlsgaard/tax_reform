# Model Audit and Validation

## Repository findings

The original repository was a notebook research prototype. Calculations were spread among two notebooks, `app_table.py`, `tax_reform_utils.py`, `sensitivity_matrix.py`, and scripts that patched notebook cells through hard-coded Windows paths.

### Material inconsistencies found

| Topic | Historical versions | Active resolution |
|---|---|---|
| Noncompliance | 5%, 7.5%, and 15% | 7.5% default, explicit control |
| National base | $19.8T through $23.4T | Auditable NIPA build with separate compliance/exemption stages |
| Base labeling | Post-compliance result called “before exemptions” | Compliance status shown at every stage |
| Revenue target | $4.3T, $4.4T, and $4.6T | Selected FY2025 Treasury receipts; $5.051293T default |
| Population | 258M/74M and 267M/73M | Census Vintage 2025: 269.764M adults / 72.021M children |
| Adult credits | Nonrefundable with 70%/80% “absorption” | Refundable schedule plus explicit aggregate budget factor |
| Reform household credit | Adult offset multiplied by `1 + rate` | Removed; direct refundable credit identity |
| Tax year | 2024 deductions/payroll with 2025 brackets | Enacted tax year 2025 throughout |
| Payroll | Flat approximations | Actual 2025 SS cap and Medicare rules, per earner |
| CTC/ACTC | Refund formula misordered; no phaseout | Nonrefundable CTC, earnings-limited ACTC, statutory phaseout |
| Marginal rate | $10 difference and inconsistent arguments | Centered $1,000 local difference on the pure engine |
| Compensation | Benefits mixed differently across systems | Benefits excluded from both; actual employer FICA added |
| Healthcare | Optional subsidy changed reform results | Excluded from Iteration 1 |
| Progressive reform | Flat tax only | Flat or progressive X tax with explicit macro calibration |

The old FRED helper swallowed errors and returned zero. The replacement fails closed, accepts FRED's current `observation_date` CSV header, and permits the one 2025 housing estimate only with an explicit flag.

## Provisional 2025 baseline reconciliation

```text
$15,726.910B compensation
+ 8,208.031B net capital income after investment
+   926.487B net imports
−   740.489B housing adjustment
=24,120.939B theoretical broad base

− 1,809.070B noncompliance (7.5%)
=22,311.869B base after compliance
−     0.000B default policy exemptions
=22,311.869B final taxable base = 72.5% of $30,762.099B GDP
```

Housing-sector value added is the only estimated input: `$1,954.169B × ($30,762.099B / $29,298.013B)`. All other 2025 series are observed in the checked-in build.

## Default revenue reconciliation

```text
$22,311.8686B × 30.0% = $6,693.5606B gross collections (21.76% GDP)
−   $971.1486B adult credits
−   $345.7025B child credits
= $5,376.7095B net revenue (17.48% GDP)
− $5,051.2930B selected target (16.42% GDP)
=   $325.4165B static surplus (1.06% GDP)
```

The flat revenue-neutral rate is **28.54150956%**. Re-running the engine at that rate reproduces the target within `1e-8` billion dollars. At the default progressive calibration, the rate-adjusted base is $17,220.2815B and the revenue-neutral business/top wage rate is **36.9804879%**.

## Regression examples at default settings

### Households

| Household | Cash wages | Employer compensation | Current federal tax | Reform tax | Change in disposable resources |
|---|---:|---:|---:|---:|---:|
| Single, no children | $30,000 | $32,295 | $6,061.50 | $4,888.50 | +$1,173.00 |
| Single, no children | $75,000 | $80,737.50 | $19,424.00 | $21,726.56 | −$2,302.56 |
| Married, two children | $60,000 | $64,590 | $6,790.02 | $177.00 | +$6,613.02 |
| Married, two children | $150,000 | $161,475 | $34,448.00 | $33,853.13 | +$594.88 |

Current federal tax includes individual income tax net of EITC/CTC/ACTC plus both sides of payroll tax. Reform tax is wage tax net of the earned adult credit and flat refundable child credit. These are wage-only illustrations, not distribution estimates.

### Businesses (millions of dollars)

| Preset | Business base | Business tax | Wage-side tax before credits | Combined before credits |
|---|---:|---:|---:|---:|
| Domestic service company | $25.0M | $7.5M | $16.5M | $24.0M |
| Domestic retailer | $15.0M | $4.5M | $6.0M | $10.5M |
| Manufacturer | $10.0M | $3.0M | $21.0M | $24.0M |
| Importer-heavy retailer | $85.0M | $25.5M | $6.0M | $31.5M |
| Exporter / manufacturer | −$40.0M | −$12.0M | $21.0M | $9.0M |

## Automated validation

The 26-test suite covers NIPA summation; compliance and exemptions; GDP ratios; flat and progressive revenue identities; credit costs; target selection; algebraic rate solutions; 2025 deductions, brackets, payroll caps, Medicare, EITC, CTC and ACTC thresholds; two-earner payroll; earned and universal adult credits; zero through high income; bounded local marginal rates around kinks; the eight Taxing Wages patterns; expensing; border adjustment; domestic inputs; wages; and end-to-end fixtures.

Validation commands:

```text
npm run typecheck  → passed
npm test           → 26 passed
npm run build      → passed
python3 scripts/build_baseline.py --verify-only
                   → $30.7621T GDP; $22.3119T default base (72.5% GDP)
```

## Remaining audit risks

1. One annual housing series is estimated; the snapshot must be rebuilt after BEA publishes 2025.
2. A fiscal-year receipts target is paired with a calendar-year base.
3. The NIPA construction is a cash-flow approximation, not a legislative score.
4. Aggregate earned-credit cost and progressive wage revenue use visible calibration factors rather than microdata.
5. The federal-only Taxing Wages table is not the official OECD wedge and excludes state/local tax.
6. Household results omit nonwage income, itemization, AMT, dependent nuance, most transfers, and special 2025 deductions.
7. Negative DBCFT liabilities assume symmetric treatment; actual loss rules affect neutrality and timing.
