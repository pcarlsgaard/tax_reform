# Which parts of the wage tax raise marginal rates?

This is a **federal tax-only** diagnostic for the starting X-tax. It excludes social-program benefits and their withdrawals. The wage comparison includes regular federal income tax, the EITC, child tax credits, and **both sides** of payroll tax. Both sides are divided by the same extra employer labor cost used for the reform. Employer health is fixed at the margin; pension contributions grow with pay. The reform taxes all compensation as cash, pays a $2,000/adult credit that phases in at 10%, applies 25% through $75,000 per filing adult and 35% thereafter, and pays the already specified flat refundable child and insurance credits. Flat credits change disposable income but have no slope once fully refundable.

The model adds $1,000 to each worker's cash wages in the pinned 2025 CPS ASEC sample (income observed for 2024), calibrated to 2025 wage totals. The table weights each bin's tax rate by cash earnings; the worker shares use CPS person weights. Individual cash wages define the rows, while the actual tax schedule depends on **joint household compensation**, so an individual's wage bin does not uniquely determine their statutory reform bracket.

| Individual annual cash wage | Workers (millions) | Current federal marginal tax | Starting X-tax marginal tax | Workers with an increase | Workers on an EITC phase-in |
|---|---:|---:|---:|---:|---:|
| Under $20,000 | 24.57 | 19.94% | 21.99% | 67.9% | 27.4% |
| $20,000–75,000 | 80.83 | 27.41% | 27.89% | 88.0% | 0.0% |
| $75,000–150,000 | 42.48 | 32.11% | 33.72% | 91.1% | 0.0% |
| $150,000–300,000 | 14.12 | 30.18% | 35.00% | 81.9% | 0.0% |
| $300,000 and above | 3.53 | 35.61% | 35.00% | 33.5% | 0.0% |

**EITC repeal is a real low-wage problem but not the main source of increases overall.** All 4.07% of workers whose EITC grows on the next $1,000 currently face a higher marginal tax in the starting X-tax. Yet **80.06% of all workers** still face an increase even though their EITC is *not* phasing in. The refundable portion of the current child credit also grows with earnings for 1.66% of workers, adding to the low-income issue. Conversely, 8.86% of workers are in an EITC *phaseout*; repealing that withdrawal tends to lower their marginal wedge. On an earnings-weighted basis, the current EITC's average marginal credit slope is **negative 0.38 percentage points** because phaseouts outweigh phase-ins at the aggregate margin.

Simply carrying the old EITC unchanged into the reform is therefore an inefficient way to target the goal: it restores both the phase-in and the phaseout. In this model the share with a higher tax-only marginal rate would rise from **84.12% to 91.49%** because workers on the old EITC phaseout lose the relief from its repeal. The comparison holds the X-tax brackets fixed and does **not** score the cost of retaining the EITC; it is a derivative check, not a policy option.

Two separate repairs would be needed to pursue **no higher individual federal wage-tax marginal rate**:

1. For low earners, increase the *earned* credit slope while it is phasing in, with the necessary slope tied to qualifying children. Keep the existing flat child credit fully refundable for income support. End an earned supplement at a cap **without withdrawing it later**; a cap creates a kink where marginal rates return to the regular schedule, though it does not make total resources fall. Even preserving the old EITC phase-in alone is insufficient in this simple model for some workers: the reform's 25% tax less its 10% adult-credit phase-in is about 15% at the margin, while the existing two-sided payroll wedge alone can be about 14.2% of employer cost.
2. For workers outside credit phase-ins, adjust the wage bracket schedule or provide carefully targeted marginal offsets. The 35% step above $75,000 per adult is a major cause; among $150,000–300,000 earners the average current wedge is 30.18%, versus the reform's 35%. Repealing the EITC cannot fix that group.

A common 35% *effective* rate on every additional top-bracket dollar cannot guarantee no increase for every worker whose current tax-only wedge is below 35%. Raising the entry point or adding a top-bracket offset can protect some of them; a literal individual guarantee needs an individualized constraint and a complete current-law calculator. The earlier [five-bin optimizer](wage_marginal_optimization_2025.md) caps **bin averages**, not every person's rate, and its static revenue results should not be read as the price of an individual guarantee.

Run `python3 scripts/diagnose_wage_tax_marginals.py --archive /path/to/asecpub25csv.zip` to reproduce the [aggregate JSON](wage_tax_credit_diagnostic_2025.json). The pinned archive SHA-256 is `318845a2b5e0034eb2973898de1738f4df0025727de38499e7669cb9c0deef0b`. The simplified baseline treats heads of household as single, leaves out AMT, NIIT, other income and deductions, and cannot replicate every EITC or child-credit eligibility rule. This is an exploratory score, not an official current-law tax estimate.
