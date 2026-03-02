import json

nb_path = r'c:\Users\S206053\.gemini\antigravity\playground\azure-curie\Tax_Reform_Modeling.ipynb'
with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for c in nb['cells']:
    if c['cell_type'] == 'code':
        src = ''.join(c['source'])
        if 'def calculate_tax_wedge' in src:
            # removing plt.show is useful for headless execution
            exec_code = src.replace('plt.show()', '')
            break

try:
    # Execute the functions definitions
    exec(exec_code)
    # Now call the function to produce the PNG
    eval('plot_reform_impact(rate=0.25, adult_credit=4800, child_credit=4800)')
    print("Execution completed.")
except Exception as e:
    print("Execution failed:", e)

