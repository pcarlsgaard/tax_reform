import json

with open('Tax_Reform_Modeling.ipynb', 'r') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = "".join(cell['source'])
        
        # Scenario 1: Single
        target_s = "# 2. Calculate Current System Take-Home\nemployee_payroll = base_cash_wage * 0.0765\ntaxable_income = base_cash_wage - 14600  # Standard Deduction (Single 2024)\nincome_tax = (11600 * 0.10) + ((47150 - 11600) * 0.12) + ((taxable_income - 47150) * 0.22)\ncurrent_take_home = base_cash_wage - employee_payroll - income_tax"
        if target_s in source:
            rep_s = """# 2. Calculate Current System Take-Home
employee_payroll = base_cash_wage * 0.0765
taxable_income = base_cash_wage - 14600  # Standard Deduction (Single 2024)
income_tax = (11600 * 0.10) + ((47150 - 11600) * 0.12) + ((taxable_income - 47150) * 0.22)

# EITC (Single, 0 children)
eitc = max(0, min(632, base_cash_wage * 0.0765) - max(0, base_cash_wage - 10330) * 0.0765) if base_cash_wage < 18591 else 0

net_income_tax = income_tax - eitc
current_take_home = base_cash_wage - employee_payroll - net_income_tax"""
            new_source = source.replace(target_s, rep_s)
            cell['source'] = [line + '\n' for line in new_source.split('\n')]
            cell['source'] = [line.replace('\n\n', '\n') for line in cell['source']]
            if not source.endswith('\n') and cell['source'][-1].endswith('\n'):
                cell['source'][-1] = cell['source'][-1][:-1]

        # Scenario 2: Married
        target_m = "# 2. Calculate Current System Take-Home\nemployee_payroll = base_cash_wage * 0.0765\ntaxable_income = base_cash_wage - 29200  # Standard Deduction (Married Filing Jointly 2024)\nincome_tax = (23200 * 0.10) + ((taxable_income - 23200) * 0.12)  # They remain in the 12% bracket\n\n# Add Current Child Tax Credit (2 kids * $2,000 max, partially refundable)\nchild_tax_credit = 4000\nnet_income_tax = income_tax - child_tax_credit\nif net_income_tax < 0: \n    net_income_tax = 0\n\ncurrent_take_home = base_cash_wage - employee_payroll - net_income_tax"
        if target_m in source:
            rep_m = """# 2. Calculate Current System Take-Home
employee_payroll = base_cash_wage * 0.0765
taxable_income = base_cash_wage - 29200  # Standard Deduction (Married Filing Jointly 2024)
income_tax = (23200 * 0.10) + ((max(0, taxable_income) - 23200) * 0.12) if taxable_income > 23200 else (max(0, taxable_income) * 0.10)

# Add Current Child Tax Credit (2 kids * $2,000 max, partially refundable)
child_tax_credit = 4000
# ACTC formula for 2024: 15% of earned income above 2500, max 1700 per child
actc_max = 2 * 1700
actc_income_limit = max(0, (base_cash_wage - 2500) * 0.15)
refundable_ctc = min(child_tax_credit, max(0, child_tax_credit - income_tax), actc_max, actc_income_limit)
non_refundable_ctc = min(income_tax, child_tax_credit)

# EITC (Married, 2 children)
eitc = max(0, min(6960, base_cash_wage * 0.40) - max(0, base_cash_wage - 29640) * 0.2106) if base_cash_wage < 62688 else 0

net_income_tax = income_tax - non_refundable_ctc - refundable_ctc - eitc

current_take_home = base_cash_wage - employee_payroll - net_income_tax"""
            new_source = source.replace(target_m, rep_m)
            cell['source'] = [line + '\n' for line in new_source.split('\n')]
            cell['source'] = [line.replace('\n\n', '\n') for line in cell['source']]
            if not source.endswith('\n') and cell['source'][-1].endswith('\n'):
                cell['source'][-1] = cell['source'][-1][:-1]

        # Scenario 3: plot
        target_p = "    # Child Tax Credit\n    current_ctc = num_children * 2000\n    net_income_tax = max(0, income_tax - current_ctc)\n    \n    current_take_home = base_cash_wage - employee_payroll_tax - net_income_tax - employee_health_cost\n    current_wedge = ((gross_employer_cost - current_take_home - total_health_cost - pension_cost) / gross_employer_cost) * 100"
        if target_p in source:
            rep_p = """    # EITC (2024 parameters)
    current_eitc = 0
    if status == 'single':
        if num_children == 0:
            current_eitc = max(0, min(632, pre_tax_wage * 0.0765) - max(0, pre_tax_wage - 10330) * 0.0765) if pre_tax_wage < 18591 else 0
        elif num_children == 1:
            current_eitc = max(0, min(4213, pre_tax_wage * 0.34) - max(0, pre_tax_wage - 22720) * 0.1598) if pre_tax_wage < 49084 else 0
        elif num_children == 2:
            current_eitc = max(0, min(6960, pre_tax_wage * 0.40) - max(0, pre_tax_wage - 22720) * 0.2106) if pre_tax_wage < 55768 else 0
        else:
            current_eitc = max(0, min(7830, pre_tax_wage * 0.45) - max(0, pre_tax_wage - 22720) * 0.2106) if pre_tax_wage < 59899 else 0
    else: # married
        if num_children == 0:
            current_eitc = max(0, min(632, pre_tax_wage * 0.0765) - max(0, pre_tax_wage - 17250) * 0.0765) if pre_tax_wage < 25511 else 0
        elif num_children == 1:
            current_eitc = max(0, min(4213, pre_tax_wage * 0.34) - max(0, pre_tax_wage - 29640) * 0.1598) if pre_tax_wage < 56004 else 0
        elif num_children == 2:
            current_eitc = max(0, min(6960, pre_tax_wage * 0.40) - max(0, pre_tax_wage - 29640) * 0.2106) if pre_tax_wage < 62688 else 0
        else:
            current_eitc = max(0, min(7830, pre_tax_wage * 0.45) - max(0, pre_tax_wage - 29640) * 0.2106) if pre_tax_wage < 66819 else 0

    # Child Tax Credit & Refundable CTC (ACTC)
    current_ctc = num_children * 2000
    actc_max = num_children * 1700
    actc_income_limit = max(0, (pre_tax_wage - 2500) * 0.15)
    refundable_ctc = min(current_ctc, max(0, current_ctc - income_tax), actc_max, actc_income_limit)
    non_refundable_ctc = min(income_tax, current_ctc)

    net_income_tax = income_tax - non_refundable_ctc - refundable_ctc - current_eitc
    
    current_take_home = base_cash_wage - employee_payroll_tax - net_income_tax - employee_health_cost
    current_tax = gross_employer_cost - current_take_home - total_health_cost - pension_cost
    current_wedge = (current_tax / gross_employer_cost) * 100"""
            new_source = source.replace(target_p, rep_p)
            cell['source'] = [line + '\n' for line in new_source.split('\n')]
            cell['source'] = [line.replace('\n\n', '\n') for line in cell['source']]
            if not source.endswith('\n') and cell['source'][-1].endswith('\n'):
                cell['source'][-1] = cell['source'][-1][:-1]

with open('Tax_Reform_Modeling.ipynb', 'w') as f:
    json.dump(nb, f, indent=1)
