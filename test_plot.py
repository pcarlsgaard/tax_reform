import json
import matplotlib.pyplot as plt
import numpy as np

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'

with open(nb_path, 'r') as f:
    nb = json.load(f)

# Find the code from the notebook
code_block = ""
for c in reversed(nb['cells']):
    if c['cell_type'] == 'code' and 'plot_reform_impact' in ''.join(c['source']):
        code_block = ''.join(c['source'])
        break

# Manual string replacement to fix the notebook cell
code_lines = code_block.split('\\n')
new_lines = []
for line in code_lines:
    if "plot_filename = f'Reform_Impact" in line:
        new_lines.append("    plot_filename = f'Reform_Impact_{rate*100:.0f}pct_${adult_credit}.png'")
    else:
        new_lines.append(line)
        
fixed_code = '\\n'.join(new_lines)

# Write back to notebook
for i, c in enumerate(reversed(nb['cells'])):
    if c['cell_type'] == 'code' and 'plot_reform_impact' in ''.join(c['source']):
        nb['cells'][len(nb['cells']) - 1 - i]['source'] = [line + '\\n' for line in new_lines]
        break

with open(nb_path, 'w') as f:
    json.dump(nb, f, indent=1)

# Execute the fixed code directly (removing plt.show() for the headless script)
exec_code = fixed_code.replace('plt.show()', '')
print("Executing fixed code...")
exec(exec_code)
print("Execution complete.")
