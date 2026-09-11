import json

with open("c:/Users/S206053/.gemini/antigravity/playground/azure-curie/Tax_Reform_Modeling.ipynb", "r") as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = "".join(cell['source'])
        
        # replacement 1
        t1 = r"""    return {
        'gross_cost': gross_employer_cost,
        'current_take_home': current_take_home,
        'current_wedge': current_wedge,
        'new_take_home': new_take_home,
        'new_wedge': new_wedge
    }"""
        r1 = r"""    return {
        'gross_cost': gross_employer_cost,
        'current_take_home': current_take_home,
        'current_wedge': current_wedge,
        'new_take_home': new_take_home,
        'new_wedge': new_wedge,
        'current_tax': gross_employer_cost - current_take_home - health_cost - pension_cost,
        'new_tax': final_tax
    }"""
        source = source.replace(t1, r1)

        # replacement 2
        t2 = r"""    single_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': []}
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
        family_data['n_wedge'].append(f_res['new_wedge'])"""
        r2 = r"""    single_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': [], 'c_marg': [], 'n_marg': []}
    family_data = {'costs': [], 'c_take': [], 'n_take': [], 'c_wedge': [], 'n_wedge': [], 'c_marg': [], 'n_marg': []}
    
    for w in wages:
        # Single Scenario (0 children)
        s_res = calculate_tax_wedge(w, 'single', 0, rate, adult_credit, child_credit)
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
        f_res = calculate_tax_wedge(w, 'married', 2, rate, adult_credit, child_credit)
        f_res_up = calculate_tax_wedge(w + 10, 'married', 2, rate, adult_credit, child_credit)
        f_c_marg = (f_res_up['current_tax'] - f_res['current_tax']) / (f_res_up['gross_cost'] - f_res['gross_cost']) * 100
        f_n_marg = (f_res_up['new_tax'] - f_res['new_tax']) / (f_res_up['gross_cost'] - f_res['gross_cost']) * 100
        
        family_data['costs'].append(f_res['gross_cost'])
        family_data['c_take'].append(f_res['current_take_home'])
        family_data['n_take'].append(f_res['new_take_home'])
        family_data['c_wedge'].append(f_res['current_wedge'])
        family_data['n_wedge'].append(f_res['new_wedge'])
        family_data['c_marg'].append(f_c_marg)
        family_data['n_marg'].append(f_n_marg)"""
        source = source.replace(t2, r2)
        
        # replacement 3
        t3 = r"""    # Top-Right: Tax Wedge (Single)
    axs[0, 1].plot(single_data['costs'], single_data['c_wedge'], label='Current Wedge', color='grey', linestyle='--')
    axs[0, 1].plot(single_data['costs'], single_data['n_wedge'], label='New Wedge', color='red', linewidth=2)
    axs[0, 1].set_title('Single (0 Children): Tax Wedge (%)')
    axs[0, 1].set_ylabel('Average Tax Wedge (%)')"""
        r3 = r"""    # Top-Right: Tax Wedge (Single)
    axs[0, 1].plot(single_data['costs'], single_data['c_wedge'], label='Current Avg', color='grey', linestyle='--')
    axs[0, 1].plot(single_data['costs'], single_data['n_wedge'], label='New Avg', color='red', linewidth=2)
    axs[0, 1].plot(single_data['costs'], single_data['c_marg'], label='Current Marg', color='black', linestyle=':')
    axs[0, 1].plot(single_data['costs'], single_data['n_marg'], label='New Marg', color='darkorange', linewidth=2, linestyle='-.')
    axs[0, 1].set_title('Single (0 Children): Tax Wedge (%)')
    axs[0, 1].set_ylabel('Tax Wedge (%)')"""
        source = source.replace(t3, r3)
        
        # replacement 4
        t4 = r"""    # Bottom-Right: Tax Wedge (Family)
    axs[1, 1].plot(family_data['costs'], family_data['c_wedge'], label='Current Wedge', color='grey', linestyle='--')
    axs[1, 1].plot(family_data['costs'], family_data['n_wedge'], label='New Wedge', color='red', linewidth=2)
    axs[1, 1].set_title('Married (2 Children): Tax Wedge (%)')
    axs[1, 1].set_xlabel('Total Gross Employer Cost ($)')
    axs[1, 1].set_ylabel('Average Tax Wedge (%)')"""
        r4 = r"""    # Bottom-Right: Tax Wedge (Family)
    axs[1, 1].plot(family_data['costs'], family_data['c_wedge'], label='Current Avg', color='grey', linestyle='--')
    axs[1, 1].plot(family_data['costs'], family_data['n_wedge'], label='New Avg', color='red', linewidth=2)
    axs[1, 1].plot(family_data['costs'], family_data['c_marg'], label='Current Marg', color='black', linestyle=':')
    axs[1, 1].plot(family_data['costs'], family_data['n_marg'], label='New Marg', color='darkorange', linewidth=2, linestyle='-.')
    axs[1, 1].set_title('Married (2 Children): Tax Wedge (%)')
    axs[1, 1].set_xlabel('Total Gross Employer Cost ($)')
    axs[1, 1].set_ylabel('Tax Wedge (%)')"""
        source = source.replace(t4, r4)

        if source != "".join(cell['source']):
            print("Successfully made replacements.")
            # split lines back but keeping \n
            import re
            lines = re.split(r'(?<=\n)', source)
            cell['source'] = lines

with open("c:/Users/S206053/.gemini/antigravity/playground/azure-curie/Tax_Reform_Modeling.ipynb", "w") as f:
    json.dump(nb, f, indent=1)
    
print("Notebook saved.")
