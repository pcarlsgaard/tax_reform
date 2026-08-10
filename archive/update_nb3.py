import json
import sys

with open('Tax_Reform_Modeling.ipynb', 'r') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source_text = "".join(cell['source'])
        
        if "def calculate_tax_wedge(" in source_text:
            cell['source'] = [
                "from tax_reform_utils import calculate_tax_wedge, plot_reform_impact\n\n",
                "# Let's visualize the revenue neutral $4800 / 25% scenario\n",
                "plot_reform_impact(rate=0.25, adult_credit=4800, child_credit=4800)\n"
            ]
        elif "def calculate_healthcare_subsidy(" in source_text:
            idx = 0
            for i, line in enumerate(cell['source']):
                if "print('--- Healthcare Reform Examples ---')" in line:
                    idx = i
                    break
            
            if idx > 0:
                cell['source'] = ["from tax_reform_utils import calculate_healthcare_subsidy\n\n"] + cell['source'][idx:]

with open('Tax_Reform_Modeling.ipynb', 'w') as f:
    json.dump(nb, f, indent=1)
