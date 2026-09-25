# Worker-level X-tax and child-credit swap: provisional results

The [first GE prototype](GENERAL_EQUILIBRIUM.md) and earlier worker run used different assumptions. **This report replaces their X-tax labor/GDP figures.** Its capital module remains fitted to one Tax Foundation DBCFT capital result; these are illustrations, not CBO or Tax Foundation scores.

## Policy and household interpretation

The central X-tax imposes a 25% marginal wage rate through **$75,000 per filing adult**, 35% above, and a 35% DBCFT with immediate expensing. Payroll and federal individual/business income taxes and customs receipts are replaced. A refundable **$2,000 earned adult credit** phases in at 10% of *cash pay* and never phases out. Employer FICA repeal passes through as cash wages. The refundable child credit is **$7,200 per child** before the social-program swap. Employer-paid insurance and pension compensation enter the reform wage-tax base at the same rate as cash pay; the employer obtains no additional tax preference by paying compensation as benefits.

The **$3,000 under-65 adult/$1,500 child refundable insurance credit** applies to qualifying ESI or individual insurance, capped at the modeled premium. The labor runner assumes every sampled tax unit's under-65 members purchase qualifying insurance at or above their credit; a no-purchase-credit sensitivity tests this assumption. The app estimates credits for ESI, nongroup coverage, and possible uninsured enrollment separately. Its default replaces observed ACA premium tax credits with the flat schedule, counting gross new credits as costs and estimated displaced credits as savings. The latter use survey-linked 2024 values projected with a premium factor, **not** reconciled FY2025 administrative outlays. Medicaid and SSI remain intact and can still contain cliffs.

## Reproducible labor calculation

- Source: pinned [2025 Census CPS ASEC](https://www.census.gov/programs-surveys/cps/data/datasets.html), 2024 wages scaled to the 2025 BEA cash-wage control. Archive SHA-256 `318845a2b5e0034eb2973898de1738f4df0025727de38499e7669cb9c0deef0b`. The aggregate output contains no respondent records.
- For each positive-wage worker, add $1,000 of wages to the tax unit, recompute existing wage-only current-law income/EITC/CTC and both payroll-side taxes, and recompute reform liability. Allocate the BEA health and pension controls to workers in proportion to wages. **Central assumption: employer health and pension benefits rise proportionally with incremental wages.** They are excluded from current federal payroll and income taxes but fully included in reform compensation. This assumption about the marginal compensation package is distinct from taxing benefits already received like cash.
- Divide both tax changes by the same increment of total employer cost; weight each worker by survey weight times earnings. Apply [CBO's 2026 labor methods](https://www.cbo.gov/system/files/2026-06/62267-Labor-Supply.pdf): substitution elasticities 0.25 for primary earners and 0.32 for secondary earners, and income elasticity −0.05. The capital-induced wage change is +0.837% from the fitted DBCFT module. Tax bases are not iterated to the new equilibrium.
- Reproduce: `python3 scripts/estimate_labor_response.py --archive /path/to/asecpub25csv.zip`. The checked-in [aggregate output](analysis/labor_response_2025.json) contains settings, worker bins and sensitivities.

| Earnings-weighted measure | Current law | X-tax with benefits taxed as wages |
|---|---:|---:|
| Federal marginal tax rate on employer labor cost | 28.59% | 32.30% |
| Federal average tax share | 21.97% | 19.84% |
| Share of workers with a lower modeled marginal rate | — | 11.2% |

While the adult credit is phasing in, an extra dollar of eligible cash pay reduces the 25% wage tax's net marginal rate to 15%. Employer FICA passed into cash pay also counts toward that phase-in. The rate on **total employer cost** differs if benefits accompany cash pay. For individual original wages of $20,000–$75,000 the average modeled federal marginal rate moves **25.56% → 27.83%**; for $300,000+ it moves **33.07% → 35%**. The bins classify original individual cash wages, while the reform bracket depends on tax-unit compensation.

The illustrative hours response is **−1.07% from substitution**, **−0.15% from the income effect**, **−1.23% combined**. With the unchanged fitted capital response, long-run GDP is **−0.40%** and capital **approximately +1.09%**. These are level changes, not annual growth rates. Under a negative income elasticity, a flat insurance credit that improves average after-tax resources can lower predicted hours; this is not a welfare loss.

| Assumption | Hours | GDP with same capital module |
|---|---:|---:|
| Benefits paid in kind but fully taxable; proportional health and pension benefits | −1.23% | −0.40% |
| Half of benefits paid as cash, with the same total employer cost | −1.23% | −0.40% |
| All benefits paid as cash, with the same total employer cost | −1.24% | −0.41% |
| Pension benefits alone grow with wages | −0.43% | +0.40% |
| Benefits fixed as cash wages rise | +0.28% | +1.12% |
| No insurance-credit receipt | −0.99% | −0.16% |
| Spending-neutral ~$10,006 child credit, ignoring removed social benefits | −1.29% | −0.46% |
| $16,200 illustrative family safeguard, ignoring removed social benefits | −1.43% | −0.60% |

The cash-out sensitivities hold the **value and growth of total employer compensation fixed**, including repealed employer FICA. Cashing out benefits therefore does not change the reform wage-tax base or the insurance purchase credit. It changes the earned adult credit only for workers near its first-$2,000 phase-in. Some workers reach the credit cap sooner, which slightly *raises* their marginal rate on the next dollar even while their total credit rises. The modeled GDP difference between benefits kept in kind and full cash-out is about **0.01 percentage points**; the far larger sensitivity concerns whether *total benefits rise when someone works more*.

The higher-child-credit sensitivities **do not subtract lost SNAP, housing, or other assistance from individual average resources**. The public microdata labor runner lacks validated, aligned receipt and benefit values. They show only the credit's gross income effect and are **not net labor forecasts for the social-program swap**.

## Universal child-credit swap and the deficit tradeoff

The app's Social spending view provides a one-click swap of seven listed external federal programs: SNAP, WIC, school meals, Summer EBT, TANF, LIHEAP, and tenant-based housing assistance. Listed FY2025 federal account amounts total **$202.088 billion**. Dividing by **72.021 million** children finances **$2,805.95** more per child, raising the refundable child credit from $7,200 to **$10,005.95**. This is arithmetic national spending neutrality for the increment, before program administration differences, transition, state budgets, or behavioral feedback. It is **not** recipient-level neutrality. A flat child supplement has no income-tested withdrawal under the replaced programs.

A second setting calibrates the credit to protect **every child-recipient example in the Social spending table**, including a single parent with two children and an illustrative $12,000 housing voucher. At the spending-neutral credit the housing example loses about **$12,338/year** in modeled resources (with in-kind benefits valued at 75% of government cost). An additional about $6,169 per child closes that gap; the app rounds the **total credit to $16,200 per child**. This costs approximately **$446.1 billion/year more than spending neutrality**. These examples do not represent the national distribution of program participants, so the higher credit cannot guarantee actual recipients are held harmless. Childless people receive no supplement, and housing availability and medical coverage are not captured by the cash-resource comparison.

Under the app's provisional 2025 baselines, 25/35 rates, earned adult credit including passed-through employer social contributions, $3,000/$1,500 insurance credits, modeled ACA-credit savings, seven-program replacement and a $16,200 child credit, illustrative **annual static deficit reduction is about $194 billion**. With the spending-neutral ~$10,006 child credit, it is **about $640 billion**; their difference is the $446 billion increment. Both estimates rely on the app's compliance assumptions, full qualifying coverage for insured people and a 15% induced take-up assumption for uninsured people. They are **not ten-year scores**. ACA credit savings and household benefit receipt require independent validation. If all imputed health/pension benefits become cash counted toward adult-credit eligibility, the national adult-credit cost increases from **$362.74 billion to $366.01 billion**—another **$3.27 billion** of annual fiscal cost, holding the rest of the score fixed. That alternative does not model the employer transition itself or recipients' actual insurance purchases.

## Work remaining for a CBO or Tax Foundation grade model

1. Link return-quality current-law taxes and program receipt, using validated unit definitions, employer benefits, self-employment, state taxes, AMT, NIIT, health credits, Medicaid, SNAP and housing. Reconcile spending and participants to administrative totals. Then target a declared share of *actual* families with children, such as 90% or 95%, and report their loss distribution and fiscal cost. [CBO's methods](https://www.cbo.gov/system/files/2026-06/62267-Labor-Supply.pdf), [Tax-Calculator](https://github.com/PSLmodels/Tax-Calculator) and [CBO's discussion of survey underreporting](https://www.cbo.gov/publication/61157) are starting points.
2. Model current program withdrawal and work entry separately from hours responses, and rerun labor incentives for the whole package, including replaced benefits. A flat universal credit cannot compensate every previously aided family at a fixed budget.
3. Independently rebuild asset and industry capital user costs, vintages, financing, depreciation, cross-border treatment and fiscal closure. Reproduce a standalone DBCFT without fitting its GDP and revenue results. Compare [Tax Foundation methods](https://taxfoundation.org/wp-content/uploads/2025/03/ModelMeth25.pdf), [CBO CapTax](https://www.cbo.gov/publication/60985), and [OG-USA](https://pslmodels.github.io/OG-USA/content/calibration/tax_functions.html). Then iterate household taxes, labor, capital, GDP and revenues to a common equilibrium.

The household, health, labor and national calculators now include passed-through employer payroll contributions in the earned-credit base; the national calculator uses an imputed employer social-insurance amount rather than the exact worker payroll liability. The health view can retain ESI or pay its value as cash and includes both in the reform tax base. Cashing out pensions and reconciling that change to national credit eligibility remain incomplete. The browser presents static household/fiscal comparisons; labor/GE output remains command-line analysis until compensation and current program receipt can be validated together.
