# Model Specification — Iteration 1

This file is authoritative for the active simulator. Historical notebooks, old Python apps, and patch scripts are research provenance, not active assumptions.

## 1. Purpose and scope

Iteration 1 is a static accounting model of a broad U.S. destination-based consumption tax. It answers what is taxed, how the national base is constructed, what a rate raises, how credits affect revenue and household marginal rates, what rate balances a selected target, and how stylized households and businesses are treated.

It does **not** estimate behavior, growth, capital accumulation, transition incidence, price-level changes, existing-asset windfalls, evasion responses, or general-equilibrium effects.

## 2. Canonical computational representation

The canonical representation is an X tax / destination-based cash-flow tax (DBCFT):

1. Businesses pay a flat tax on destination-based cash flow after deducting domestic inputs, wages, and new investment.
2. Imported inputs are not deductible and export receipts are excluded.
3. Households pay either a flat or progressive tax-exclusive schedule on reform wage compensation.
4. Adults receive either an EITC-like refundable credit or a universal refundable credit; children receive a flat fully refundable credit.

This representation exposes the wage and business mechanics needed by the calculators. An invoice-credit VAT can target a closely related economic consumption base, but it is a legally different collection system. VAT intuition explains the aggregate base; the simulator does not claim that the statutes are interchangeable.

All displayed rates are **tax-exclusive**: liability equals rate × base. The corresponding tax-inclusive retail-price share is `rate / (1 + rate)`.

## 3. Economic base and collection

The saved NIPA cash-flow construction is:

```text
theoretical broad base
= compensation of employees
+ corporate profits
+ proprietors' income
+ net interest and miscellaneous payments
+ consumption of fixed capital
+ taxes on production and imports less subsidies
− gross private domestic investment
+ imports − exports
+ household investment − housing-sector value added
```

The active model applies two distinct reductions:

```text
base after compliance = theoretical base × (1 − noncompliance rate)
final taxable base = base after compliance × (1 − policy exemption share)
```

The exemption control is an aggregate policy reduction, not a claim that a named sector is exempt. The final base is split into wage and business components in proportion to the theoretical construction so progressive household wage rates can be scored without changing the flat business rate.

## 4. National revenue identity

All national values are in billions of dollars.

For a flat X tax:

```text
rate-adjusted base = final taxable base
```

For a progressive X tax:

```text
rate-adjusted base
= compliant taxable business base
+ compliant taxable wage base × average-wage-rate factor
```

The average-wage-rate factor is the population-average wage rate divided by the headline business/top wage rate. It is an explicit calibration, not a microsimulation result.

```text
gross revenue = rate-adjusted base × headline rate
adult credit cost = adult population × maximum adult credit × budget factor
child credit cost = child population × flat child credit
net revenue = gross revenue − adult credits − child credits − other rebates
surplus / deficit = net revenue − selected replacement-revenue target
```

The adult budget factor is 100% for a universal credit and editable for the earned-credit schedule. It bridges the household schedule to the aggregate score until microdata are added.

The algebraic revenue-neutral headline rate is:

```text
required rate
= (target + adult credits + child credits + other rebates)
  / rate-adjusted base
```

Refundable current-law tax credits require a budget-classification adjustment. The portion that offsets positive income-tax liability already lowers the individual-income-tax receipts target. The refundable excess is recorded as a mandatory outlay and disappears when the individual income tax is replaced:

```text
automatic refundable-credit outlay savings
= FY2025 refundable EITC outlays
 + FY2025 refundable child-credit outlays
```

External transfer repeal is a separate fiscal adjustment, not a rebate and not a second tax engine:

```text
adjusted required federal revenue
= tax-replacement revenue target
− automatic refundable-credit outlay savings, if individual income tax is replaced
− FY2025 federal fiscal amounts for selected external programs

adjusted required rate
= (adjusted target + adult credits + child credits + other rebates)
  / rate-adjusted base
```

Only federal amounts enter this subtraction. State maintenance-of-effort, local contributions, and household resource values do not. With no external program selected, the external adjustment is zero; the automatic refundable-credit adjustment still applies when individual income taxation is replaced.

## 5. Provisional default 2025 baseline

| Item | Authoritative value |
|---|---:|
| GDP | $30,762.099B |
| Theoretical broad base | $24,120.939B |
| Noncompliance | 7.5% |
| Base after compliance | $22,311.869B |
| Policy exemptions | 0% |
| Final taxable base | $22,311.869B (72.5% of GDP) |
| Adults | 269.764M |
| Children | 72.021M |
| Maximum adult credit | $4,800 |
| Adult earned-credit budget factor | 75% |
| Flat refundable child credit | $4,800 |
| Statutory flat rate | 30.0% |

Eleven of twelve inputs are observed for 2025. Housing-sector value added is provisional because FRED series `B952RC1A027NBEA` ends in 2024; the snapshot scales its 2024 value by 2024–25 nominal GDP growth. The builder requires an explicit opt-in for that estimate.

The default target replaces FY2025 individual income tax ($2,656.044B), social-insurance/payroll receipts ($1,748.294B), corporate income tax ($452.089B), and customs duties ($194.866B): **$5,051.293B**, or **16.42% of GDP**. The target is fiscal-year cash receipts while the base is a calendar-year economic measure.

At the flat defaults, gross collections are $6,693.561B, adult credits cost $971.149B, child credits cost $345.702B, and net revenue is $5,376.709B. Against the unadjusted receipts target the surplus is $325.416B and the revenue-neutral rate is **28.5415%**. FY2025 actual refundable EITC outlays of $66.007B and refundable child-credit outlays of $26.567B reduce the operative requirement to $4,958.719B and the adjusted revenue-neutral rate to **28.1266%**. These Treasury outlays were recorded during FY2025 and primarily reflect tax year 2024 returns, another explicit timing mismatch.

The refundable amounts and account identifiers are versioned in `src/data/refundable_tax_credit_outlays_2025.json` from the Treasury Bureau of the Fiscal Service's FY2025 Combined Statement, Department of the Treasury accounts 020-0906 and 020-0922.

## 6. Household model

### Input and resource convention

The user enters primary and, for joint filers, secondary annual cash wages. Current employer compensation equals cash wages plus actual employer Social Security and Medicare contributions calculated per worker. Employer health and pension benefits are excluded from both systems.

If payroll taxes are replaced, the core household comparator defaults to assuming that repealed employer contributions convert dollar-for-dollar to reform wage compensation. The Social spending view exposes this incidence assumption as an employer-FICA pass-through rate from 0% to 100%, defaulting to 100%:

```text
passed-through employer FICA
= pass-through rate × current employer Social Security and Medicare

reform gross household resources
= cash wages + passed-through employer FICA
```

The same reform wage measure enters the wage tax and earned adult-credit schedule. The non-passed-through share is not silently assigned elsewhere: it remains outside the illustrated household's resources because this static model does not allocate it among profits, prices, or other workers. If payroll taxes are retained, the control is inapplicable, conversion does not occur, and employee/employer payroll liabilities remain in the reform column.

### Current law

The engine consistently uses enacted tax year 2025 parameters:

- single and married-filing-jointly ordinary brackets;
- $15,750 / $31,500 standard deductions;
- employee and employer Social Security at 6.2% through $176,100 per worker;
- employee and employer Medicare at 1.45% with no cap;
- employee-only Additional Medicare Tax at 0.9% above $200,000 single / $250,000 joint;
- wage-only EITC for zero through three-or-more children;
- $2,200 CTC, statutory phaseout, and ACTC limited to $1,700 per child and 15% of earnings above $2,500.

The model assumes every entered child qualifies. It omits itemized deductions, nonwage income, filing nuances, benefits other than EITC/CTC, and the 2025 special deductions for tips, overtime, car-loan interest, and seniors.

### Reform wage tax

Flat mode applies the headline rate to reform wage compensation. Progressive mode applies a zero rate through an editable per-adult threshold, an editable fraction of the headline rate through a second per-adult threshold, and the headline rate above it. Brackets are tax-exclusive and filing thresholds scale with the number of adults.

### Adult and child credits

The earned adult credit is refundable and computed at the household level:

```text
maximum = adults × maximum credit per adult
phase-in credit = min(maximum, reform wage compensation × phase-in rate)
phaseout threshold = adults × threshold per adult
earned adult credit
= max(0, phase-in credit
         − max(0, reform wages − phaseout threshold) × phaseout rate)
```

Universal mode pays the maximum regardless of earnings. The child credit is always `children × child credit` and fully refundable.

The engine does not rely on subtracting a negative net-tax value when it constructs household resources. It separates liabilities and credits:

```text
reform pre-credit tax liability
= reform wage tax + retained current-law tax before credits

reform total household credits
= refundable adult credit + refundable child credit
 + retained current-law tax credits, if individual income tax is retained

reform disposable resources
= reform gross household resources
 − reform pre-credit tax liability
 + reform total household credits
```

`reform tax after credits` remains available as the signed net fiscal position—positive means tax and negative means refund—but it is not used as an opaque subtraction in the resource identity.

Average rates use employer compensation as the denominator. Local marginal rates use a centered $1,000 earnings difference in total federal tax divided by the corresponding change in employer compensation. The window makes the CTC's statutory $50-per-$1,000 steps appear as the intended 5% phaseout wedge instead of a one-dollar discontinuity spike.

The Taxing Wages table evaluates the OECD's eight standard family patterns at 67%, 100%, and 167% of the editable average wage. It reports both tax wedges and after-tax income, defined consistently as employer compensation minus modeled federal tax including refundable credits. It is federal-only and therefore not the official OECD wedge.

## 7. Transfer-replacement model

### Separate household and federal identities

`calculateTransferAnalysis()` calls the existing `calculateHousehold()` engine; it never recreates federal income, payroll, or reform tax. For a selected representative working-age household:

```text
A. current resource-equivalent consumption capacity
   = current cash wages
   − current income tax before credits
   − employee-side payroll tax
   + current federal tax credits
   + current external transfer value

B. reform with transfers retained
   = cash wages + employer-FICA pass-through
   − reform pre-credit federal tax liability
   + reform household credits
   + current external transfer value

C. reform with selected replacements
   = cash wages + employer-FICA pass-through
   − reform pre-credit federal tax liability
   + reform household credits
   + current external transfer value
   − household value of selected benefit replacements
```

Employer FICA is not current household cash in this transfer comparison and is not subtracted as a current household tax. Only the selected share of repealed employer FICA is added to reform resources. If payroll taxes are retained, employer FICA is neither passed through nor included in either household cash-resource liability. This presentation differs deliberately from the core economic tax-wedge view, which includes both sides of payroll tax against employer compensation.

This is a budget/resource measure, not a welfare-equivalent valuation. The configurable in-kind factor defaults to 75%; cash and near-cash benefits enter dollar-for-dollar. Reform disposable resources incorporate the visible employer-FICA pass-through assumption described above. No scenario divides resources by `1 + tax rate`, and no DBCFT price-pass-through assumption is introduced.

EITC and CTC/ACTC are components of the current household tax-credit row; reform adult and child credits are components of the reform rows. The decomposition displays them once as additions after pre-credit tax liability. EITC/CTC remain deliberately absent from the external-program selector. In national fiscal accounting, only their refundable excess recorded by Treasury as an outlay is an additional automatic saving; the liability-offset portion already lowers individual-income-tax receipts and is never counted again.

### Household characteristics and receipt

The transfer-specific interface adds preschool and school-age children, monthly shelter and dependent-care costs, explicit receipt flags, manual annual benefits, the in-kind valuation factor, and the employer-FICA pass-through rate. It does not alter `HouseholdInput`; the shared tax engine accepts the pass-through as an optional sensitivity argument and retains a 100% default for every existing two-argument call.

Eligibility and receipt are distinct. Every program requires the current-receipt switch before it contributes resources, including formula-based SNAP. Rationed/manual programs never pay merely because income is low. Preset households contain visible illustrative receipt and benefit assumptions that the user can edit.

### Program methods and 2025 rules

| Program | Household method | Fiscal amount used when selected |
|---|---|---:|
| SNAP | Simplified FY2025 48-state gross/net tests, earned-income/standard/dependent-care/shelter deductions, and maximum allotment less 30% of net income | $106.336B FY2025 actual net outlays, full account |
| WIC | Explicit receipt and user-entered annual package value | $7.960B FY2025 actual net outlays |
| School meals | School-age children × 180 days × SY2024-25 free/reduced federal breakfast/lunch reimbursement; then in-kind factor | $24.281B FY2025 actual NSLP/SBP obligations |
| Summer EBT | $120 per school-age child in 2025, income screen at 185% FPL, explicit receipt/participating jurisdiction | $3.100B FY2025 actual benefit obligations |
| TANF | Explicit receipt and user-entered annual cash amount; no national state-rule fiction | $17.714B FY2025 actual federal-account net outlays |
| LIHEAP | Explicit receipt and annual benefit; then in-kind factor | $4.377B FY2025 actual net outlays |
| Tenant-based housing | Explicit rationed receipt and annual subsidy; then in-kind factor | $38.320B FY2025 actual net outlays |

Fiscal figures come from the FY2027 OMB Budget Appendix, which reports FY2025 actuals. School meals and Summer EBT use obligations because that is the available program-specific split; all other rows use actual net outlays. Full-account amounts can include administration and related activities beyond the benefit represented by one household. Static “savings” assumes the selected federal account/component is fully removed; it does not model contract runout or transition timing.

SNAP rules use FY2025 (October 2024–September 2025), school meals use school year 2024-25, Summer EBT uses calendar 2025, WIC's cited income guideline begins July 2025, and fiscal amounts use FY2025. Those timing mismatches are explicit in `src/data/transfers_2025.json` and every program audit.

### FPL and analytical measures

The model uses the 2025 HHS guideline for the contiguous states and DC: $15,650 for one person, $21,150 for two, then $5,500 per additional person. Alaska and Hawaii are not modeled.

```text
household replacement ratio
= (reform disposable resources − current disposable resources)
  / household resource value of selected eliminated benefits

effective marginal resource withdrawal rate
= 1 − (change in resource-equivalent capacity
       / change in employer compensation)
```

The marginal measure uses the same centered $1,000 window as the tax engine. Rule-calculated SNAP, school-meal, and Summer EBT transitions can appear. Fixed manual benefits have no fabricated phaseout.

### Exclusions

Medicaid, Medicare, ACA premium/cost-sharing subsidies, employer-sponsored health-insurance exclusions, and other major health subsidies are excluded because their heterogeneous actuarial value cannot be represented as ordinary consumption resources. Social Security retirement and SSDI are excluded. SSI is deferred because age/disability circumstances are absent from the working-age tax model. These exclusions prevent a precise-looking but conceptually invalid comparison.

## 8. Business model

Inputs are total sales including exports, domestic purchased inputs, imported inputs, wages, new investment, and exports.

```text
operating cash flow
= total sales − domestic inputs − imports − wages − new investment

DBCFT business base
= operating cash flow + imports − exports

business tax = DBCFT business base × headline rate
wage-side tax before household credits = wages × applicable household schedule
```

New investment is fully expensed. Imports are added back because they are not deductible. Exports are removed from the destination base. A negative business liability is displayed as refundable; loss administration is deferred.

## 9. Incidence assumptions

The statutory mechanism is not an incidence estimate. The household comparison defaults to full conversion of repealed employer payroll taxes to compensation, while the Social spending view permits a 0%–100% sensitivity. It assumes no other wage, price, profit, or exchange-rate adjustment. The national model does not allocate the business tax to workers, owners, or consumers.

## 10. Data versioning

`src/data/baseline_2025.json` is the active browser snapshot. `data/fred_series.json` centralizes series identifiers. `scripts/build_baseline.py` rebuilds the snapshot and fails on missing data unless the specific provisional housing flag is supplied. `src/data/current_law_2025.json` is the sole active source of household tax parameters. `src/data/transfers_2025.json` versions transfer rules, fiscal measures, methods, source links, and limitations. The deployed app makes no live data requests.

## 11. Deferred work

Dynamic scoring, capital and GDP effects, transition rules, existing-asset effects, household consumption microsimulation, income-decile distribution, Tax-Calculator, OG-USA, state/local taxes, healthcare reform, detailed transfer take-up/state rules, benefit-unit nuance, health and retirement transfers, detailed exemptions, and business-loss administration are outside Iteration 1.
