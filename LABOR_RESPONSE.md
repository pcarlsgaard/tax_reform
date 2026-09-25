# Correcting the X-tax labor response

The [first long-run prototype](GENERAL_EQUILIBRIUM.md) used a single **35.11%** marginal labor wedge and predicted **−1.06% hours** and **−0.23% GDP** for an earlier schedule. **Do not use those numbers for the revised policy.** They collapsed the income distribution into a single tax rate and did not compute each worker's current-law tax wedge. This analysis replaces that labor calculation with a worker-level, survey-weighted comparison. It remains illustrative, not a CBO or Tax Foundation forecast.

## Exact policy and interpretation

Central policy: **25% wage rate from the first dollar through $75,000 per tax-schedule adult, 35% above that, $2,000 per eligible adult credit phased in at 10% of cash wages, and $7,200 fully refundable per child under 18**. The federal individual income tax, employee and employer payroll taxes, federal business income taxes, and customs receipts are selected for replacement. The business cash-flow tax has 35% rate and immediate expensing. The insurance credit and government transfers are **not** modeled in the labor response. The old $17,000 zero bracket is a reported sensitivity, not part of central policy.

The 10% adult-credit phase-in means a tax unit *in its 25% bracket* with a still-phasing-in credit has a **15% statutory net federal marginal wage rate** on an additional dollar of cash wages when payroll pass-through and benefits are held fixed. That does not imply every worker earning less than $20,000 individually faces exactly 15%: joint income, employer payroll pass-through, credits per adult, and an employer-benefit level allocated into the tax base change the position of a tax unit.

The static simulator still phases the adult credit in on **imputed total compensation**, whereas this revised labor exercise uses **cash wages**, consistent with a credit fully phased in after $20,000 of cash earnings per adult. This changes the static adult-credit cost by about **$5.3 billion** on the pinned distribution. Until the two tax calculators are reconciled, do not present a combined precision dynamic revenue score.

## Data and computation

- Input: pinned [2025 Census CPS ASEC public-use file](https://www.census.gov/programs-surveys/cps/data/datasets.html) (2024 earnings), SHA-256 `318845a2b5e0034eb2973898de1738f4df0025727de38499e7669cb9c0deef0b`. Group by Census `TAX_ID`, preserve each person's cash wage, joint-filing indicator, adults and children; use reference-person `MARSUPWT`. Scale total wages by **1.0749** to the existing 2025 BEA cash-wage control. No respondent records or identifiers are committed.
- Baseline: the existing project's *wage-only* 2025 federal individual income, EITC, child-credit, and both payroll-side calculators. Children under 17 enter the baseline CTC; children under 18 proxy EITC eligibility and receive the new credit. We verified Python calculations against the application's TypeScript current-law calculator for low, middle, and high earnings and two-earner examples.
- For **each positive-wage earner**, add **$1,000** to that person's earnings and recompute all tax-unit liabilities under current law and reform. Divide each liability increment by the associated increase in employer labor cost. Compute both marginal rates and average tax shares, then aggregate using **each worker's earnings times the survey weight**, reporting worker shares separately.
- Match CBO's [2026 labor-supply methods](https://www.cbo.gov/system/files/2026-06/62267-Labor-Supply.pdf): primary-earner substitution elasticity **0.25**, secondary **0.32**, and income elasticity **−0.05**. For each worker, the approximate substitution response is `elasticity × [wageRatio × (1 − newMTR)/(1 − oldMTR) − 1]`. The income response replaces marginal rates with average tax shares and uses `−0.05`. The model sums responses with earnings weights. The capital module's **+0.84% pretax wage** is passed into the response; there is no iterative tax-base recalculation yet. CBO's paper reports an analogous $1,000 perturbation, earnings weights, separate substitution and income effects, and sensitivity by primary/secondary earners.
- **Central treatment of benefits:** existing employer health/pension benefits are allocated across workers in proportion to cash wages and included in the reform tax *level*. An additional $1,000 of earnings is assumed **not** to add health/pension benefits, while statutory employer FICA changes. This distinction is indispensable. Alternatives below let pension benefits or all benefits rise with the next $1,000.

Run `python3 scripts/estimate_labor_response.py --archive /path/to/asecpub25csv.zip`. The script verifies the exact input checksum and writes [the aggregate output](analysis/labor_response_2025.json), with no person-level microdata.

## Results under these assumptions

| Measure | Current law | Revised X-tax |
|---|---:|---:|
| Earnings-weighted federal marginal tax rate on labor cost | 32.47% | 32.25% |
| Earnings-weighted federal average tax share | 21.97% | 23.70% |
| Share of workers with a lower modeled marginal rate | — | 52.9% |
| Share of earnings earned by workers with a lower modeled marginal rate | — | 52.5% |

The average tax share can rise even when the weighted marginal rate falls: the broad 25%-from-dollar-one wage base taxes existing earnings, and refundable credits change the level of tax paid. The average-share change contributes a positive income effect on hours because this simplified equation assumes lower disposable resources can induce more work; it is **not** a welfare improvement.

| Individual cash earnings | Earnings share | Current federal MTR | Reform federal MTR |
|---|---:|---:|---:|
| Less than $20k | 1.8% | 21.1% | 20.4% |
| $20k–$75k | 28.4% | 29.0% | 27.7% |
| $75k–$150k | 33.2% | 33.9% | 33.7% |
| $150k–$300k | 21.1% | 32.0% | 35.0% |
| $300k+ | 15.5% | 37.8% | 35.0% |

The bin is the **individual's earnings**, whereas the reform bracket depends on **joint tax-unit compensation**. A worker in the $150k–$300k bin can currently be above Social Security's wage ceiling and face Medicare but not Social Security on the next dollar. That is one reason not all workers see a lower rate.

The resulting *illustrative* labor response is **+0.44% from substitution**, **+0.08% from the income effect**, and **+0.52% total hours**. Using the earlier capital calibration, long-run capital is **+2.88%**, pretax wages **+0.84%**, and GDP **+1.36%** relative to the same baseline. Holding the capital-induced wage increase at zero reduces the direct tax-driven hours effect to **+0.34%**.

| Sensitivity | Hours | Illustrative GDP with the same capital module |
|---|---:|---:|
| Central: benefits fixed at the margin, $7,200 child credit | +0.52% | +1.36% |
| Existing $17k zero bracket retained | +0.30% | +1.14% |
| $6k child credit | +0.55% | +1.39% |
| $12k child credit | +0.41% | +1.25% |
| Pension/other benefits rise proportionally with wages | −0.19% | +0.65% |
| All imputed benefits rise proportionally with wages | −0.98% | −0.15% |
| CBO lower substitution elasticities (.15 primary/.22 secondary) | +0.36% | +1.20% |
| CBO higher substitution elasticities (.35 primary/.42 secondary) | +0.68% | +1.52% |

The child credit does not change *statutory marginal rates* because it is flat and refundable. It changes after-tax resources and therefore the model's income effect. This stylized effect does not include the credit's potential effect on whether a nonworker takes a job.

The existing national static calculator returns **$1.050 trillion** in annual deficit reduction for the revised 25/35, zero-$0, $2,000/$7,200 scenario *before the insurance credit*. It calculates **$366.0 billion** of adult credits on imputed total compensation, whereas a cash-wage phase-in costs about **$360.7 billion**. Neither estimate includes the proposed adult insurance credit. The static baseline uses a provisional 2025 GDP/base, a 7.5% compliance haircut, and broad-base aggregation. It is **not** a ten-year scored budget result. The **$868 billion** from the earlier 35/25 schedule and $17k zero bracket is a different policy and should not be reused.

## Priority order for a higher-quality system

1. **Specify the law and reconcile one tax calculator.** Define what counts as wages and taxable benefits, what increments with an extra hour, whether the adult credit phases in on cash wages or imputed compensation, payroll pass-through, child eligibility, financial services, loss refunds, health-credit eligibility, and the fiscal use of surplus. Make all revenue and MTR reports use the *same* policy and data. The open-source [Tax-Calculator](https://github.com/PSLmodels/Tax-Calculator) offers a richer federal current-law engine; it will need a separate reform calculator for the X-tax.
2. **Measure the full current-law net incentive.** Add tax returns or validated matched microdata, self-employment, nonwage income, NIIT/AMT when applicable, state taxes, and the income-dependent withdrawal of Medicaid, ACA credits, SNAP, and housing aid. CBO's [2026 study](https://www.cbo.gov/system/files/2026-06/62267-Labor-Supply.pdf) and [tax model overview](https://www.cbo.gov/publication/54096) are the closest methodological templates. [Altig et al.](https://www.nber.org/papers/w27164) show why ignoring interactions across transfer programs and over a lifetime can understate dispersion in net marginal rates.
3. **Separate working more from starting work.** Estimate participation tax rates and hypothetical entry earnings for zero earners and secondary earners; apply evidence-based participation elasticities separately from hours and average-income effects. CBO's [discrete-choice analysis](https://www.cbo.gov/publication/57027) is a useful alternative; our +0.52% response weights only current positive earners and does not forecast entry from nonwork.
4. **Build the capital and revenue benchmark independently.** Replace the exposed-capital share fitted to Tax Foundation's +2.6% with asset- and industry-specific cost recovery and tax treatment, vintages, debt/equity, business form, cross-border income, NOLs, and the CBO baseline. [CBO CapTax](https://www.cbo.gov/publication/60985) and [Tax Foundation's 2025 methods](https://taxfoundation.org/wp-content/uploads/2025/03/ModelMeth25.pdf) are the starting references. Reproduce the standalone 21% DBCFT option *without* fitting its GDP and revenue results.
5. **Only then add dynamic closure and distribution.** Debt service and spending, savings, ownership of capital, GDP versus GNP, exchange-rate and border adjustment, and depreciation/old assets through the transition. [OG-USA](https://pslmodels.github.io/OG-USA/content/calibration/tax_functions.html) shows how to feed tax microsimulation into an open dynamic overlapping-generations model; [Penn Wharton](https://budgetmodel.wharton.upenn.edu/model/) shows a richer heterogeneous-household OLG design. Neither is a drop-in score for a DBCFT: both require explicit modeling of your new business tax and credit rules.

The immediate conclusion is **methodological**: the previous uniform-wedge labor result was misleading. A per-worker calculation finds many lower marginal rates and a positive hours response under one clearly stated treatment of benefits, with a wide range under plausible alternatives.
