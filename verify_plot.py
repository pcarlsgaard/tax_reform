import json
import matplotlib.pyplot as plt
import numpy as np
import re

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'

with open(nb_path, 'r') as f:
    nb = json.load(f)

raw_code = ""
for c in reversed(nb['cells']):
    if c['cell_type'] == 'code' and 'plot_reform_impact' in ''.join(c['source']):
        raw_code = ''.join(c['source'])
        break

# Safely extract and format executable code
exec_code = raw_code.replace('plt.show()', '')

# Execute
print("Running plot logic...")
exec(exec_code)
print("Done.")

# Verify creation
import glob
print("Generated images:", glob.glob("Reform_Impact*.png"))
