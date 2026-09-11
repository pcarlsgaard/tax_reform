import urllib.request
import csv
import pandas as pd

def get_annual_average(series_id, target_year):
    url = f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        reader = csv.reader(html.strip().split('\n'))
        next(reader) 
        values = []
        for row in reader:
            if len(row) > 1 and row[1] != '.' and row[0].startswith(target_year):
                values.append(float(row[1]))
        return sum(values) / len(values) if values else 0
    except Exception as e:
        print(f'Error fetching {series_id}: {e}')
        return 0

def generate_table(year):
    coe = get_annual_average('COE', year)
    cprofit = get_annual_average('CPROFIT', year)
    propinc = get_annual_average('PROPINC', year)
    netint = get_annual_average('B471RC1Q027SBEA', year) 
    cfc = get_annual_average('COFC', year)
    taxes_pi = get_annual_average('GDITAXES', year) 
    investment = get_annual_average('GPDI', year)
    
    netcap = cprofit + propinc + netint + cfc + taxes_pi - investment
    imports = get_annual_average('IMPGS', year)
    exports = get_annual_average('EXPGS', year)
    net_imports = imports - exports
    hh_inv = get_annual_average('W988RC1A027NBEA', year)
    hh_flow_inc = get_annual_average('B952RC1A027NBEA', year)
    housing_adj = hh_inv - hh_flow_inc
    
    broad_base_before = coe + netcap + net_imports + housing_adj
    non_compliance = -0.15 * broad_base_before
    broad_vat_base = broad_base_before + non_compliance
    gdp = get_annual_average('GDP', year)
    
    data = [
        {'Component': 'Compensation of Employees', 'Billions': coe},
        {'Component': 'Net Capital Income (Profits+Interest+CFC+Excise-Investment)', 'Billions': netcap},
        {'Component': 'Net Imports', 'Billions': net_imports},
        {'Component': 'Housing Adjustment (Household Investment Less Net Housing Value Added)', 'Billions': housing_adj},
        {'Component': 'Non-Compliance (15% rate)', 'Billions': non_compliance},
        {'Component': 'Broad VAT Base (Before Exemptions)', 'Billions': broad_vat_base}
    ]
    
    df = pd.DataFrame(data)
    df['% of GDP'] = (df['Billions'] / gdp) * 100
    
    # Format the columns for display
    df['Billions ($)'] = df['Billions'].apply(lambda x: f'${x:,.1f}')
    df['% of GDP'] = df['% of GDP'].apply(lambda x: f'{x:.1f}%')
    
    # Drop the unformatted column and rearrange
    df = df[['Component', 'Billions ($)', '% of GDP']]
    
    # Print Output
    print(f'\n======== APPENDIX TABLE 1 (Updated {year}) ========')
    print(f'Total GDP for {year}: ${gdp:,.1f} Billion\n')
    print(df.to_string(index=False, justify='right'))

if __name__ == "__main__":
    generate_table('2024')
