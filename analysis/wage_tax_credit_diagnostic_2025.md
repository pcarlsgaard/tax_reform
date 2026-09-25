# Audit of the 25%/35% wage schedule and earned adult credit

**Correction to the earlier population comparison:** The website's household chart measures an extra dollar of *cash wages plus passed-through employer payroll tax*. The first worker-level run also added an imputed, pay-proportional employer pension contribution, and taxed that extra compensation in the reform. That is a materially different marginal experiment. On the **website's wage-only basis**, the starting X-tax lowers the modeled federal wage-tax wedge for **59.1% of workers**, and for **60.5% of workers with individual cash wages below the $176,100 Social Security cap**. The prior report said 84.1% faced increases; that refers to the full-compensation pension sensitivity, not the wage-only question. The earlier five-bin optimizer maximized revenue subject to *average* wedge constraints and did not maximize the number of people with a reduction.

## Exact schedule

With a 25% wage rate starting at zero, a **$2,000 adult credit phased in at 10% of compensation**, no credit phaseout, and 35% starting at **$75,000 of tax-unit compensation per filing adult**, the statutory marginal rate is:

| Tax-unit compensation per filing adult | Adult credit on next dollar | Marginal wage tax |
|---|---:|---:|
| $0–20,000 | +10¢ | **15%** |
| $20,000–75,000 | Fully earned | **25%** |
| Above $75,000 | Fully earned | **35%** |

The boundaries use total tax-unit compensation, not each member's cash wage. The credit caps at $20,000 of compensation per **credit-eligible adult**, while the tax brackets use **filing adults**; the table assumes those counts match. A married couple filing jointly receives a $4,000 credit if two adults qualify, reaches the credit cap at $40,000 of compensation, and begins the 35% bracket at $150,000. A worker's cash wage can cross those points earlier once passed-through employer FICA and any other taxable compensation are counted. Fixed refundable child and insurance credits affect take-home resources, but have no marginal slope here.

The 2025 Social Security maximum is **$176,100 of each worker's *cash wages***, with each side paying 6.2% below it; Medicare continues at 1.45% on each side above the cap ([SSA](https://www.ssa.gov/news/en/press/how-is-social-security-financed.html), [IRS](https://www.irs.gov/instructions/i944)). That cap is per earner; the proposed $75,000 and optional 30% boundaries are per filing adult and apply to total taxable compensation. They cannot line up exactly for every family.

## Re-running the same worker sample on two bases

Each line adds $1,000 to one worker in the pinned CPS ASEC sample and divides both current and reform taxes by the **same increase in employer cost**. Both comparisons include federal income tax, EITC, child credits, and **both sides of FICA** under current law; neither includes social benefits or withdrawal. The full-compensation column additionally includes a wage-proportional employer pension contribution at the margin and fixed employer health spending.

| Scenario | Earnings-weighted current wedge | Earnings-weighted X-tax wedge | Workers with higher wedge | Workers under SS cap with higher wedge |
|---|---:|---:|---:|---:|
| **Website wage-only** (cash wage + employer FICA) | 32.47% | 31.70% | **40.9%** | **39.5%** |
| **Full compensation** (also marginal pension; health fixed) | 30.69% | 32.32% | **84.1%** | **85.0%** |

In the website-matched worker sample, **10.8% of workers** have an exact 15% reform slope, **47.8%** are at 25%, and **40.6%** are at 35%; about 0.8% cross a threshold or have another local slope over the $1,000 interval. Thus the 15% rate is real, but the $2,000 cap means most workers are no longer in its phase-in.

The large change between rows arises because current income tax and FICA fall on cash wages while the full-compensation denominator includes incremental pension pay; the X-tax covers that pension pay when cashed out. For example, a childless single worker at **$30,000 cash wages** has a modeled current/reform wedge of **25.36%/25.00%** in the wage-only view, versus **24.00%/25.00%** with a marginal pension. At **$190,000**, above the individual Social Security cap, the wage-only wedges are **26.52%/35.00%**. These simplified examples exclude other income and deductions. The model's population weights, filing status and family credits matter beyond any single example.

## A 30% intermediate bracket

Hold the 25% middle rate to **$75,000 per filing adult**, then apply **30%** until the indicated top threshold, and **35%** above that. The worker shares use the wage-only denominator in the left pair and full compensation in the right pair. Revenue is the static annual change in the website's **full-compensation national tax base**, after its assumed 7.5% noncompliance; it is not a dynamic or full deficit score.

| Top 35% starts per filing adult | Wage-only: workers with higher wedge | Wage-only: under SS cap with higher wedge | Full compensation: workers with higher wedge | Static wage revenue vs. starting X-tax |
|---|---:|---:|---:|---:|
| $75,000 (no 30% band) | 40.9% | 39.5% | 84.1% | Baseline |
| $150,000 | **16.3%** | **13.1%** | 53.7% | −$153.3B/year |
| $200,000 | **16.3%** | **13.1%** | 50.8% | −$191.7B/year |
| $225,000 | **16.1%** | **13.1%** | 50.5% | −$203.1B/year |

This supports the user's intuition for the **cash-wage** comparison. Most workers below the Social Security cap face a reduction even without the 30% band; with a band to $150,000, about **86.9%** do. Extending that band to $200,000 barely changes the number of wage-only winners, because people newly moved out of 35% often either already had a current wedge above 35%, or face a current wedge below even 30% when Social Security contributions stop. The wider band still reduces revenue substantially and protects some people in the full-compensation sensitivity. A 30% bracket alone does **not** guarantee a lower wedge just above the Social Security cap, where the current federal wage-only wedge can fall to roughly 26.5% in a simple one-earner example.

EITC repeal still matters at low wages: in the full-compensation run, **4.1%** of workers are on an EITC phase-in at the next $1,000, while **8.9%** are on an EITC phaseout. The child credit has its own phase-in. An earned supplement without a later phaseout may help protect the first group; simply keeping the whole EITC would restore its phaseout. A literal *no increase for anyone* target also needs more detail than a shared 25%/30%/35% schedule, especially for workers just above the Social Security cap.

## Limits and reproduction

The [aggregate JSON](wage_tax_credit_diagnostic_2025.json) includes actual reform-rate groups, a five-bin view of *individual* cash wages, 30% band scenarios, and single-worker examples for both bases. Run `python3 scripts/diagnose_wage_tax_marginals.py --archive /path/to/asecpub25csv.zip`; the pinned Census archive has SHA-256 `318845a2b5e0034eb2973898de1738f4df0025727de38499e7669cb9c0deef0b`. The model scales 2024 observed income to 2025 wage totals. Current tax law is simplified: heads of household are treated as single filers; it excludes AMT, NIIT, nonwage income, other tax credits and deductions. Social programs, ACA subsidy withdrawals and state taxes are excluded by design here. Tax return-based validation would be necessary before calling the worker shares official estimates.
