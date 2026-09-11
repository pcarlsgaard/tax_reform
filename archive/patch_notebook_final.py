import json
import matplotlib.pyplot as plt
import numpy as np

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'

with open(nb_path, 'r') as f:
    nb = json.load(f)

# The problematic section is saving the figure with a dynamic name.
target_cell_idx = -1
for i, c in enumerate(reversed(nb['cells'])):
    if c['cell_type'] == 'code' and 'plot_reform_impact' in ''.join(c['source']):
        target_cell_idx = len(nb['cells']) - 1 - i
        break

if target_cell_idx != -1:
    source_lines = nb['cells'][target_cell_idx]['source']
    new_source = []
    
    for line in source_lines:
        match = False
        if "plot_filename = " in line and "Reform_Impact" in line:
            # We want to insert our f-string cleanly without messing up the JSON escaping
            new_source.append("    plot_filename = f'Reform_Impact_{rate*100:.0f}pct_${adult_credit}.png'\\n")
            match = True
        elif "plt.savefig(plot_filename" in line:
            new_source.append("    plt.savefig(plot_filename, dpi=300, bbox_inches='tight')\\n")
            match = True
            
        if not match:
            # Add existing lines as-is to preserve exact JSON format
            new_source.append(line)
            
    nb['cells'][target_cell_idx]['source'] = new_source
    
    with open(nb_path, 'w') as f:
        json.dump(nb, f, indent=1)
        
    print("Notebook updated.")
    
    # We will let the notebook handle its own execution to avoid exec() indentation nonsense
