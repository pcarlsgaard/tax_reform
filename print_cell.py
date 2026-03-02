import json

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'
with open(nb_path, 'r') as f:
    nb = json.load(f)

for i, c in enumerate(nb['cells']):
    if c['cell_type'] == 'code':
        src = ''.join(c['source'])
        if 'def calculate_tax_wedge' in src:
            print(src)
            print("-" * 50)
