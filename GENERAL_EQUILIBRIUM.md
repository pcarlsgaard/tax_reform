# DBCFT and progressive X-tax: first general equilibrium layer

**Update:** The X-tax labor and GDP illustration below uses a uniform wage-tax proxy and an earlier policy schedule. It has been superseded by the [survey-weighted worker analysis](LABOR_RESPONSE.md), which evaluates the revised 25/35 wage rates, earned adult credit, and child-credit sensitivity. The DBCFT capital benchmark remains the same.

This is a **working comparative-statics prototype**, not a reproduction of the Tax Foundation tax calculator, a CBO overlapping-generations forecast, or a ten-year budget score. It lives in `src/model/generalEquilibrium.ts`; run `npx vitest run tests/generalEquilibrium.test.ts --reporter=verbose` to see the calibration and first policy run. The existing app and its static revenue calculations are unchanged.

## Benchmark, definition, and calibration

Tax Foundation [Option 71](https://taxfoundation.org/tax-reform-guide/option/replace-the-corporate-income-tax-with-a-destination-based/) replaces the corporate and noncorporate business income taxes with a **21%** DBCFT: full expensing, no interest deduction or interest-income tax, exports excluded, imports nondeductible. Its published *long-run* results are GDP **+1.4%**, capital **+2.6%**, wages **+1.3%**, and **+463,000** full-time equivalent jobs. The ten-year *primary* deficit reduction is **$2,334.7 billion conventional** or **$3,276.6 billion dynamic**, covering **2027–2036**. This benchmark keeps the existing individual wage and payroll taxes and is thus a different policy from a full X-tax replacement.

Tax Foundation's [model methods](https://taxfoundation.org/wp-content/uploads/2025/03/ModelMeth25.pdf), §§2 and 4, motivate an open-economy Cobb–Douglas production function, fixed long-run after-tax capital return, labor supply elasticity around **0.3**, a tax simulator linked to production, and a separate allocation model. Its table 4 reports 2024 marginal wage rates of 19.0% federal individual income, 8.7% federal payroll, and 4.5% state income. These produce the prototype's 32.2% baseline marginal wage wedge. The paper assumes about 84% of the long-run capital adjustment by year ten; **the prototype does not simulate that transition**.

For a business rate `t`, the present value `z` of depreciation deductions per dollar invested, exogenous real return `r`, and depreciation `δ`, the prototype uses:

`user_cost = (r + δ) × (1 − t z) / (1 − t)`.

At `z=1`, the marginal business tax cancels from the service price, assuming symmetric deduction/refund of losses and no transition tax on old capital. With capital share `α`, an exposure share `e`, and user-cost ratio `q` relative to baseline, the affected economy solves:

`K/L = (q^e)^[-1/(1−α)]`, `w/w₀ = (K/L)^α`, `L/L₀ = [(w/w₀)(1−τL)/(1−τL₀)]^0.3`, `Y/Y₀ = (K/K₀)^α(L/L₀)^(1−α)`.

Here `α=0.36`, `r=5%`, `δ=8%`, baseline business `t=21%`, and baseline `z=0.82` are **illustrative assumptions**, not BEA or IRS estimates for the marginal investment mix. The affected-capital share is calibrated *only* to Tax Foundation's **+2.6%** capital stock: **31.72%**. For full expensing, the user-cost reduction in the aggregated capital input is **1.47%**. The other outcomes are genuine checks, not separately fitted:

| Long-run change | This prototype | Tax Foundation | Gap (percentage points) |
|---|---:|---:|---:|
| Capital stock | +2.60% | +2.60% | 0.00 (fitted) |
| GDP | +1.09% | +1.40% | −0.31 |
| Wage rate | +0.84% | +1.30% | −0.46 |
| Hours / full-time equivalent employment | +0.25% | +463,000 jobs | Needs aligned employment denominator |

**Result:** The prototype reproduces the *direction* and approximate scale of the long-run effect, but **does not replicate the GDP and wage results exactly**. The one-sector Cobb–Douglas economy cannot freely match all three reported effects after fitting capital, because factor shares constrain how a fixed capital increase changes wages and GDP. Separating corporations, pass-throughs, housing, government, and labor types is the next structural step; changing `α` merely to hit another target would conceal the discrepancy.

## First run of the proposed X-tax

The preliminary run sets the **35% business/top wage rate**, **25% middle wage rate**, **$17,000 zero bracket per adult**, **$60,000 top threshold per adult**, **$7,200 child credit**, and **$0 adult credit**. It replaces individual income, federal payroll, corporate income, and customs, matching the tax simulator's selected switches. It holds compliance at the simulator's default 7.5%. It **does not yet add the proposed $2,500 adult insurance credit**; this must be passed through the existing health-credit module or supplied as an explicit `insuranceCreditCost` adjustment. The first comparison also assumes full and immediate payroll pass-through into the taxable compensation base, as in the current national score.

With the capital exposure fitted to the DBCFT benchmark, the prototype returns **+1.26% capital**, **−1.06% hours**, **−0.23% GDP**, and **+0.84% wage**. It estimates a **35.11% compensation-weighted marginal wage rate** including the 4.5% retained state income wedge, versus its **32.2% baseline**. The current simulator gives **$867.9 billion** static annual deficit reduction *before the insurance credit* on its provisional 2025 national accounts. An illustrative rescaling of the proposed wage and business bases reduces that by **$14.7 billion**. These fiscal amounts are **FY2025-equivalent annual snapshots**, not a ten-year budget estimate. The revenue response does not model behavioral changes in tax compliance, household composition, transfers, incumbent capital, inflation, profit shifting, consumption, or baseline taxes on new income. The labor wedge is a tax-unit, compensation-weighted proxy; it needs a worker-level estimation and intensive/extensive margin split.

The negative output result is a **model result under these assumptions**, not a forecast. Full expensing removes the modeled tax on marginal new investment at both 21% and 35%, so this run's growth difference is driven primarily by the wage-side tax wedge and credits. The 35% business rate still changes *revenue from rents and old capital*, neither of which is an extra marginal-investment wedge in the solved long run. In particular, the model cannot yet say what happens to share prices or owners of old assets at enactment.

## Work needed for a credible independent replication

1. **Rebuild the benchmark's conventional score.** Obtain current-law C corporation and pass-through tax bases, depreciation vintages by asset, foreign profits, interest, NOLs and credits, trade flows, and CBO's 2027–2036 baseline. Run current law and the *exact* Option 71 switch on the same data. Do not calibrate the revenue delta to its $2.335T target.
2. **Split production and financing.** Model corporate, pass-through, owner-occupied housing, and government/institutional output; debt/equity financing, effective marginal tax rates and capital asset classes. Estimate `z`, capital shares, and exposure from BEA/IRS inputs instead of fitting the capital result.
3. **Link a worker-level tax calculator.** Compute current and reform marginal wages from linked CPS tax units, both payroll sides, EITC/CTC slopes, wage and health compensation, state taxes, and proposed credit rules; iterate wages and taxable bases to convergence.
4. **Add a transparent transition.** Capital accumulation, depreciation of old assets, loss carryforwards/refunds, legacy asset repricing, exchange-rate/border-adjustment scenarios, annual deficits and debt interest. Compare GDP versus GNP and document a fiscal closure rule.
5. **Out-of-sample validation.** Reproduce other published tax changes with the *same* parameter set; report error intervals and parameter sweeps before using policy differences to claim precision.

The static app remains the reference for current-law receipt replacement and distributional analyses. This prototype supplies a separately labeled long-run response and exposes exactly where replication still fails.
