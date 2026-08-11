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

At the flat defaults, gross collections are $6,693.561B, adult credits cost $971.149B, child credits cost $345.702B, net revenue is $5,376.709B, and the surplus is $325.416B. The revenue-neutral rate is **28.5415%**.

## 6. Household model

### Input and resource convention

The user enters primary and, for joint filers, secondary annual cash wages. Current employer compensation equals cash wages plus actual employer Social Security and Medicare contributions calculated per worker. Employer health and pension benefits are excluded from both systems.

If payroll taxes are replaced, the model assumes repealed employer contributions convert dollar-for-dollar to reform wage compensation. If retained, that conversion does not occur and employee/employer payroll liabilities remain in the reform column.

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

```text
reform tax after credits
= wage tax − adult credit − child credit + retained current-law taxes
```

Average rates use employer compensation as the denominator. Local marginal rates use a centered $1,000 earnings difference in total federal tax divided by the corresponding change in employer compensation. The window makes the CTC's statutory $50-per-$1,000 steps appear as the intended 5% phaseout wedge instead of a one-dollar discontinuity spike.

The Taxing Wages table evaluates the OECD's eight standard family patterns at 67%, 100%, and 167% of the editable average wage. It is federal-only and therefore not the official OECD wedge.

## 7. Business model

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

## 8. Incidence assumptions

The statutory mechanism is not an incidence estimate. The household comparison assumes full conversion of repealed employer payroll taxes to compensation and no other wage, price, profit, or exchange-rate adjustment. The national model does not allocate the business tax to workers, owners, or consumers.

## 9. Data versioning

`src/data/baseline_2025.json` is the active browser snapshot. `data/fred_series.json` centralizes series identifiers. `scripts/build_baseline.py` rebuilds the snapshot and fails on missing data unless the specific provisional housing flag is supplied. `src/data/current_law_2025.json` is the sole active source of household tax parameters. The deployed app makes no live data requests.

## 10. Deferred work

Dynamic scoring, capital and GDP effects, transition rules, existing-asset effects, household consumption microsimulation, income-decile distribution, Tax-Calculator, OG-USA, state/local taxes, healthcare reform, detailed exemptions, and business-loss administration are outside Iteration 1.
