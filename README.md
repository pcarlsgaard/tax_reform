# Consumption Tax Reform Simulator

A transparent, static simulator for a broad U.S. destination-based consumption tax. It combines an auditable national revenue model, a 2025 federal household comparator, configurable flat or progressive X-tax schedules, a transfer-replacement analyzer, and stylized business examples.

## Default 2025 result

The provisional 2025 snapshot has GDP of **$30.762T** and a theoretical broad cash-flow base of **$24.121T**. After the default 7.5% noncompliance assumption and no policy exemptions, the final base is **$22.312T (72.5% of GDP)**.

Eleven of the twelve national inputs are observed for 2025. BEA/FRED housing-sector value added still ends in 2024, so the builder carries its 2024 share of GDP into 2025. The app labels the baseline provisional and exposes the estimate and formula in its audit panel.

The default flat reform uses a 30% tax-exclusive rate, a maximum $4,800 EITC-like adult credit, and a flat fully refundable $4,800 child credit. A tax-unit score built from the 2025 CPS ASEC estimates **$542.013B** of statutory adult-credit eligibility at 100% take-up; it also replaces the former hand-set progressive wage-rate factor. All $15.727T of BEA employee compensation is taxable by default, with separate controls for exemptions of cash wages, employer social-insurance contributions, and employer pension/insurance supplements.

Replacing FY2025 individual income, payroll, corporate income, and customs receipts sets a **$5.051T gross target (16.42% of GDP)**. Because replacing individual income taxation also removes **$92.574B (0.30% of GDP)** of FY2025 refundable EITC and child-credit outlays, the default adjusted requirement is **$4.959T (16.12% of GDP)**. Net static flat-tax revenue is **$5.806T (18.87% of GDP)**; the algebraic revenue-neutral rate is **26.62% before** and **26.20% after** those automatic outlay savings.

## Architecture

```text
src/model/                 Pure TypeScript calculation engine
src/data/                  Versioned browser-ready assumptions
src/views/                 Five simulator views
src/components/            Audits, controls, and interactive SVG charts
data/fred_series.json      Central FRED/BEA series catalog
scripts/build_baseline.py  Offline data-build/reference step
scripts/build_microdata.py CPS ASEC tax-unit ETL and replicate-weight score
tests/                     Unit and end-to-end regression tests
MODEL_SPEC.md              Authoritative economic specification
MODEL_AUDIT.md             Historical inconsistencies and validation
archive/                   Historical one-off notebook patch scripts
```

The browser never calls FRED. Controls run deterministic pure functions against `src/data/baseline_2025.json`. The prior 2024 snapshots remain in the repository as historical data, not active assumptions.

## Run locally

Requires Node.js 22+ and Python 3.11+ for the optional data check.

```bash
npm install
npm test
npm run build
npm run dev
```

Verify the checked-in baseline without network access:

```bash
python3 scripts/build_baseline.py --verify-only
npm run microdata:verify
```

Rebuild it from live FRED data during a deliberate data update:

```bash
python3 scripts/build_baseline.py --year 2025 --allow-provisional-housing
npm test
```

Without `--allow-provisional-housing`, the 2025 build fails closed until the missing annual housing observation is published. Review snapshot changes before committing because BEA revisions can change historical values.

Rebuild the checked-in tax-unit distribution from the official Census archive (about 140 MB compressed):

```bash
python3 scripts/build_microdata.py
npm run microdata:verify
npm test
```

The generated `src/data/microdata_2025.json` contains aggregated tax-unit cells, not respondent-level records. The builder records the source URL and SHA-256 digest and uses all 160 Census replicate weights for sampling standard errors.

## GitHub Pages

Vite uses `/tax_reform/` as its production base. `.github/workflows/deploy-pages.yml` tests, builds, uploads `dist/`, and deploys pushes from `main` and the active preview branch. Repository **Pages → Source** must be **GitHub Actions**, and the `github-pages` environment must allow the preview branch. Restrict the workflow back to `main` when branch previews are no longer needed.

## Methodology

The user can select either:

- a flat X tax / DBCFT plus wage-side tax at the same rate; or
- a progressive X tax with a flat business rate and a zero/middle/top household wage schedule.

Business wages and new investment are deductible, imports are not deductible, and exports are excluded. The progressive national score applies the selected wage schedule to CPS ASEC tax units after raking their cash wages to the 2025 BEA control. Employer social-insurance and pension/insurance supplements are allocated in proportion to cash wages, and each compensation component has a separate exemption control. Adult credits can be EITC-like or universal; the default earned-credit schedule has editable phase-in, maximum, phaseout threshold, phaseout rate, and aggregate take-up. Child credits remain flat and fully refundable.

An invoice-credit VAT can reach a closely related economic consumption base, but it is a legally different collection mechanism. The simulator distinguishes economic base, statutory mechanism, incidence assumptions, and household disposable resources. See [MODEL_SPEC.md](MODEL_SPEC.md) and [MODEL_AUDIT.md](MODEL_AUDIT.md).

The current-law wage-only comparator uses enacted tax year 2025 brackets and deductions, both sides of Social Security and Medicare, Additional Medicare Tax, EITC, CTC, and ACTC. Parameters are versioned in `src/data/current_law_2025.json`. The Taxing Wages table follows the OECD's eight standard household/wage patterns using its $73,520 U.S. average wage, but reports this simulator's federal-only tax wedge and is not a reproduction of the OECD's broader measure.

## Social-spending replacement view

The fifth view separates two questions that are often conflated:

1. **Household replacement:** current disposable resources plus current transfer value versus reform disposable resources with transfers retained or selected programs eliminated.
2. **Fiscal replacement:** FY2025 federal program amounts removed from the tax-replacement revenue target, with an algebraically adjusted revenue-neutral rate.

The deterministic data snapshot is `src/data/transfers_2025.json`. SNAP uses a simplified FY2025 rule calculation; Summer EBT uses the 2025 statutory $120 benefit; school meals use a visible school-year 2024-25 reimbursement-value preset. WIC, TANF, LIHEAP, and tenant-based housing assistance require explicit household receipt and user-entered annual amounts because national formulas would imply false precision. Housing receipt is never inferred from income eligibility.

External program replacement does not change the reform credit schedule. EITC and CTC/ACTC are not external toggles: both are already incorporated in the current-law household calculation. Their budget treatment is split correctly. Amounts that offset positive liability already reduce individual-income-tax receipts and are not counted again; the FY2025 refundable excess is a mandatory outlay and is removed automatically when the individual-income-tax switch is selected. The audit displays household credits once as positive components after pre-credit liability and displays the refundable-outlay fiscal adjustment separately.

The Social spending household table uses a cash-resource convention. Current law starts with cash wages and subtracts only income tax and employee-side payroll tax; employer FICA is neither added as current household income nor subtracted as a household tax. Reform starts with cash wages plus the selected employer-FICA pass-through, then subtracts reform household tax, adds credits and current external transfers, and subtracts selected benefit replacements. A signed net tax/refund is available as a memorandum result but is not used to obscure this identity.

The default is no external-program repeal, so external selections do not change household results. The automatic refundable-credit outlay adjustment still follows the individual-income-tax replacement switch. When payroll taxes are replaced, the view defaults to passing 100% of repealed employer Social Security and Medicare contributions into reform wages and lets the user vary that incidence assumption from 0% to 100%. The selected share changes reform gross resources, the wage-tax base, and the earned adult-credit calculation; it is disabled when payroll taxes remain in place. The view also includes seven illustrative programs, 2025 contiguous-state FPL context, three-scenario decomposition, interactive earnings traces, and a centered-$1,000 effective marginal resource-withdrawal measure. See the authoritative identities and timing notes in [MODEL_SPEC.md](MODEL_SPEC.md).

## Historical notebooks

`Tax_Reform_Modeling.ipynb` and `VAT_Base_Updater.ipynb` are preserved unchanged as research provenance. Their former patch scripts are archival and are not sources of truth.

## Iteration 1 limitations

The model intentionally excludes dynamic GDP and capital effects, behavioral scoring, intergenerational transition incidence, existing-asset windfalls, household consumption microsimulation, Tax-Calculator, OG-USA, state/local taxes, and healthcare reform. Transfer results do not model assets, immigration/work rules, detailed state variation, local housing availability, or health-insurance value. Medicaid, Medicare, ACA subsidies, Social Security retirement, SSDI, and SSI are outside this module. The model pairs fiscal-year targets with a calendar-year base; the CPS distribution reports prior-year income; no administrative-data top-tail match is available; employer supplements are allocated pro rata to cash wages; adult-credit take-up is a policy assumption; and the score remains static. The household comparator also excludes employer pension and insurance benefits and the 2025 special deductions for tips, overtime, car-loan interest, and seniors. Negative business liabilities are treated symmetrically.
