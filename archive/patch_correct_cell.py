import json
from patch_brackets_2024 import new_code

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'
with open(nb_path, 'r') as f:
    nb = json.load(f)

# The correct cell is 11. 
lines = [line + '\n' for line in new_code.split('\n')]
lines[-1] = lines[-1].strip('\n')
nb['cells'][11]['source'] = lines

with open(nb_path, 'w') as f:
    json.dump(nb, f, indent=1)
print("Updated Cell 11 successfully!")
