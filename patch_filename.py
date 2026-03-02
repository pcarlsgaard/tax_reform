import json

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'

with open(nb_path, 'r') as f:
    nb = json.load(f)

for i, cell in enumerate(reversed(nb['cells'])):
    if cell['cell_type'] == 'code' and 'plot_reform_impact' in ''.join(cell['source']):
        new_source = []
        for line in cell['source']:
            if "plot_filename = f'Reform_Impact" in line:
                new_source.append("    plot_filename = f'Reform_Impact_{rate*100:.0f}pct_${adult_credit}.png'\\n")
            else:
                new_source.append(line)
        nb['cells'][len(nb['cells']) - 1 - i]['source'] = new_source
        break

with open(nb_path, 'w') as f:
    json.dump(nb, f, indent=1)
