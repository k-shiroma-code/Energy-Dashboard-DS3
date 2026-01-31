import pandas as pd
import numpy as np

# === CONFIGURATION ===
ELEC_PANEL = "energy_access_panel.csv"
SEDS_FILE = "seds_expenditure.csv"
RELIABILITY_FILE = "reliability_by_state_2024.csv"
OUTPUT_FILE = "energy_access_master.csv"

def main():
    print("=== MERGING ENERGY ACCESS DATA ===\n")
    
    # === 1. LOAD ELECTRICITY PANEL ===
    print("Loading electricity panel...")
    elec = pd.read_csv(ELEC_PANEL)
    print(f"  Rows: {len(elec):,}")
    
    # Filter to residential only for access metrics
    elec_res = elec[elec['sector'] == 'RES'].copy()
    
    # Aggregate monthly to annual
    elec_annual = elec_res.groupby(['geography', 'year']).agg({
        'sales_million_kwh': 'sum',
        'price_cents_kwh': 'mean',
        'customers': 'mean'  # Average customers across months
    }).reset_index()
    
    elec_annual.columns = ['state', 'year', 'sales_million_kwh', 'avg_price_cents_kwh', 'avg_customers']
    
    # Calculate per-customer consumption
    elec_annual['kwh_per_customer'] = (elec_annual['sales_million_kwh'] * 1_000_000) / elec_annual['avg_customers']
    
    print(f"  Annual residential rows: {len(elec_annual):,}")
    print(f"  Years: {elec_annual['year'].min()} - {elec_annual['year'].max()}")
    
    # === 2. LOAD SEDS EXPENDITURE ===
    print("\nLoading SEDS expenditure...")
    seds = pd.read_csv(SEDS_FILE)
    seds.columns = ['state', 'year', 'total_energy_expend_pc', 'elec_expend_pc', 
                    'elec_expend_billion', 'total_energy_expend_billion']
    
    # Convert year to int
    seds['year'] = pd.to_numeric(seds['year'], errors='coerce')
    seds = seds.dropna(subset=['year'])
    seds['year'] = seds['year'].astype(int)
    
    print(f"  Rows: {len(seds):,}")
    print(f"  Years: {int(seds['year'].min())} - {int(seds['year'].max())}")
    
    # === 3. LOAD RELIABILITY ===
    print("\nLoading reliability data...")
    reliability = pd.read_csv(RELIABILITY_FILE)
    reliability['year'] = 2024
    reliability = reliability[['state', 'year', 'saidi_wo_med', 'saifi_wo_med', 'total_customers', 'utility_count']]
    reliability.columns = ['state', 'year', 'saidi', 'saifi', 'reliability_customers', 'utility_count']
    print(f"  States: {len(reliability)}")
    
    # === 4. MERGE ALL ===
    print("\nMerging datasets...")
    
    # Start with electricity
    master = elec_annual.copy()
    
    # Merge SEDS
    master = master.merge(
        seds[['state', 'year', 'elec_expend_pc', 'total_energy_expend_pc']],
        on=['state', 'year'],
        how='left'
    )
    
    # Merge reliability (2024 only, will be NaN for other years)
    master = master.merge(
        reliability[['state', 'saidi', 'saifi']],
        on='state',
        how='left'
    )
    
    # === 5. CALCULATE DERIVED METRICS ===
    # Estimated annual bill = price * consumption
    master['est_annual_bill'] = (master['avg_price_cents_kwh'] / 100) * master['kwh_per_customer']
    
    print(f"\nMaster dataset: {len(master):,} rows")
    print(f"Columns: {list(master.columns)}")
    
    # === 6. SAVE ===
    master.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved: {OUTPUT_FILE}")
    
    # === 7. PREVIEW ===
    print("\n=== PREVIEW (2024 data) ===")
    preview = master[master['year'] == 2024].sort_values('state').head(10)
    print(preview[['state', 'year', 'avg_price_cents_kwh', 'kwh_per_customer', 
                   'elec_expend_pc', 'saidi', 'saifi']].to_string(index=False))
    
    # === 8. SUMMARY STATS ===
    print("\n=== 2024 SUMMARY STATS ===")
    data_2024 = master[master['year'] == 2024]
    print(f"States with complete data: {data_2024.dropna().shape[0]}")
    print(f"\nPrice (cents/kWh):")
    print(f"  Min: {data_2024['avg_price_cents_kwh'].min():.2f} ({data_2024.loc[data_2024['avg_price_cents_kwh'].idxmin(), 'state']})")
    print(f"  Max: {data_2024['avg_price_cents_kwh'].max():.2f} ({data_2024.loc[data_2024['avg_price_cents_kwh'].idxmax(), 'state']})")
    print(f"\nReliability SAIDI (minutes/year):")
    print(f"  Best: {data_2024['saidi'].min():.1f} ({data_2024.loc[data_2024['saidi'].idxmin(), 'state']})")
    print(f"  Worst: {data_2024['saidi'].max():.1f} ({data_2024.loc[data_2024['saidi'].idxmax(), 'state']})")

if __name__ == "__main__":
    main()