import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker

def calculate_healthcare_subsidy(income, status='single', num_children=0):
    """
    Calculates the healthcare insurance premium, individual contribution, 
    and government subsidy under the proposed healthcare reform.
    """
    # 1. Calculate 2024 Federal Poverty Level (FPL)
    # Base: $15,060 for 1 person, +$5,380 for each additional person
    num_adults = 1 if status == 'single' else 2
    family_size = num_adults + num_children
    fpl = 15060 + (family_size - 1) * 5380
    
    # 2. Total premium cost ($7,700 per adult)
    total_premium = num_adults * 7700
    
    # 3. Disposable income (Income above FPL)
    disposable_income = max(0, income - fpl)
    
    # 4. Individual contribution (capped at 25% of disposable income)
    individual_capped_contribution = disposable_income * 0.25
    individual_contribution = min(total_premium, individual_capped_contribution)
    
    # 5. Government subsidy
    government_subsidy = total_premium - individual_contribution
    
    return {
        'family_size': family_size,
        'fpl': fpl,
        'income': income,
        'disposable_income': disposable_income,
        'total_premium': total_premium,
        'individual_contribution': individual_contribution,
        'government_subsidy': government_subsidy
    }

def calculate_tax_wedge(base_cash_wage, status='single', num_children=0, 
                         rate=0.25, adult_credit=4800, child_credit=4800, health_reform=False):
    #Calculates the tax wedge and take-home pay for both current and proposed systems.
    
    # --- Healthcare Costs (Fixed) ---
    employer_health_cost = 7583 if status == 'single' else 19276
    employee_health_cost = 1368 if status == 'single' else 6296
    total_health_cost = employer_health_cost + employee_health_cost

    # --- Other Ratios (Fixed) ---
    pension_ratio = 0.049
    payroll_ratio = 0.070

    # Pre-tax wage for current system calculation
    pre_tax_wage = max(0, base_cash_wage - employee_health_cost)

    # Payroll Tax Calculations (2024)
    ss_tax = min(pre_tax_wage, 168600) * 0.062
    medicare_tax = pre_tax_wage * 0.0145
    addl_medicare = max(0, pre_tax_wage - 200000) * 0.009 if status == 'single' else max(0, pre_tax_wage - 250000) * 0.009
    
    # 1. Gross Employer Cost
    pension_cost = base_cash_wage * pension_ratio
    employer_payroll = base_cash_wage * payroll_ratio
    gross_employer_cost = base_cash_wage + employer_health_cost + pension_cost + employer_payroll
    
    # 2. Current System Take-Home
    # Standard Deduction (2024)
    std_deduction = 14600 if status == 'single' else 29200
    employee_payroll_tax = ss_tax + medicare_tax + addl_medicare
    taxable_income = max(0, pre_tax_wage - std_deduction)
    
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
        
    # EITC (2024 parameters)
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
    current_wedge = (current_tax / gross_employer_cost) * 100
    
    # 3. Proposed System
    total_credit = (adult_credit * (1 if status == 'single' else 2)) + (child_credit * num_children)
    
    gross_tax_liability = gross_employer_cost * rate

    #include a multiplier to the gross tax liability to act as a wage boost at low income levels
    boost = 1 + rate

    if status == 'single':
        adult_offset = min(gross_tax_liability * boost, adult_credit)
        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)
    else:
        adult_offset = min(gross_tax_liability * boost, adult_credit * 2)
        final_tax = gross_tax_liability - adult_offset - (num_children * child_credit)

    
    if health_reform == True:
        healthcare_calc = calculate_healthcare_subsidy(gross_employer_cost - final_tax, status=status, num_children=num_children)
        new_total_health_cost = healthcare_calc['individual_contribution']
    else:
        new_total_health_cost = total_health_cost


    new_take_home = gross_employer_cost - final_tax - new_total_health_cost - pension_cost
    new_wedge = (final_tax / gross_employer_cost) * 100
    
    return {
        'gross_cost': gross_employer_cost,
        'current_take_home': current_take_home,
        'current_wedge': current_wedge,
        'new_take_home': new_take_home,
        'new_wedge': new_wedge,
        'current_tax': current_tax,
        'new_tax': final_tax
    }

def plot_reform_impact(rate=0.25, adult_credit=4800, child_credit=4800, health_reform=False):
    # Adjust spacing above 250k: using a concatenated array to maintain high detail in lower income brackets
    # but extending the tail out to $1,000,000 to fully visualize the top 37% bracket.
    wages = np.concatenate((np.linspace(1000, 250000, 50), np.linspace(260000, 1000000, 50)))
    
    single_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': [], 'c_marg': [], 'n_marg': []}
    family_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': [], 'c_marg': [], 'n_marg': []}
    
    for w in wages:
        # Single Scenario (0 children)
        s_res = calculate_tax_wedge(w, 'single', 0, rate, adult_credit, child_credit, health_reform)
        s_res_up = calculate_tax_wedge(w + 10, 'single', 0, rate, adult_credit, child_credit)
        s_c_marg = (s_res_up['current_tax'] - s_res['current_tax']) / (s_res_up['gross_cost'] - s_res['gross_cost']) * 100
        s_n_marg = (s_res_up['new_tax'] - s_res['new_tax']) / (s_res_up['gross_cost'] - s_res['gross_cost']) * 100
        
        single_data['costs'].append(s_res['gross_cost'])
        single_data['c_take'].append(s_res['current_take_home'])
        single_data['n_take'].append(s_res['new_take_home'])
        single_data['c_wedge'].append(s_res['current_wedge'])
        single_data['n_wedge'].append(s_res['new_wedge'])
        single_data['c_marg'].append(s_c_marg)
        single_data['n_marg'].append(s_n_marg)
        
        # Family Scenario (Married, 2 children)
        f_res = calculate_tax_wedge(w, 'married', 2, rate, adult_credit, child_credit, health_reform)
        f_res_up = calculate_tax_wedge(w + 10, 'married', 2, rate, adult_credit, child_credit, health_reform)
        f_c_marg = (f_res_up['current_tax'] - f_res['current_tax']) / (f_res_up['gross_cost'] - f_res['gross_cost']) * 100
        f_n_marg = (f_res_up['new_tax'] - f_res['new_tax']) / (f_res_up['gross_cost'] - f_res['gross_cost']) * 100
        
        family_data['costs'].append(f_res['gross_cost'])
        family_data['c_take'].append(f_res['current_take_home'])
        family_data['n_take'].append(f_res['new_take_home'])
        family_data['c_wedge'].append(f_res['current_wedge'])
        family_data['n_wedge'].append(f_res['new_wedge'])
        family_data['c_marg'].append(f_c_marg)
        family_data['n_marg'].append(f_n_marg)
        
    fig, axs = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle(f'Reform Impact Analysis (Rate: {rate*100:.1f}%, Adult Credit: ${adult_credit}, Child Credit: ${child_credit})', fontsize=16, y=0.98)

    plt.ticker = matplotlib.ticker
    
    # Formatter for better tick labels at high values (1M)
    formatter = plt.ticker.StrMethodFormatter('${x:,.0f}')
    

    # --- TOP ROW: SINGLE ---
    # Top-Left: Take Home Pay (Single)
    axs[0, 0].plot(single_data['costs'], single_data['c_take'], label='Current System', color='grey', linestyle='--')
    axs[0, 0].plot(single_data['costs'], single_data['n_take'], label='Proposed Reform', color='blue', linewidth=2)
    axs[0, 0].set_title('Single (0 Children): Take-Home Pay')
    axs[0, 0].set_ylabel('Annual Take-Home Cash ($)')
    axs[0, 0].xaxis.set_major_formatter(formatter)
    axs[0, 0].legend()
    axs[0,0].set_xscale('log')
    axs[0,0].set_yscale('log')
    axs[0, 0].grid(True, alpha=0.3)
    
    # Top-Right: Tax Wedge (Single)
    axs[0, 1].plot(single_data['costs'], single_data['c_wedge'], label='Current Avg', color='grey', linestyle='--')
    axs[0, 1].plot(single_data['costs'], single_data['n_wedge'], label='New Avg', color='red', linewidth=2)
    axs[0, 1].plot(single_data['costs'], single_data['c_marg'], label='Current Marg', color='black', linestyle=':')
    axs[0, 1].plot(single_data['costs'], single_data['n_marg'], label='New Marg', color='darkorange', linewidth=2, linestyle='-.')
    axs[0, 1].set_title('Single (0 Children): Tax Wedge (%)')
    axs[0, 1].set_ylabel('Tax Wedge (%)')
    axs[0, 1].xaxis.set_major_formatter(formatter)
    axs[0, 1].legend()
    axs[0,1].set_xscale('log')
    axs[0,1].set_yscale('linear')
    axs[0,1].set_ylim(0, 50)
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
    axs[1,0].set_xscale('log')
    axs[1,0].set_yscale('log')
    axs[1, 0].grid(True, alpha=0.3)
    
    # Bottom-Right: Tax Wedge (Family)
    axs[1, 1].plot(family_data['costs'], family_data['c_wedge'], label='Current Avg', color='grey', linestyle='--')
    axs[1, 1].plot(family_data['costs'], family_data['n_wedge'], label='New Avg', color='red', linewidth=2)
    axs[1, 1].plot(family_data['costs'], family_data['c_marg'], label='Current Marg', color='black', linestyle=':')
    axs[1, 1].plot(family_data['costs'], family_data['n_marg'], label='New Marg', color='darkorange', linewidth=2, linestyle='-.')
    axs[1, 1].set_title('Married (2 Children): Tax Wedge (%)')
    axs[1, 1].set_xlabel('Total Gross Employer Cost ($)')
    axs[1, 1].set_ylabel('Tax Wedge (%)')
    axs[1, 1].xaxis.set_major_formatter(formatter)
    axs[1, 1].legend()
    axs[1,1].set_xscale('log')
    axs[1,1].set_yscale('linear')
    axs[1,1].set_ylim(0, 50)
    axs[1, 1].grid(True, alpha=0.3)
    
    # Format axes to show whole numbers instead of scientific notation on log scales
    for ax in axs.flat:
        ax.xaxis.set_major_formatter(plt.ticker.StrMethodFormatter('${x:,.0f}'))
        
    # Y-axis for Take-Home Pay (Left Column)
    for ax in [axs[0, 0], axs[1, 0]]:
        ax.yaxis.set_major_formatter(plt.ticker.StrMethodFormatter('${x:,.0f}'))
        
    # Y-axis for Tax Wedge (Right Column)
    for ax in [axs[0, 1], axs[1, 1]]:
        ax.yaxis.set_major_formatter(plt.ticker.StrMethodFormatter('{x:.0f}%'))

    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plot_filename = f'Reform_Impact_{rate*100:.0f}pct_${adult_credit}.png'
    plt.savefig(plot_filename, dpi=300, bbox_inches='tight')
    print(f"Plot saved successfully as '{plot_filename}'")
    plt.show()



