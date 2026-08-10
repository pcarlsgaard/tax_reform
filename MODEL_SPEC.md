# Model Specification — Iteration 1

This file is authoritative for the active simulator. Historical notebooks and patch scripts are research provenance, not sources of active assumptions.

## 1. Purpose and scope

Iteration 1 is a static accounting model of a broad U.S. destination-based consumption tax. It answers what is taxed, how the national base is constructed, what a rate raises, what universal credits cost, what rate balances a selected revenue target, and how stylized households and businesses are treated.

It does **not** estimate behavior, growth, capital accumulation, transition incidence, price-level changes, existing-asset windfalls, tax evasion responses, or general-equilibrium effects.

## 2. Canonical computational representation

The canonical representation is a flat-rate X tax / destination-based cash-flow tax (DBCFT):

1. Businesses pay a flat tax on destination-based cash flow after deducting domestic inputs, wages, and new investment.
2. Imported inputs are not deductible and export receipts are excluded.
3. Households pay the same tax-exclusive statutory rate on wage compensation.
4. Every adult and child receives the selected fully refundable fixed-dollar credit.

This representation was selected because it exposes the wage and business mechanics needed for the household and business calculators. An invoice-credit VAT can target a closely related economic consumption base, but it is a legally different collection system. The simulator uses VAT intuition only to explain the aggregate base; it does not claim the statutes are interchangeable.

### Rate convention

All displayed rates are **tax-exclusive**: liability equals rate × tax base. A tax-inclusive retail-price share would be `rate / (1 + rate)`, subject to the caveat that a real VAT statute can define its base and displayed rate differently.

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

The active model then applies two distinct reductions:

```text
base after compliance = theoretical base × (1 − noncompliance rate)
final taxable base = base after compliance × (1 − policy exemption share)
```

The exemption slider is an aggregate policy reduction, not a claim that any named sector is exempt. Explicit sector-by-sector exemptions are reserved for a later iteration.

## 4. National revenue identity

All national values are in billions of dollars.

```text
gross revenue = final taxable base × statutory rate
adult credit cost = adult population × adult credit
child credit cost = child population × child credit
net revenue = gross revenue − adult credits − child credits − other rebates
surplus / deficit = net revenue − selected replacement-revenue target
```

With fixed credits, the algebraic revenue-neutral rate is:

```text
required rate
= (target revenue + adult credit cost + child credit cost + other rebates)
  / final taxable base
```

Credits are fully refundable. The old 70%/80% adult “absorption” assumptions are not used.

## 5. Default 2024 baseline

| Item | Authoritative value |
|---|---:|
| GDP | $29,298.0B |
| Theoretical broad base | $22,764.9B |
| Noncompliance | 7.5% |
| Base after compliance | $21,057.5B |
| Policy exemptions | 0% |
| Final taxable base | $21,057.5B (71.9% of GDP) |
| Adults | 267.0M |
| Children | 73.1M |
| Adult credit | $4,800 |
| Child credit | $4,800 |
| Statutory rate | 30.0% |

The default target replaces FY2024 individual income tax ($2,426B), payroll taxes ($1,709B), corporate income tax ($530B), and customs duties ($77B): **$4,742B** total. The target uses fiscal-year receipts while the base is a calendar-year economic measure; that timing mismatch is explicit.

At the defaults, gross collections are $6,317.3B, credits cost $1,632.5B, net revenue is $4,684.8B, the static deficit is $57.2B, and the algebraic revenue-neutral rate is **30.27%**.

## 6. Household model

### Input and resource convention

The user enters annual cash wages. Current employer compensation equals cash wages plus the actual 2024 employer Social Security and Medicare contributions. Employer health and pension benefits are excluded from both systems rather than inconsistently estimated.

If payroll taxes are replaced, the model assumes the repealed employer contribution is converted dollar-for-dollar to wage compensation. If payroll taxes are retained, that conversion does not occur and employee/employer payroll liabilities remain in the reform column.

### Current law

The current-law engine uses tax year 2024 throughout:

- single and married-filing-jointly ordinary brackets;
- $14,600 / $29,200 standard deductions;
- employee and employer Social Security at 6.2% through $168,600;
- employee and employer Medicare at 1.45% with no cap;
- employee-only Additional Medicare Tax at 0.9% above $200,000 single / $250,000 joint;
- wage-only EITC for zero through three-or-more children;
- $2,000 CTC, statutory income phaseout, and ACTC limited to $1,700 per child and 15% of earnings above $2,500.

The model assumes every entered child qualifies and has the required Social Security number. It omits itemized deductions, nonwage income, filing nuances, and benefit programs other than EITC/CTC.

### Reform

```text
reform wage tax before credits = reform wage base × rate
reform tax after credits
= wage tax − adult credits − child credits + any retained current-law taxes
```

Negative tax is paid as a refund. There is no credit phaseout in Iteration 1. Average rates use employer compensation as the denominator. Marginal rates use a one-dollar forward difference in total federal tax divided by the corresponding change in employer compensation.

## 7. Business model

Inputs are total sales (including exports), domestic purchased inputs, imported inputs, wages, new investment, and exports.

```text
operating cash flow
= total sales − domestic inputs − imports − wages − new investment

DBCFT business base
= operating cash flow + imports − exports

business tax = DBCFT business base × rate
wage-side tax before household credits = wages × rate
```

New investment is fully expensed. Imports are added back because they are not deductible. Exports are removed from the destination base. A negative business liability is displayed as refundable; loss carryforward/refund administration is left for Iteration 2.

## 8. Incidence assumptions

The statutory collection mechanism is not an incidence estimate. The household comparison assumes full conversion of repealed employer payroll taxes to compensation and no short-run wage, price, profit, or exchange-rate adjustment beyond that explicit conversion. The national model is static and does not allocate the business tax to workers, owners, or consumers.

## 9. Data versioning

`src/data/baseline_2024.json` is the browser snapshot. `data/fred_series.json` centralizes series identifiers. `scripts/build_baseline.py` can rebuild the snapshot from FRED and fails if a series is missing; the deployed app never fetches FRED on interaction. `src/data/current_law_2024.json` is the sole source of household tax parameters.

## 10. Deferred work

Dynamic scoring, capital and GDP effects, transition rules, existing-asset effects, household consumption microsimulation, income-decile distribution, Tax-Calculator, OG-USA, state/local taxes, healthcare reform, detailed exemptions, and business-loss administration are outside Iteration 1.
