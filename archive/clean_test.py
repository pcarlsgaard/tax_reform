import matplotlib.pyplot as plt
import numpy as np

def calculate_tax_wedge(base_cash_wage, status='single', num_children=0, 
                         rate=0.25, adult_credit=4800, child_credit=4800):
    # Calculations ...
    health_ratio = 0.094 if status == 'single' else 0.18
    pension_ratio = 0.049
    payroll_ratio = 0.070
    
    health_cost = base_cash_wage * health_ratio
    pension_cost = base_cash_wage * pension_ratio
    employer_payroll = base_cash_wage * payroll_ratio
    gross_employer_cost = base_cash_wage + health_cost + pension_cost + employer_payroll
    
    std_deduction = 14600 if status == 'single' else 29200
    employee_payroll = base_cash_wage * 0.0765
    taxable_income = max(0, base_cash_wage - std_deduction)
    
    if status == 'single':
        income_tax = (min(taxable_income, 11600) * 0.10) + \
                     (max(0, min(taxable_income, 47150) - 11600) * 0.12) + \
                     (max(0, taxable_income - 47150) * 0.22)
    else: 
        income_tax = (min(taxable_income, 23200) * 0.10) + \
                     (max(0, taxable_income - 23200) * 0.12)
        
    current_ctc = num_children * 2000
    net_income_tax = max(0, income_tax - current_ctc)
    
    current_take_home = base_cash_wage - employee_payroll - net_income_tax
    current_wedge = ((gross_employer_cost - current_take_home - health_cost - pension_cost) / gross_employer_cost) * 100
    
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
    wages = np.linspace(20000, 200000, 50)
    
    single_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': []}
    family_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': []}
    
    for w in wages:
        s_res = calculate_tax_wedge(w, 'single', 0, rate, adult_credit, child_credit)
        single_data['costs'].append(s_res['gross_cost'])
        single_data['c_take'].append(s_res['current_take_home'])
        single_data['n_take'].append(s_res['new_take_home'])
        single_data['c_wedge'].append(s_res['current_wedge'])
        single_data['n_wedge'].append(s_res['new_wedge'])
        
        f_res = calculate_tax_wedge(w, 'married', 2, rate, adult_credit, child_credit)
        family_data['costs'].append(f_res['gross_cost'])
        family_data['c_take'].append(f_res['current_take_home'])
        family_data['n_take'].append(f_res['new_take_home'])
        family_data['c_wedge'].append(f_res['current_wedge'])
        family_data['n_wedge'].append(f_res['new_wedge'])
        
    fig, axs = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle(f'Reform Impact Analysis (Rate: {rate*100:.1f}%, Adult Credit: ${adult_credit}, Child Credit: ${child_credit})', fontsize=16, y=0.98)
    
    axs[0, 0].plot(single_data['costs'], single_data['c_take'], label='Current System', color='grey', linestyle='--')
    axs[0, 0].plot(single_data['costs'], single_data['n_take'], label='Proposed Reform', color='blue', linewidth=2)
    axs[0, 0].set_title('Single (0 Children): Take-Home Pay')
    axs[0, 0].set_ylabel('Annual Take-Home Cash ($)')
    axs[0, 0].legend()
    axs[0, 0].grid(True, alpha=0.3)
    
    axs[0, 1].plot(single_data['costs'], single_data['c_wedge'], label='Current Wedge', color='grey', linestyle='--')
    axs[0, 1].plot(single_data['costs'], single_data['n_wedge'], label='New Wedge', color='red', linewidth=2)
    axs[0, 1].set_title('Single (0 Children): Tax Wedge (%)')
    axs[0, 1].set_ylabel('Average Tax Wedge (%)')
    axs[0, 1].legend()
    axs[0, 1].grid(True, alpha=0.3)
    
    axs[1, 0].plot(family_data['costs'], family_data['c_take'], label='Current System', color='grey', linestyle='--')
    axs[1, 0].plot(family_data['costs'], family_data['n_take'], label='Proposed Reform', color='blue', linewidth=2)
    axs[1, 0].set_title('Married (2 Children): Take-Home Pay')
    axs[1, 0].set_xlabel('Total Gross Employer Cost ($)')
    axs[1, 0].set_ylabel('Annual Take-Home Cash ($)')
    axs[1, 0].legend()
    axs[1, 0].grid(True, alpha=0.3)
    
    axs[1, 1].plot(family_data['costs'], family_data['c_wedge'], label='Current Wedge', color='grey', linestyle='--')
    axs[1, 1].plot(family_data['costs'], family_data['n_wedge'], label='New Wedge', color='red', linewidth=2)
    axs[1, 1].set_title('Married (2 Children): Tax Wedge (%)')
    axs[1, 1].set_xlabel('Total Gross Employer Cost ($)')
    axs[1, 1].set_ylabel('Average Tax Wedge (%)')
    axs[1, 1].legend()
    axs[1, 1].grid(True, alpha=0.3)
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plot_filename = f'Reform_Impact_{rate*100:.0f}pct_${adult_credit}.png'
    plt.savefig(plot_filename, dpi=300, bbox_inches='tight')
    print(f"Plot saved successfully as '{plot_filename}'")

plot_reform_impact(rate=0.25, adult_credit=4800, child_credit=4800)
