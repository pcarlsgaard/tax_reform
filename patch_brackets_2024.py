import json

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'

with open(nb_path, 'r') as f:
    nb = json.load(f)

new_code = """import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

def calculate_tax_wedge(base_cash_wage, status='single', num_children=0, 
                         rate=0.25, adult_credit=4800, child_credit=4800):
    \"\"\"
    Calculates the tax wedge and take-home pay for both current and proposed systems.
    \"\"\"
    # --- Ratios (Fixed) ---
    health_ratio = 0.094 if status == 'single' else 0.18 # Higher for families
    pension_ratio = 0.049
    payroll_ratio = 0.070
    
    # 1. Gross Employer Cost
    health_cost = base_cash_wage * health_ratio
    pension_cost = base_cash_wage * pension_ratio
    employer_payroll = base_cash_wage * payroll_ratio
    gross_employer_cost = base_cash_wage + health_cost + pension_cost + employer_payroll
    
    # 2. Current System Take-Home
    # Standard Deduction (2024)
    std_deduction = 14600 if status == 'single' else 29200
    employee_payroll = base_cash_wage * 0.0765
    taxable_income = max(0, base_cash_wage - std_deduction)
    
    # Full 2024 IRS Tax Brackets
    income_tax = 0.0
    if status == 'single':
        brackets = [
            (11925, 0.10),
            (48475, 0.12),
            (103350, 0.22),
            (197300, 0.24),
            (250525, 0.32),
            (626350, 0.35),
            (float('inf'), 0.37)
        ]
    else: # Married Filing Jointly
        brackets = [
            (23850, 0.10),
            (96950, 0.12),
            (206700, 0.22),
            (394600, 0.24),
            (501050, 0.32),
            (751600, 0.35),
            (float('inf'), 0.37)
        ]
        
    prev_limit = 0
    for limit, r in brackets:
        if taxable_income > prev_limit:
            taxable_in_bracket = min(taxable_income, limit) - prev_limit
            income_tax += taxable_in_bracket * r
            prev_limit = limit
        else:
            break
        
    # Child Tax Credit
    current_ctc = num_children * 2000
    net_income_tax = max(0, income_tax - current_ctc)
    
    current_take_home = base_cash_wage - employee_payroll - net_income_tax
    current_wedge = ((gross_employer_cost - current_take_home - health_cost - pension_cost) / gross_employer_cost) * 100
    
    # 3. Proposed System
    total_credit = (adult_credit * (1 if status == 'single' else 2)) + (child_credit * num_children)
    
    gross_tax_liability = gross_employer_cost * rate
    if status == 'single':
        adult_offset = min(gross_tax_liability, adult_credit)
        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)
    else:
        adult_offset = min(gross_tax_liability, adult_credit * 2)
        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)
        
    new_take_home = gross_employer_cost - final_tax - health_cost - pension_cost
    new_wedge = (final_tax / gross_employer_cost) * 100
    
    return {
        'gross_cost': gross_employer_cost,
        'current_take_home': current_take_home,
        'current_wedge': current_wedge,
        'new_take_home': new_take_home,
        'new_wedge': new_wedge
    }

def plot_reform_impact(rate=0.25, adult_credit=4800, child_credit=4800):
    # Adjust spacing above 250k: using a concatenated array to maintain high detail in lower income brackets
    # but extending the tail out to $1,000,000 to fully visualize the top 37% bracket.
    wages = np.concatenate((np.linspace(20000, 250000, 50), np.linspace(260000, 1000000, 50)))
    
    single_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': []}
    family_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': []}
    
    for w in wages:
        # Single Scenario (0 children)
        s_res = calculate_tax_wedge(w, 'single', 0, rate, adult_credit, child_credit)
        single_data['costs'].append(s_res['gross_cost'])
        single_data['c_take'].append(s_res['current_take_home'])
        single_data['n_take'].append(s_res['new_take_home'])
        single_data['c_wedge'].append(s_res['current_wedge'])
        single_data['n_wedge'].append(s_res['new_wedge'])
        
        # Family Scenario (Married, 2 children)
        f_res = calculate_tax_wedge(w, 'married', 2, rate, adult_credit, child_credit)
        family_data['costs'].append(f_res['gross_cost'])
        family_data['c_take'].append(f_res['current_take_home'])
        family_data['n_take'].append(f_res['new_take_home'])
        family_data['c_wedge'].append(f_res['current_wedge'])
        family_data['n_wedge'].append(f_res['new_wedge'])
        
    fig, axs = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle(f'Reform Impact Analysis (Rate: {rate*100:.1f}%, Adult Credit: ${adult_credit}, Child Credit: ${child_credit})', fontsize=16, y=0.98)
    
    # Formatter for better tick labels at high values (1M)
    formatter = ticker.StrMethodFormatter('${x:,.0f}')
    
    # --- TOP ROW: SINGLE ---
    # Top-Left: Take Home Pay (Single)
    axs[0, 0].plot(single_data['costs'], single_data['c_take'], label='Current System', color='grey', linestyle='--')
    axs[0, 0].plot(single_data['costs'], single_data['n_take'], label='Proposed Reform', color='blue', linewidth=2)
    axs[0, 0].set_title('Single (0 Children): Take-Home Pay')
    axs[0, 0].set_ylabel('Annual Take-Home Cash ($)')
    axs[0, 0].xaxis.set_major_formatter(formatter)
    axs[0, 0].legend()
    axs[0, 0].grid(True, alpha=0.3)
    
    # Top-Right: Tax Wedge (Single)
    axs[0, 1].plot(single_data['costs'], single_data['c_wedge'], label='Current Wedge', color='grey', linestyle='--')
    axs[0, 1].plot(single_data['costs'], single_data['n_wedge'], label='New Wedge', color='red', linewidth=2)
    axs[0, 1].set_title('Single (0 Children): Tax Wedge (%)')
    axs[0, 1].set_ylabel('Average Tax Wedge (%)')
    axs[0, 1].xaxis.set_major_formatter(formatter)
    axs[0, 1].legend()
    axs[0, 1].grid(True, alpha=0.3)
    
    # --- BOTTOM ROW: FAMILY ---
    # Bottom-Left: Take Home Pay (Family)
    axs[1, 0].plot(family_data['costs'], family_data['c_take'], label='Current System', color='grey', linestyle='--')
    axs[1, 0].plot(family_data['costs'], family_data['n_take'], label='Proposed Reform', color='blue', linewidth=2)
    axs[1, 0].set_title('Married (2 Children): Take-Home Pay')
    axs[1, 0].set_xlabel('Total Gross Employer Cost ($)')
    axs[1, 0].set_ylabel('Annual Take-Home Cash ($)')
    axs[1, 0].xaxis.set_major_formatter(formatter)
    axs[1, 0].legend()
    axs[1, 0].grid(True, alpha=0.3)
    
    # Bottom-Right: Tax Wedge (Family)
    axs[1, 1].plot(family_data['costs'], family_data['c_wedge'], label='Current Wedge', color='grey', linestyle='--')
    axs[1, 1].plot(family_data['costs'], family_data['n_wedge'], label='New Wedge', color='red', linewidth=2)
    axs[1, 1].set_title('Married (2 Children): Tax Wedge (%)')
    axs[1, 1].set_xlabel('Total Gross Employer Cost ($)')
    axs[1, 1].set_ylabel('Average Tax Wedge (%)')
    axs[1, 1].xaxis.set_major_formatter(formatter)
    axs[1, 1].legend()
    axs[1, 1].grid(True, alpha=0.3)
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plot_filename = f'Reform_Impact_{rate*100:.0f}pct_${adult_credit}.png'
    plt.savefig(plot_filename, dpi=300, bbox_inches='tight')
    print(f"Plot saved successfully as '{plot_filename}'")
    plt.show()

# Run for a Revenue Neutral Parity Scenario (e.g., 25% rate, $4800 credits)
plot_reform_impact(rate=0.25, adult_credit=4800, child_credit=4800)
"""

target_idx = -1
for i, c in enumerate(nb['cells']):
    if c['cell_type'] == 'code' and 'plot_reform_impact' in "".join(c['source']):
        target_idx = i

if target_idx != -1:
    lines = [line + '\\n' for line in new_code.split('\\n')]
    if lines:
        lines[-1] = lines[-1].replace('\\n', '')
    nb['cells'][target_idx]['source'] = lines

with open(nb_path, 'w') as f:
    json.dump(nb, f, indent=1)

print("Notebook updated successfully.")
