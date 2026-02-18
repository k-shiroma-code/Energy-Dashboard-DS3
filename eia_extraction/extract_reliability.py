import pandas as pd
import numpy as np

# === CONFIGURATION ===
INPUT_FILE = "Reliability_2024.xlsx"  # Rename your file to this, or change path
OUTPUT_UTILITY = "reliability_by_utility.csv"
OUTPUT_STATE = "reliability_by_state.csv"

def main():
    print(f"Reading {INPUT_FILE}...")
    
    # Read with header at row 1
    df = pd.read_excel(INPUT_FILE, header=1)
    
    # Skip the first row (which contains column descriptions)
    df = df.iloc[1:]
    
    # Rename columns
    df.columns = ['data_year', 'utility_number', 'utility_name', 'state', 'ownership',
                  'ieee_saidi_with_med', 'ieee_saifi_with_med', 'ieee_caidi_with_med',
                  'ieee_saidi_wo_med', 'ieee_saifi_wo_med', 'ieee_caidi_wo_med',
                  'ieee_saidi_los_with_med', 'ieee_saifi_los_with_med', 'ieee_caidi_los_with_med',
                  'ieee_customers', 'ieee_voltage', 'ieee_auto',
                  'other_saidi_with_med', 'other_saifi_with_med', 'other_caidi_with_med',
                  'other_saidi_wo_med', 'other_saifi_wo_med', 'other_caidi_wo_med',
                  'other_customers', 'other_inactive', 'other_momentary', 
                  'other_voltage', 'other_auto']
    
    # Convert numeric columns
    numeric_cols = ['ieee_saidi_with_med', 'ieee_saifi_with_med', 'ieee_caidi_with_med',
                    'ieee_saidi_wo_med', 'ieee_saifi_wo_med', 'ieee_caidi_wo_med',
                    'other_saidi_with_med', 'other_saifi_with_med', 'other_caidi_with_med',
                    'other_saidi_wo_med', 'other_saifi_wo_med', 'other_caidi_wo_med',
                    'ieee_customers', 'other_customers']
    
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Combine IEEE and Other standards into single columns
    df['saidi_with_med'] = df['ieee_saidi_with_med'].fillna(df['other_saidi_with_med'])
    df['saifi_with_med'] = df['ieee_saifi_with_med'].fillna(df['other_saifi_with_med'])
    df['caidi_with_med'] = df['ieee_caidi_with_med'].fillna(df['other_caidi_with_med'])
    df['saidi_wo_med'] = df['ieee_saidi_wo_med'].fillna(df['other_saidi_wo_med'])
    df['saifi_wo_med'] = df['ieee_saifi_wo_med'].fillna(df['other_saifi_wo_med'])
    df['caidi_wo_med'] = df['ieee_caidi_wo_med'].fillna(df['other_caidi_wo_med'])
    df['customers'] = df['ieee_customers'].fillna(df['other_customers'])
    
    # Determine which standard was used
    df['standard'] = np.where(df['ieee_saidi_with_med'].notna(), 'IEEE', 
                              np.where(df['other_saidi_with_med'].notna(), 'Other', 'None'))
    
    # === SAVE UTILITY-LEVEL DATA ===
    utility_df = df[['data_year', 'utility_number', 'utility_name', 'state', 'ownership',
                     'saidi_with_med', 'saifi_with_med', 'caidi_with_med',
                     'saidi_wo_med', 'saifi_wo_med', 'caidi_wo_med',
                     'customers', 'standard']].copy()
    
    utility_df.to_csv(OUTPUT_UTILITY, index=False)
    print(f"Saved utility-level: {OUTPUT_UTILITY}")
    print(f"  Utilities: {len(utility_df)}")
    
    # === AGGREGATE TO STATE LEVEL (weighted by customers) ===
    # Filter to rows with valid data
    valid = df[df['customers'].notna() & (df['customers'] > 0) & 
               (df['saidi_with_med'].notna() | df['saidi_wo_med'].notna())].copy()
    
    # Calculate weighted averages by state
    def weighted_avg(group, col, weight_col='customers'):
        mask = group[col].notna() & group[weight_col].notna()
        if mask.sum() == 0:
            return np.nan
        return np.average(group.loc[mask, col], weights=group.loc[mask, weight_col])
    
    state_agg = valid.groupby('state').apply(
        lambda g: pd.Series({
            'saidi_with_med': weighted_avg(g, 'saidi_with_med'),
            'saifi_with_med': weighted_avg(g, 'saifi_with_med'),
            'saidi_wo_med': weighted_avg(g, 'saidi_wo_med'),
            'saifi_wo_med': weighted_avg(g, 'saifi_wo_med'),
            'total_customers': g['customers'].sum(),
            'utility_count': len(g)
        })
    ).reset_index()
    
    state_agg['year'] = 2024
    state_agg = state_agg[['state', 'year', 'saidi_with_med', 'saifi_with_med', 
                           'saidi_wo_med', 'saifi_wo_med', 'total_customers', 'utility_count']]
    
    state_agg.to_csv(OUTPUT_STATE, index=False)
    print(f"\nSaved state-level: {OUTPUT_STATE}")
    print(f"  States: {len(state_agg)}")
    
    # === SUMMARY ===
    print("\n=== STATE RELIABILITY SUMMARY (2024) ===")
    print(f"{'State':<6} {'SAIDI':>8} {'SAIFI':>8} {'Customers':>12}")
    print("-" * 40)
    
    for _, row in state_agg.sort_values('saidi_wo_med', ascending=False).head(10).iterrows():
        print(f"{row['state']:<6} {row['saidi_wo_med']:>8.1f} {row['saifi_wo_med']:>8.2f} {row['total_customers']:>12,.0f}")
    
    print("\n(Top 10 states by SAIDI - worst reliability)")
    
    print("\n=== BEST RELIABILITY (lowest SAIDI) ===")
    for _, row in state_agg.sort_values('saidi_wo_med').head(5).iterrows():
        print(f"{row['state']:<6} {row['saidi_wo_med']:>8.1f} {row['saifi_wo_med']:>8.2f}")

if __name__ == "__main__":
    main()
