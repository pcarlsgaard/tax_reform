import pandas as pd
import numpy as np

# Initial Parameters
adult_pop = 258e6
child_pop = 74e6
base = 19.8 # Tax base in Trillions
target = 4.3 # Target revenue in Trillions

# Vectors for Rates and Credits
rates = np.array([0.20, 0.225, 0.25, 0.27, 0.30, 0.325, 0.35])
credits = np.array([1200, 2400, 3600, 4800, 6000, 7200, 8400])

# Using meshgrid to vectorize the operations over all combinations
R, C = np.meshgrid(rates, credits, indexing='ij')

# Calculations vectorized
# We assume 70% absorption of non-refundable adult credit
credit_cost = ((adult_pop * C * 0.70) + (child_pop * C)) / 1e12
net_tax = (base * R) - credit_cost
gap = net_tax - target

# Create DataFrame
df = pd.DataFrame(gap, index=[f"{r*100:.1f}%" for r in rates], columns=[f"${c}" for c in credits])

# Formatting the output matrix
formatted_df = df.map(lambda x: f"+${x:.2f}T" if x >= 0 else f"-${abs(x):.2f}T")

print("--- REVENUE PARITY SENSITIVITY TABLE ---")
print("Shows the gap vs $4.3T Target Revenue (Surplus is +, Deficit is -)\n")
print(formatted_df.to_string())
