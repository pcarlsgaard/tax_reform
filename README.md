# Tax Reform Modeling Project

This repository contains a comprehensive suite of Python scripts and Jupyter notebooks designed to model the macroeconomic and household-level impacts of a proposed tax and healthcare reform. The reform centers on replacing the current U.S. income and payroll tax system with a broad-based consumption tax (VAT), complemented by universal adult and child tax credits, and a reformed healthcare subsidy system.

## Project Overview

The core objective of this project is to simulate and analyze:
1.  **Macroeconomic Tax Base:** Estimating the size of a broad-based consumption tax (VAT) using National Income and Product Accounts (NIPA) data from the Federal Reserve Economic Data (FRED).
2.  **Household Tax Burden (Tax Wedge):** Comparing the "tax wedge" (the difference between total employer cost and employee take-home pay) under the current tax system (including 2024 income tax brackets, payroll taxes, EITC, and CTC) versus the proposed flat-rate consumption tax with universal credits.
3.  **Healthcare Reform Simulation:** Modeling portable health insurance subsidies across various plan tiers (Catastrophic, Bronze, Silver, Gold, Platinum) and capping individual premium contributions as a percentage of disposable income relative to the Federal Poverty Level (FPL).
4.  **Revenue Parity:** Calculating the necessary tax rates and credit amounts to achieve revenue targets (e.g., $4.3 Trillion) based on the estimated tax base.

## Key Files & Modules

### Data Fetching & Macroeconomic Modeling
*   **`app_table.py`**: Fetches annual average data for key economic indicators (Compensation of Employees, Corporate Profits, Net Imports, etc.) from the FRED API. It reconstructs the Broad VAT Base (Before Exemptions) for a specified year, generating an Appendix Table. It incorporates adjustments such as the "Housing Adjustment" (calculated as Household Investment Less Household Gross Capital Income) to accurately reflect consumption.
*   **`VAT_Base_Updater.ipynb`**: A notebook designed for interactive updates and analysis of the VAT base, working in tandem with the logic in `app_table.py`.

### Microeconomic & Household Impact Modeling
*   **`tax_reform_utils.py`**: The core logic engine. Contains functions to:
    *   `calculate_healthcare_subsidy`: Calculates individual contributions and government subsidies for healthcare based on income, family size, and FPL.
    *   `calculate_tax_wedge`: Computes the detailed tax breakdown for both the current U.S. tax code (accounting for standard deductions, tax brackets, EITC, and CTC) and the proposed reform (flat rate + universal credit).
    *   `plot_reform_impact`: Generates comprehensive visualizations comparing Take-Home Pay and the Tax Wedge between the two systems across a wide range of income levels (up to $1,000,000+) for both single individuals and married families with children.
*   **`sensitivity_matrix.py`**: Generates a Revenue Parity Sensitivity Table. It runs vectorized calculations across a grid of possible tax rates (20% to 35%) and credit amounts ($1,200 to $8,400) against a $19.8T base to show the estimated surplus or deficit relative to a $4.3T revenue target.
*   **`Tax_Reform_Modeling.ipynb`**: The primary Jupyter notebook that ties together the utility functions, running the simulations and displaying the output plots and tables.

### References & Literature
The project references several key documents regarding consumption taxes:
*   `How-Taxing-Consumption-Would-Improve-Long-Term-Opportunity-and-Well-Being-for-Families-and-Children-FV.pdf`
*   `GSTandRealEstatepoddar.pdf`

## Recent Development History (Gemini Brain Context)

Recent updates to the model include:
*   **Housing Adjustment Refinement:** Updated the macroeconomic calculation for the housing adjustment to correctly reflect "Household Investment Less Household Gross Capital Income," ensuring a more accurate measure of the consumption base.
*   **ACA Plan Tier Expansion:** Expanded the portable subsidy simulation to encompass all ACA metal tiers (Catastrophic, Bronze, Silver, Gold, Platinum) plus a pure catastrophic option, allowing for modeling of diverse consumer choices and risk-rated vs. community-rated scenarios.

## Getting Started

### Prerequisites
*   Python 3.x
*   Requires standard data science libraries: `pandas`, `numpy`, `matplotlib`. `urllib` and `csv` are used for FRED data fetching.

### Usage
1.  **Generate Macroeconomic Base:** Run `python app_table.py` to fetch the latest FRED data and print the Broad VAT Base calculation.
2.  **Generate Tax Wedge Plots:** The `plot_reform_impact` function in `tax_reform_utils.py` can be called (typically via the `Tax_Reform_Modeling.ipynb` notebook) to visualize the impact. It will generate PNG files such as `Reform_Impact_25pct_$4800.png`.
3.  **Revenue Sensitivity:** Run `python sensitivity_matrix.py` to view the matrix of potential rate/credit combinations and their impact on total revenue.
