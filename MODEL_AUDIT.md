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
| Adult credits | Nonrefundable with 70%/80% “absorption” | Refundable schedule scored on CPS tax units, plus explicit take-up |
| Reform household credit | Adult offset multiplied by `1 + rate` | Removed; direct refundable credit identity |
| Tax year | 2024 deductions/payroll with 2025 brackets | Enacted tax year 2025 throughout |
| Payroll | Flat approximations | Actual 2025 SS cap and Medicare rules, per earner |
| CTC/ACTC | Refund formula misordered; no phaseout | Nonrefundable CTC, earnings-limited ACTC, statutory phaseout |
| Marginal rate | $10 difference and inconsistent arguments | Centered $1,000 local difference on the pure engine |
| Compensation | Benefits and employer payroll costs mixed differently across systems | Core tax-wedge view uses employer compensation; Social spending uses current cash wages and adds employer FICA only as a visible 0%–100% reform-side pass-through |
| Healthcare | Optional subsidy changed reform results without an auditable coverage model | Dedicated linked-CPS ESI transition with explicit premium, wage-allocation, credit, and limitation identities |
| Progressive reform | Flat tax only | Flat or progressive X tax scored over the CPS wage distribution |
| Compensation exemptions | Compensation treated as one undifferentiated aggregate | Cash wages, employer social insurance, employer health, and pension/other insurance separately controlled; all taxable by default |
| Transfer replacement | No distinction between household value and national savings | Separate resource and federal fiscal identities |
| EITC/CTC replacement | Liability-offset amounts reduce receipts, while refundable excess payments are mandatory outlays | No external toggles; FY2025 refundable outlays are an automatic saving when individual income taxation is replaced, while receipt offsets are not counted twice |
| Program eligibility | No transfer engine | Explicit receipt; formulas only where credible; rationed programs stay manual |
| Household resource signs | Net tax could be negative and was subtracted in the display | Positive pre-credit liability is subtracted, credits are added, and selected transfer replacements are subtracted explicitly |

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

## CPS ASEC microdata reconciliation

The official 2025 ASEC person file contains 142,125 records grouped into 76,652 Census `TAX_ID` units. Reference-person survey weights produce $12,055.471B of cash wages for 2024. Raking that distribution to the 2025 BEA cash-wage control of $12,958.656B requires a **1.0749** factor, a 7.49% aggregate adjustment. Weighted adult counts require a **1.0284** factor to match the Census 2025 adult-population control. Both are moderate enough to pass explicit ETL guardrails.

BEA compensation reconciles exactly:

```text
$12,958.656B cash wages and salaries
+   908.979B employer government social insurance
+ 1,068.118B employer health insurance
+   791.157B employer pension and other insurance
=15,726.910B employee compensation
```

Employer supplements are allocated in proportion to cash wages. Under the default $30,000/$100,000 per-adult progressive schedule with a 50% middle-rate fraction, the microdata produce a **$7,527.900B** rate-equivalent compensation base, or **47.8664%** of total compensation. The proposed earned adult credit produces **$542.013B** of statutory eligibility at 100% take-up, averaging $2,009 per Census adult and 41.86% of the universal maximum-population cost.

The default live adult-credit decomposition is:

| Schedule position | Weighted tax units | Calibrated adults | Statutory cost | Average per adult |
|---|---:|---:|---:|---:|
| No credit-eligible adult | 1.094M | 0.000M | $0.000B | — |
| Zero compensation | 61.946M | 76.174M | $0.000B | $0 |
| Phase-in only | 11.744M | 17.273M | $43.003B | $2,490 |
| Full-credit plateau | 38.259M | 57.646M | $276.703B | $4,800 |
| Partial credit in phaseout | 52.458M | 79.361M | $222.308B | $2,801 |
| Credit fully phased out | 24.720M | 39.308M | $0.000B | $0 |
| **Total** | **190.221M** | **269.764M** | **$542.013B** | **$2,009** |

Thus 154.281M adults, 57.2% of the adult control, are in tax units receiving a positive credit; only 57.646M are on the full-credit plateau. The live browser table recomputes these rows rather than scaling the default estimate. It creates a separate overlap row when the selected phaseout starts before phase-in can reach the maximum, and it separates statutory eligibility from the take-up-adjusted budget amount.

The credit-income definition remains a material structural sensitivity. The active score uses $12,958.656B of cash wages plus $908.979B of employer government social insurance, $1,068.118B of employer health, and $791.157B of pension/other insurance. It excludes self-employment earnings. The interface discloses that definition and makes clear that tax-base exemptions do not alter credit eligibility.

The 160 ASEC replicate weights give sampling standard errors of **$3.095B** for the adult-credit cost and **$22.594B** for the rate-equivalent compensation base. These are under 1% of their point estimates. They do not capture model error from tax-unit construction, benefit allocation, take-up, behavioral response, or public-use top coding.

As a distributional gut check, BEA-raked tax-unit cash wages are about $36,500 at the median, $172,000 at the 90th percentile, and $489,000 at the 99th percentile. The top 10% of tax units receive 46.0% of cash wages and the top 1% receive 12.5%. These figures include zero-wage nonfiling/dependent units and joint returns, so they are not individual-worker earnings statistics; they are useful chiefly for detecting an obviously broken tax-unit or weight construction.

## Default revenue reconciliation

```text
$22,311.8686B × 30.0% = $6,693.5606B gross collections (21.76% GDP)
−   $542.0128B adult credits
−   $345.7025B child credits
= $5,805.8453B net revenue (18.87% GDP)
− $5,051.2930B selected target (16.42% GDP)
=   $754.5523B static surplus (2.45% GDP)
```

The unadjusted flat revenue-neutral rate is **26.6181573%**. The [FY2025 Treasury Combined Statement](https://fiscal.treasury.gov/system/files/files/reports-statements/combined-statement/cs2025/c40.pdf) records $66.0074466B of refundable EITC outlays (account 020-0906) and $26.5667613B of refundable child-credit outlays (account 020-0922). Replacing individual income taxation therefore removes $92.5742079B of mandatory outlays in addition to replacing receipts, producing an adjusted requirement of $4,958.7187921B and an adjusted flat rate of **26.2032471%**. The credit portion that offsets positive liability already reduces receipts and is not counted again. At the default progressive schedule, the pre-savings rate-adjusted base is $14,727.7840B; the unadjusted and adjusted revenue-neutral business/top wage rates are **40.3251994%** and **39.6966309%**.

The compensation sensitivity is now decomposed. Employer health is a $1,068.118B gross control and pension/other insurance is the $791.157B residual of BEA's combined supplement; each exclusion can be changed without moving the other. The two rows sum to the unchanged $1,859.275B BEA control, and the default keeps both fully taxable.

## Transfer-replacement fiscal reconciliation

No external program is selected by default, so external selections do not change the household analysis. The automatic refundable-credit outlay savings still follow the individual-income-tax replacement switch. The audit uses one neutral illustrative external bundle—SNAP, WIC, school meals, Summer EBT, TANF, and LIHEAP, excluding rationed housing assistance:

```text
$106.336B SNAP actual net outlays
+   7.960B WIC actual net outlays
+  24.281B NSLP/SBP actual obligations
+   3.100B Summer EBT benefit obligations
+  17.714B federal TANF account net outlays
+   4.377B LIHEAP actual net outlays
= $163.768B illustrative federal fiscal savings

$5,051.293B original tax-replacement target
−   92.574B automatic refundable-credit outlay savings
−  163.768B selected external federal program savings
= $4,794.951B adjusted revenue requirement
```

At the default flat settings, automatic refundable-credit savings reduce the rate from **26.6182% to 26.2032%**. Adding the illustrative external bundle reduces it further to **25.4693%**, a total **1.1489 percentage-point** reduction. Adding tenant-based rental assistance would add $38.320B of modeled federal savings, but it is excluded from this illustrative bundle because household receipt is rationed and a national repeal has distributional issues that this illustration cannot resolve.

Fiscal amounts do not derive from household benefits or recipient averages. Conversely, household values do not derive from dividing fiscal amounts by caseloads. School meals and Summer EBT are actual obligations rather than outlays; the UI labels the measure. State TANF maintenance-of-effort and other nonfederal financing are excluded from federal savings.

## Employer-health microdata reconciliation

The official 2025 CPS ASEC and Census HIPM files link on `H_SEQ` and `PPPOS` for all 142,125 sample people. The browser snapshot retains 35,639 rounded analytical cells representing 90.9M tax units and 165.4M nonelderly ESI-covered people. It does not retain respondent or household identifiers.

ASEC reveals employee-paid premium variation and whether an employer paid all, some, or none, but no dollar employer contribution. The employer side is therefore imputed from MEPS-IC plan-tier, firm-size, and sector means and raked to projected 2025 BEA group-health compensation. The resulting transition pools reconcile as follows:

```text
$  978.0B employer ESI contributions (76.6% of combined premium resources)
+   298.8B employee ESI contributions (23.4%)
= 1,276.8B current combined premium resources

$1,038.7B linked 2024 HIPM SLCSP benchmarks
×    1.03  default 2025 premium factor
= 1,069.8B replacement benchmark premiums
```

The default national equal-policyholder-worker rule allocates $977.8B after browser-cell rounding versus a $978.0B employer pool. It covers 81.4M wage-positive ESI policyholder workers, about $12,022 each. The policyholder's cash counts in the entire tax unit's resources. The broader all-covered-worker sensitivity covers 109.9M workers at about $8,909 each and gives a separate allocation to wage-earning spouses or other workers with dependent ESI; that additional within-unit allocation, not a failure to share the policyholder wage, explains its different result.

The active browser defaults to the balanced search mix of $3,250 per adult and $750 per child. It reports the ESI cost separately from the nongroup no-APTC floor, APTC top-ups, and the take-up-adjusted uninsured cost, then sends their sum into the National and Designer revenue identities. A live centered-$1,000 MTR score and policy marker can be compared with the 119-point checked-in Pareto frontier; the chart warns that the reference search includes policy architectures not exposed by the current sliders.

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

### Transfer-resource examples

The following uses the default reform, 100% employer-FICA pass-through, a 75% resource factor for in-kind benefits, the visible preset receipt/manual amounts, and the illustrative six-program bundle above. Amounts are annual.

| Preset | Current law + transfers | Reform + transfers retained | Reform after selected repeal | Change C vs A | Held harmless? |
|---|---:|---:|---:|---:|---|
| Single adult, $20,000 earnings | $18,495 | $20,321 | $19,871 | +$1,376 | Yes |
| Single parent, two children, $25,000 earnings | $45,534 | $45,506 | $33,239 | −$12,295 | No |
| Married, two children, one $35,000 earner | $50,467 | $54,121 | $45,574 | −$4,893 | No |
| Married, two children, $30,000 + $25,000 earners | $55,772 | $61,589 | $60,645 | +$4,873 | Yes |

The selected household benefits removed are respectively $450; $12,267; $8,547; and $943.50. The single-parent preset loses even with transfers retained (−$28) and loses substantially when its modeled SNAP, WIC, school food, Summer EBT, TANF, and LIHEAP are removed. This is intentionally not optimized to produce favorable results.

The largest displayed marginal interactions occur at rule thresholds, not manual benefits. In the presets, the centered-$1,000 current-law resource-withdrawal measure can exceed 400% around the simplified SNAP gross-income cutoff because a full annual benefit disappears inside the window. The one-parent example reaches roughly 501% around $33,250; the one-earner married example roughly 469% around $40,250. The two-earner case has a roughly 133% interaction near $34,250 of primary earnings as school-food/Summer eligibility and the tax system change within the window. These are transparent discontinuity diagnostics, not claims about smooth statutory marginal rates. Manual WIC/TANF/LIHEAP/housing benefits are held fixed and contribute no invented phaseout.

## Automated validation

The test suite preserves all prior checks and adds microdata snapshot reconciliation, independent compensation-exemption controls, statutory-versus-take-up adult-credit scoring, household exemption consistency, employer-health pool allocation, premium-credit caps, pass-through sensitivity, credit monotonicity, premium shares, and financing-rate accounting. It also covers no-selection macro/household regressions; explicit `gross resources − pre-credit liability + credits` identities; employer-FICA resource treatment; pass-through sensitivities; fiscal savings; program receipt gating and thresholds; FPL sizes; and rule-based versus fixed-manual marginal behavior.

Validation commands:

```text
npm run typecheck  → passed
npm test           → 62 passed
npm run build      → passed
python3 scripts/build_baseline.py --verify-only
                   → $30.7621T GDP; $22.3119T default base (72.5% GDP)
npm run microdata:verify
                   → 76,652 tax units; $542.0B adult credit; 47.87% progressive factor;
                     35,639 health cells; 165.4M ESI lives; $978.0B employer pool
```

## Remaining audit risks

1. One annual housing series is estimated; the snapshot must be rebuilt after BEA publishes 2025.
2. A fiscal-year receipts target is paired with a calendar-year base.
3. The NIPA construction is a cash-flow approximation, not a legislative score.
4. The CPS public-use wage distribution has top coding and no administrative-data top-tail match; BEA controls correct the aggregate, not the shape.
5. Employer social-insurance, health, and pension/other-insurance supplements are allocated in proportion to cash wages in the national CPS score because CPS does not identify them completely at the tax-unit level. This likely overstates supplements for some workers and understates them for others.
6. The 2025 CPS ASEC reports 2024 income. Raking to 2025 BEA totals does not capture every distributional change between years.
7. Adult-credit take-up defaults to 100%; the control is a sensitivity rather than an estimated participation model.
8. The federal-only Taxing Wages table is not the official OECD wedge and excludes state/local tax.
9. Household results omit nonwage income, employer pension/insurance benefits, itemization, AMT, dependent nuance, most transfers, and special 2025 deductions.
10. Negative DBCFT liabilities assume symmetric treatment; actual loss rules affect neutrality and timing.
11. SNAP omits categorical eligibility, asset/work/immigration and several deduction rules; it is a threshold illustration, not an eligibility determination.
12. WIC, TANF, LIHEAP, and housing household amounts are explicit user/preset assumptions; state and local variation is not simulated.
13. School meal household values use reimbursement rates and assumed meal days, not observed meal consumption; the in-kind factor is a sensitivity, not welfare evidence.
14. Full federal account repeal may not generate immediate cash savings equal to one year's outlays because administration, contracts, and transition timing are not modeled.
15. The health transition does not compare actuarial value, deductibles, cost sharing, provider networks, employer versus individual risk pools, adverse selection, or individual-market capacity; equal nominal premiums are not equal welfare.
16. ASEC has no employer identifier. Sector/firm-size allocation is only a proxy for equal redistribution within actual employers.
17. Public-sector 2025 MEPS-IC costs are unavailable and use 2024 public means grown by the same-tier private-sector change. BEA's group-health detail also ends in 2024 and is projected with total employer pension/insurance growth.
18. Nongroup APTC enters as an observed baseline floor comparison, not a re-estimated ACA subsidy schedule under the reform.
19. Retirement, disability, SSI, and detailed benefit interactions remain deliberately outside the working-age resource model.
