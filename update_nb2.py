import json

with open('Tax_Reform_Modeling.ipynb', 'r') as f:
    nb = json.load(f)

new_md = {
    "cell_type": "markdown",
    "metadata": {},
    "source": [
        "## 5. Healthcare Insurance Reform\n",
        "\n",
        "A separate reform for healthcare insurance proposes that the average insurance premium per person will be $7,700 yearly for each adult. The government will provide subsidies that cap an individual's premium contribution at 25% of their disposable income (defined as income above the 2024 Federal Poverty Level for their family size)."
    ]
}

new_code = {
    "cell_type": "code",
    "execution_count": None,
    "metadata": {},
    "outputs": [],
    "source": [
        "def calculate_healthcare_subsidy(income, status='single', num_children=0):\n",
        "    \"\"\"\n",
        "    Calculates the healthcare insurance premium, individual contribution, \n",
        "    and government subsidy under the proposed healthcare reform.\n",
        "    \"\"\"\n",
        "    # 1. Calculate 2024 Federal Poverty Level (FPL)\n",
        "    # Base: $15,060 for 1 person, +$5,380 for each additional person\n",
        "    num_adults = 1 if status == 'single' else 2\n",
        "    family_size = num_adults + num_children\n",
        "    fpl = 15060 + (family_size - 1) * 5380\n",
        "    \n",
        "    # 2. Total premium cost ($7,700 per adult)\n",
        "    total_premium = num_adults * 7700\n",
        "    \n",
        "    # 3. Disposable income (Income above FPL)\n",
        "    disposable_income = max(0, income - fpl)\n",
        "    \n",
        "    # 4. Individual contribution (capped at 25% of disposable income)\n",
        "    individual_capped_contribution = disposable_income * 0.25\n",
        "    individual_contribution = min(total_premium, individual_capped_contribution)\n",
        "    \n",
        "    # 5. Government subsidy\n",
        "    government_subsidy = total_premium - individual_contribution\n",
        "    \n",
        "    return {\n",
        "        'family_size': family_size,\n",
        "        'fpl': fpl,\n",
        "        'income': income,\n",
        "        'disposable_income': disposable_income,\n",
        "        'total_premium': total_premium,\n",
        "        'individual_contribution': individual_contribution,\n",
        "        'government_subsidy': government_subsidy\n",
        "    }\n",
        "\n",
        "print('--- Healthcare Reform Examples ---')\n",
        "print('1. Single Adult earning $30,000')\n",
        "res1 = calculate_healthcare_subsidy(30000, 'single', 0)\n",
        "print(f\"  FPL: ${res1['fpl']:,} | Disposable Income: ${res1['disposable_income']:,.0f}\")\n",
        "print(f\"  Premium: ${res1['total_premium']:,} | Individual Pays: ${res1['individual_contribution']:,.0f} | Gov Subsidy: ${res1['government_subsidy']:,.0f}\\n\")\n",
        "\n",
        "print('2. Married Family of 4 earning $60,000')\n",
        "res2 = calculate_healthcare_subsidy(60000, 'married', 2)\n",
        "print(f\"  FPL: ${res2['fpl']:,} | Disposable Income: ${res2['disposable_income']:,.0f}\")\n",
        "print(f\"  Premium: ${res2['total_premium']:,} | Individual Pays: ${res2['individual_contribution']:,.0f} | Gov Subsidy: ${res2['government_subsidy']:,.0f}\\n\")\n",
        "\n",
        "print('3. Married Family of 4 earning $150,000')\n",
        "res3 = calculate_healthcare_subsidy(150000, 'married', 2)\n",
        "print(f\"  FPL: ${res3['fpl']:,} | Disposable Income: ${res3['disposable_income']:,.0f}\")\n",
        "print(f\"  Premium: ${res3['total_premium']:,} | Individual Pays: ${res3['individual_contribution']:,.0f} | Gov Subsidy: ${res3['government_subsidy']:,.0f}\\n\")\n"
    ]
}

nb['cells'].extend([new_md, new_code])

with open('Tax_Reform_Modeling.ipynb', 'w') as f:
    json.dump(nb, f, indent=1)
