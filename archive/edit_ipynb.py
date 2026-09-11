import json

filename = "c:\\Users\\S206053\\.gemini\\antigravity\\playground\\azure-curie\\Tax_Reform_Modeling.ipynb"

with open(filename, "r", encoding="utf-8") as f:
    nb = json.load(f)

old_target_1 = [
    "    #Calculates the tax wedge and take-home pay for both current and proposed systems.\n",
    "    # --- Ratios (Fixed) ---\n",
    "    health_ratio = 0.094 if status == 'single' else 0.18 # Higher for families\n",
    "    pension_ratio = 0.049\n",
    "    payroll_ratio = 0.070\n",
    "\n",
    "    # Payroll Tax Calculations (2024)\n",
    "    ss_tax = min(base_cash_wage, 168600) * 0.062\n",
    "    medicare_tax = base_cash_wage * 0.0145\n",
    "    addl_medicare = max(0, base_cash_wage - 200000) * 0.009 if status == 'single' else max(0, base_cash_wage - 250000) * 0.009\n",
    "    \n",
    "    employer_payroll = ss_tax + medicare_tax\n",
    "    employee_payroll = ss_tax + medicare_tax + addl_medicare\n",
    "\n",
    "\n",
    "    # 1. Gross Employer Cost\n",
    "    health_cost = base_cash_wage * health_ratio\n",
    "    pension_cost = base_cash_wage * pension_ratio\n",
    "    employer_payroll = base_cash_wage * payroll_ratio\n",
    "    gross_employer_cost = base_cash_wage + health_cost + pension_cost + employer_payroll\n",
    "    \n",
    "    # 2. Current System Take-Home\n",
    "    # Standard Deduction (2024)\n",
    "    std_deduction = 14600 if status == 'single' else 29200\n",
    "    employee_payroll = base_cash_wage * 0.0765\n",
    "    taxable_income = max(0, base_cash_wage - std_deduction)\n"
]

new_target_1 = [
    "    #Calculates the tax wedge and take-home pay for both current and proposed systems.\n",
    "    \n",
    "    # --- Healthcare Costs (Fixed) ---\n",
    "    employer_health_cost = 7583 if status == 'single' else 19276\n",
    "    employee_health_cost = 1368 if status == 'single' else 6296\n",
    "    total_health_cost = employer_health_cost + employee_health_cost\n",
    "\n",
    "    # --- Other Ratios (Fixed) ---\n",
    "    pension_ratio = 0.049\n",
    "    payroll_ratio = 0.070\n",
    "\n",
    "    # Pre-tax wage for current system calculation\n",
    "    pre_tax_wage = max(0, base_cash_wage - employee_health_cost)\n",
    "\n",
    "    # Payroll Tax Calculations (2024)\n",
    "    ss_tax = min(pre_tax_wage, 168600) * 0.062\n",
    "    medicare_tax = pre_tax_wage * 0.0145\n",
    "    addl_medicare = max(0, pre_tax_wage - 200000) * 0.009 if status == 'single' else max(0, pre_tax_wage - 250000) * 0.009\n",
    "    \n",
    "    # 1. Gross Employer Cost\n",
    "    pension_cost = base_cash_wage * pension_ratio\n",
    "    employer_payroll = base_cash_wage * payroll_ratio\n",
    "    gross_employer_cost = base_cash_wage + employer_health_cost + pension_cost + employer_payroll\n",
    "    \n",
    "    # 2. Current System Take-Home\n",
    "    # Standard Deduction (2024)\n",
    "    std_deduction = 14600 if status == 'single' else 29200\n",
    "    employee_payroll_tax = ss_tax + medicare_tax + addl_medicare\n",
    "    taxable_income = max(0, pre_tax_wage - std_deduction)\n"
]


old_target_2 = [
    "    current_take_home = base_cash_wage - employee_payroll - net_income_tax\n",
    "    current_wedge = ((gross_employer_cost - current_take_home - health_cost - pension_cost) / gross_employer_cost) * 100\n",
    "    \n",
    "    # 3. Proposed System\n",
    "    total_credit = (adult_credit * (1 if status == 'single' else 2)) + (child_credit * num_children)\n",
    "    \n",
    "    gross_tax_liability = gross_employer_cost * rate\n",
    "    if status == 'single':\n",
    "        adult_offset = min(gross_tax_liability, adult_credit)\n",
    "        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)\n",
    "    else:\n",
    "        adult_offset = min(gross_tax_liability, adult_credit * 2)\n",
    "        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)\n",
    "        \n",
    "    new_take_home = gross_employer_cost - final_tax - health_cost - pension_cost\n",
    "    new_wedge = (final_tax / gross_employer_cost) * 100\n",
    "    \n",
    "    return {\n",
    "        'gross_cost': gross_employer_cost,\n",
    "        'current_take_home': current_take_home,\n",
    "        'current_wedge': current_wedge,\n",
    "        'new_take_home': new_take_home,\n",
    "        'new_wedge': new_wedge,\n",
    "        'current_tax': gross_employer_cost - current_take_home - health_cost - pension_cost,\n",
    "        'new_tax': final_tax\n",
    "    }\n"
]

new_target_2 = [
    "    current_take_home = base_cash_wage - employee_payroll_tax - net_income_tax - employee_health_cost\n",
    "    current_wedge = ((gross_employer_cost - current_take_home - total_health_cost - pension_cost) / gross_employer_cost) * 100\n",
    "    \n",
    "    # 3. Proposed System\n",
    "    total_credit = (adult_credit * (1 if status == 'single' else 2)) + (child_credit * num_children)\n",
    "    \n",
    "    gross_tax_liability = gross_employer_cost * rate\n",
    "    if status == 'single':\n",
    "        adult_offset = min(gross_tax_liability, adult_credit)\n",
    "        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)\n",
    "    else:\n",
    "        adult_offset = min(gross_tax_liability, adult_credit * 2)\n",
    "        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)\n",
    "        \n",
    "    new_take_home = gross_employer_cost - final_tax - total_health_cost - pension_cost\n",
    "    new_wedge = (final_tax / gross_employer_cost) * 100\n",
    "    \n",
    "    return {\n",
    "        'gross_cost': gross_employer_cost,\n",
    "        'current_take_home': current_take_home,\n",
    "        'current_wedge': current_wedge,\n",
    "        'new_take_home': new_take_home,\n",
    "        'new_wedge': new_wedge,\n",
    "        'current_tax': gross_employer_cost - current_take_home - total_health_cost - pension_cost,\n",
    "        'new_tax': final_tax\n",
    "    }\n"
]

def replace_sublist(lst, old_sub, new_sub):
    n = len(lst)
    m = len(old_sub)
    for i in range(n - m + 1):
        if lst[i:i+m] == old_sub:
            return lst[:i] + new_sub + lst[i+m:]
    return lst

changed = False
for cell in nb.get('cells', []):
    if cell.get('cell_type') == 'code':
        source = cell.get('source', [])
        old_source = source.copy()
        source = replace_sublist(source, old_target_1, new_target_1)
        source = replace_sublist(source, old_target_2, new_target_2)
        if source != old_source:
            cell['source'] = source
            changed = True

if changed:
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(nb, f)
    print("Notebook updated successfully.")
else:
    print("Code target not found!")
