import pandas as pd

# === CONFIGURATION ===
MASTER_FILE = "energy_access_master.csv"
INCOME_FILE = "state_median_income_2024.csv"
OUTPUT_FILE = "energy_access_with_burden.csv"

def main():
    print("=== ADDING ENERGY BURDEN ===\n")
    
    # Load master data
    print("Loading master data...")
    master = pd.read_csv(MASTER_FILE)
    print(f"  Rows: {len(master):,}")
    
    # Load income data
    print("\nLoading Census income data (2024 ACS)...")
    income = pd.read_csv(INCOME_FILE)
    print(f"  States: {len(income)}")
    
    # Merge income
    master = master.merge(income[['state', 'median_income_2024']], on='state', how='left')
    
    # Calculate energy burden using estimated annual bill
    # Energy burden = (annual electricity bill / median household income) * 100
    master['energy_burden_pct'] = (master['est_annual_bill'] / master['median_income_2024']) * 100
    
    # Save
    master.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved: {OUTPUT_FILE}")
    
    # === PREVIEW 2024 DATA ===
    print("\n=== 2024 ENERGY BURDEN BY STATE ===")
    data_2024 = master[master['year'] == 2024].dropna(subset=['energy_burden_pct'])
    
    print(f"\n{'State':<6} {'Income':>10} {'Ann Bill':>10} {'Burden %':>10} {'Price':>8} {'SAIDI':>8}")
    print("-" * 62)
    
    # Sort by burden (highest first)
    for _, row in data_2024.sort_values('energy_burden_pct', ascending=False).head(15).iterrows():
        saidi = f"{row['saidi']:.1f}" if pd.notna(row['saidi']) else "N/A"
        print(f"{row['state']:<6} ${row['median_income_2024']:>9,.0f} ${row['est_annual_bill']:>9,.0f} {row['energy_burden_pct']:>9.2f}% {row['avg_price_cents_kwh']:>7.1f}¢ {saidi:>8}")
    
    print("\n=== LOWEST ENERGY BURDEN (most affordable) ===")
    for _, row in data_2024.sort_values('energy_burden_pct').head(10).iterrows():
        print(f"{row['state']:<6} ${row['median_income_2024']:>9,.0f} ${row['est_annual_bill']:>9,.0f} {row['energy_burden_pct']:>9.2f}%")
    
    # Summary stats
    print("\n=== SUMMARY STATISTICS (2024) ===")
    print(f"Average energy burden: {data_2024['energy_burden_pct'].mean():.2f}%")
    print(f"Median energy burden: {data_2024['energy_burden_pct'].median():.2f}%")
    print(f"Max burden: {data_2024['energy_burden_pct'].max():.2f}% ({data_2024.loc[data_2024['energy_burden_pct'].idxmax(), 'state']})")
    print(f"Min burden: {data_2024['energy_burden_pct'].min():.2f}% ({data_2024.loc[data_2024['energy_burden_pct'].idxmin(), 'state']})")
    
    print("\n=== NOTE ===")
    print("Energy burden = (annual electricity bill / median household income) × 100")
    print("Households spending >6% of income on energy are considered 'energy burdened'")

if __name__ == "__main__":
    main()