# Consumption Tax Reform Simulator

A transparent, static simulator for a broad-based U.S. destination-based consumption tax with universal adult and child credits.

The app explains the NIPA cash-flow base, rate and credit arithmetic, representative wage-only households under 2024 law, and stylized business treatment of expensing and border adjustment.

## Default result

The preserved 2024 repository snapshot has GDP of $29.298T and a theoretical broad cash-flow base of $22.7649T. After the default 7.5% noncompliance assumption and no policy exemptions, the final base is **$21.0575T (71.9% of GDP)**.

The default reform uses a 30% tax-exclusive rate and fully refundable $4,800 adult / $4,800 child credits. Replacing FY2024 individual income, payroll, corporate income, and customs receipts sets a $4.742T target. Net static revenue is $4.6848T and the algebraic revenue-neutral rate is **30.27%**.

## Architecture

```text
src/model/                 Pure TypeScript calculation engine
src/data/                  Versioned browser-ready assumptions
src/views/                 Four simulator views
src/components/            Audits, controls, cards, and SVG charts
data/fred_series.json      Central FRED/BEA series catalog
scripts/build_baseline.py  Offline data-build/reference step
tests/                     Unit and end-to-end regression tests
MODEL_SPEC.md              Authoritative economic specification
MODEL_AUDIT.md             Historical inconsistencies and validation
archive/                   Historical one-off notebook patch scripts
```

The browser never calls FRED. Slider changes run deterministic pure functions against `src/data/baseline_2024.json`. The Python builder is used only to create a new versioned snapshot and fails if a series is unavailable.

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
```

Rebuild it from live FRED data during a deliberate data update:

```bash
python3 scripts/build_baseline.py --year 2024
npm test
```

Review changes before committing because BEA revisions can change historical observations.

## GitHub Pages

Vite uses `/tax_reform/` as its production base. `.github/workflows/deploy-pages.yml` runs tests, builds the app, uploads `dist/`, and deploys on pushes to `main`. In repository settings, set **Pages → Source** to **GitHub Actions** if it is not already selected.

## Methodology

The canonical computation is a flat-rate X tax / DBCFT plus wage-side tax at the same rate. Business wages and new investment are deductible, imports are not deductible, and exports are excluded. Households pay the wage-side tax and receive fully refundable demographic credits.

This is economically related to a broad VAT base, but the app distinguishes the economic base, statutory collection mechanism, assumed incidence, and household disposable resources. See [MODEL_SPEC.md](MODEL_SPEC.md) for definitions and [MODEL_AUDIT.md](MODEL_AUDIT.md) for the reconciliation.

The current-law wage-only comparator uses tax year 2024 brackets, standard deductions, both sides of Social Security and Medicare, Additional Medicare Tax, EITC, CTC, and ACTC. Parameters are versioned in `src/data/current_law_2024.json`.

## Historical notebooks

`Tax_Reform_Modeling.ipynb` and `VAT_Base_Updater.ipynb` are preserved unchanged as research provenance. Their former patch scripts are archival and are not sources of truth.

## Iteration 1 limitations

The model intentionally excludes dynamic GDP and capital effects, behavioral scoring, intergenerational transition incidence, existing-asset windfalls, a household consumption microsimulation, income-decile distributions, Tax-Calculator, OG-USA, state/local taxes, and healthcare reform. It also uses a fiscal-year revenue target with a calendar-year economic base and treats negative business liabilities symmetrically.
