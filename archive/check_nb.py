import json

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'
with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for i, c in enumerate(nb['cells']):
    if c['cell_type'] == 'code':
        src = ''.join(c['source'])
        if 'def calculate_tax_wedge' in src:
            print(f"Cell {i} has calculate_tax_wedge:")
            # Just print the bracket logic to keep output short
            lines = src.split('\n')
            for i, line in enumerate(lines):
                if 'brackets =' in line or 'Simplified Tax Brackets' in line:
                    print('\n'.join(lines[i-1:i+15]))
            print("-" * 50)
