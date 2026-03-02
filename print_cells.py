import json

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'
with open(nb_path, 'r') as f:
    nb = json.load(f)

for i in [11, 12]:
    print(f"Cell {i}:")
    print(''.join(nb['cells'][i]['source']))
    print("-" * 50)
