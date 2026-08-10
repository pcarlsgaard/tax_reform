# Model Audit and Validation

## Repository findings

The original repository was a notebook research prototype with one initial commit. Calculations were spread among two notebooks, `app_table.py`, `tax_reform_utils.py`, `sensitivity_matrix.py`, and many scripts that patched notebook cells through hard-coded Windows paths.

### Material inconsistencies found

| Topic | Historical versions | Iteration 1 resolution |
|---|---|---|
| Noncompliance | 5%, 7.5%, and 15% | 7.5% default, explicit user control |
| National base | $19.8T, $21.0T, $21.1T, $22.2T, and $23.4T descriptions | $22.7649T theoretical; $21.0575T after 7.5% noncompliance |
| Base labeling | Post-compliance result called “before exemptions” | Compliance and policy exemptions are separate stages |
| Revenue target | $4.3T, $4.4T, and $4.6T | Selected FY2024 CBO receipts; $4.742T default |
| Population | 258M/74M and 267M/73M | 267.0M adults / 73.1M children |
| Adult credits | Nonrefundable with 70% or 80% “absorption” | Fully refundable; population × credit |
| Reform household credit | Adult offset multiplied by `1 + rate` | Removed; direct refundable credit identity |
| Tax year | 2024 deductions/payroll with 2025 brackets | Tax year 2024 throughout |
| Payroll | Flat 7.0% employer and uncapped 7.65% employee approximations | Actual 2024 SS cap and Medicare rules |
| CTC/ACTC | Refund formula misordered; no phaseout | Nonrefundable CTC, earnings-limited ACTC, statutory phaseout |
| Marginal rate | $10 difference and inconsistent scenario arguments | $1 forward difference on one pure engine |
| Compensation | Health and pension values mixed differently across systems | Health/pension excluded from both; actual employer FICA added |
| Healthcare | Optional subsidy changed tax-reform results | Excluded from default Iteration 1 |

The old FRED helper also swallowed errors and returned zero, allowing missing series to produce plausible-looking invalid bases. The replacement fails closed.

## 2024 baseline reconciliation

```text
$15,027.1B compensation
+ 7,516.2B net capital income after investment
+   898.5B net imports
−   676.9B housing adjustment
=22,764.9B theoretical broad base

− 1,707.4B noncompliance (7.5%)
=21,057.5B base after compliance
−     0.0B default policy exemptions
=21,057.5B final taxable base = 71.9% of $29,298.0B GDP
```

## Default revenue reconciliation

```text
$21,057.5325B × 30.0% = $6,317.2598B gross collections
− $1,281.6000B adult credits
−   $350.8800B child credits
= $4,684.7798B net revenue
− $4,742.0000B selected replacement target
=   −$57.2203B static deficit
```

The solved rate is **30.27173293%**. Re-running the engine at that rate reproduces the target to less than `1e-8` billion dollars in the automated test.

## Regression examples at default settings

### Households

| Household | Cash wage | Employer compensation | Current federal tax | Reform tax | Current disposable | Reform disposable | Change |
|---|---:|---:|---:|---:|---:|---:|---:|
| Single, no children | $30,000 | $32,295 | $6,206 | $4,888.50 | $26,089 | $27,406.50 | +$1,317.50 |
| Single, no children | $75,000 | $80,737.50 | $19,816 | $19,421.25 | $60,921.50 | $61,316.25 | +$394.75 |
| Married, two children | $60,000 | $64,590 | $7,845.82 | $177 | $56,744.18 | $64,413 | +$7,668.82 |
| Married, two children | $150,000 | $161,475 | $35,632 | $29,242.50 | $125,843 | $132,232.50 | +$6,389.50 |

Current federal tax includes individual income tax net of EITC/CTC/ACTC plus both sides of payroll tax. Reform tax is wage tax net of fully refundable demographic credits. These are representative wage-only cases, not distribution estimates.

### Businesses (millions of dollars)

| Preset | Business base | Business tax | Wage-side tax before credits | Combined before credits |
|---|---:|---:|---:|---:|
| Domestic service company | $25.0M | $7.5M | $16.5M | $24.0M |
| Domestic retailer | $15.0M | $4.5M | $6.0M | $10.5M |
| Manufacturer | $10.0M | $3.0M | $21.0M | $24.0M |
| Importer-heavy retailer | $85.0M | $25.5M | $6.0M | $31.5M |
| Exporter / manufacturer | −$40.0M | −$12.0M | $21.0M | $9.0M |

## Automated validation

The test suite covers NIPA summation; compliance and exemptions; revenue and credits; target selection; the rate solution; 2024 deductions, brackets, payroll caps, Medicare, EITC, CTC and ACTC thresholds; zero through high income; marginal rates around kinks; expensing; border adjustment; domestic inputs; wages; and end-to-end regression fixtures.

## Remaining audit risks

1. The snapshot preserves archived aggregate net-capital and housing values, not every underlying observation; BEA revisions can change a rebuild.
2. A fiscal-year receipts target is paired with a calendar-year base.
3. The NIPA construction is a cash-flow approximation, not a legislative score of a fully drafted statute.
4. Credit population counts omit eligibility and administration details.
5. Household results omit nonwage income, deductions, AMT, dependent nuance, and transfers outside EITC/CTC.
6. Negative DBCFT liabilities assume symmetric treatment; actual loss rules affect neutrality and timing.
