import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# === CONFIGURATION ===
DATA_FILE = "energy_access_with_burden.csv"
OUTPUT_DIR = "./"

# Set style
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 10
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['axes.labelsize'] = 11

def load_data():
    df = pd.read_csv(DATA_FILE)
    df_2024 = df[df['year'] == 2024].copy()
    # Remove regional aggregates (keep only 2-letter state codes)
    df_2024 = df_2024[df_2024['state'].str.len() == 2]
    return df_2024

def fig1_energy_burden_ranking(df):
    """Horizontal bar chart of energy burden by state"""
    fig, ax = plt.subplots(figsize=(10, 12))
    
    data = df.sort_values('energy_burden_pct', ascending=True)
    
    colors = ['#2ecc71' if x < 2 else '#f39c12' if x < 2.5 else '#e74c3c' 
              for x in data['energy_burden_pct']]
    
    bars = ax.barh(data['state'], data['energy_burden_pct'], color=colors, edgecolor='white')
    
    ax.set_xlabel('Energy Burden (%)')
    ax.set_title('Electricity Burden by State (2024)\nAnnual Bill as % of Median Household Income', fontweight='bold')
    ax.axvline(x=2, color='gray', linestyle='--', alpha=0.5, label='2% threshold')
    
    # Legend
    low = mpatches.Patch(color='#2ecc71', label='< 2% (Low)')
    med = mpatches.Patch(color='#f39c12', label='2-2.5% (Medium)')
    high = mpatches.Patch(color='#e74c3c', label='> 2.5% (High)')
    ax.legend(handles=[low, med, high], loc='lower right')
    
    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}energy_burden_ranking.png', dpi=150, bbox_inches='tight')
    plt.savefig(f'{OUTPUT_DIR}energy_burden_ranking.svg', bbox_inches='tight')
    print("Saved: energy_burden_ranking.png/svg")
    plt.close()

def fig2_price_vs_burden(df):
    """Scatter plot: Price vs Energy Burden"""
    fig, ax = plt.subplots(figsize=(10, 8))
    
    scatter = ax.scatter(df['avg_price_cents_kwh'], df['energy_burden_pct'], 
                         s=df['avg_customers']/50000, alpha=0.6, c=df['energy_burden_pct'],
                         cmap='RdYlGn_r', edgecolors='white', linewidth=0.5)
    
    # Add state labels
    for _, row in df.iterrows():
        ax.annotate(row['state'], (row['avg_price_cents_kwh'], row['energy_burden_pct']),
                    fontsize=7, alpha=0.7, ha='center', va='bottom')
    
    ax.set_xlabel('Average Electricity Price (¢/kWh)')
    ax.set_ylabel('Energy Burden (%)')
    ax.set_title('Electricity Price vs. Energy Burden (2024)\nBubble size = Number of customers', fontweight='bold')
    
    plt.colorbar(scatter, label='Energy Burden %')
    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}price_vs_burden.png', dpi=150, bbox_inches='tight')
    plt.savefig(f'{OUTPUT_DIR}price_vs_burden.svg', bbox_inches='tight')
    print("Saved: price_vs_burden.png/svg")
    plt.close()

def fig3_reliability_ranking(df):
    """Horizontal bar chart of reliability (SAIDI) by state"""
    fig, ax = plt.subplots(figsize=(10, 12))
    
    data = df.dropna(subset=['saidi']).sort_values('saidi', ascending=True)
    
    colors = ['#2ecc71' if x < 100 else '#f39c12' if x < 200 else '#e74c3c' 
              for x in data['saidi']]
    
    ax.barh(data['state'], data['saidi'], color=colors, edgecolor='white')
    
    ax.set_xlabel('SAIDI (Minutes per Year)')
    ax.set_title('Grid Reliability by State (2024)\nAverage Outage Duration per Customer', fontweight='bold')
    ax.axvline(x=100, color='gray', linestyle='--', alpha=0.5)
    ax.axvline(x=200, color='gray', linestyle='--', alpha=0.5)
    
    # Legend
    good = mpatches.Patch(color='#2ecc71', label='< 100 min (Good)')
    fair = mpatches.Patch(color='#f39c12', label='100-200 min (Fair)')
    poor = mpatches.Patch(color='#e74c3c', label='> 200 min (Poor)')
    ax.legend(handles=[good, fair, poor], loc='lower right')
    
    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}reliability_ranking.png', dpi=150, bbox_inches='tight')
    plt.savefig(f'{OUTPUT_DIR}reliability_ranking.svg', bbox_inches='tight')
    print("Saved: reliability_ranking.png/svg")
    plt.close()

def fig4_access_dashboard(df):
    """Combined dashboard with key metrics"""
    fig, axes = plt.subplots(2, 2, figsize=(14, 12))
    
    # Top 10 highest burden
    ax1 = axes[0, 0]
    top_burden = df.nlargest(10, 'energy_burden_pct')
    ax1.barh(top_burden['state'], top_burden['energy_burden_pct'], color='#e74c3c')
    ax1.set_xlabel('Energy Burden (%)')
    ax1.set_title('Highest Energy Burden', fontweight='bold')
    ax1.invert_yaxis()
    
    # Top 10 lowest burden
    ax2 = axes[0, 1]
    low_burden = df.nsmallest(10, 'energy_burden_pct')
    ax2.barh(low_burden['state'], low_burden['energy_burden_pct'], color='#2ecc71')
    ax2.set_xlabel('Energy Burden (%)')
    ax2.set_title('Lowest Energy Burden', fontweight='bold')
    ax2.invert_yaxis()
    
    # Worst reliability
    ax3 = axes[1, 0]
    worst_rel = df.dropna(subset=['saidi']).nlargest(10, 'saidi')
    ax3.barh(worst_rel['state'], worst_rel['saidi'], color='#e74c3c')
    ax3.set_xlabel('SAIDI (Minutes/Year)')
    ax3.set_title('Worst Reliability (Most Outages)', fontweight='bold')
    ax3.invert_yaxis()
    
    # Best reliability
    ax4 = axes[1, 1]
    best_rel = df.dropna(subset=['saidi']).nsmallest(10, 'saidi')
    ax4.barh(best_rel['state'], best_rel['saidi'], color='#2ecc71')
    ax4.set_xlabel('SAIDI (Minutes/Year)')
    ax4.set_title('Best Reliability (Fewest Outages)', fontweight='bold')
    ax4.invert_yaxis()
    
    fig.suptitle('US Energy Access Dashboard (2024)', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}energy_access_dashboard.png', dpi=150, bbox_inches='tight')
    plt.savefig(f'{OUTPUT_DIR}energy_access_dashboard.svg', bbox_inches='tight')
    print("Saved: energy_access_dashboard.png/svg")
    plt.close()

def fig5_consumption_by_state(df):
    """Bar chart of consumption per customer"""
    fig, ax = plt.subplots(figsize=(10, 12))
    
    data = df.sort_values('kwh_per_customer', ascending=True)
    
    colors = ['#3498db' if x < 10000 else '#9b59b6' if x < 12000 else '#e74c3c' 
              for x in data['kwh_per_customer']]
    
    ax.barh(data['state'], data['kwh_per_customer']/1000, color=colors, edgecolor='white')
    
    ax.set_xlabel('Annual Consumption (MWh per Customer)')
    ax.set_title('Residential Electricity Consumption by State (2024)', fontweight='bold')
    ax.axvline(x=10, color='gray', linestyle='--', alpha=0.5)
    
    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}consumption_ranking.png', dpi=150, bbox_inches='tight')
    plt.savefig(f'{OUTPUT_DIR}consumption_ranking.svg', bbox_inches='tight')
    print("Saved: consumption_ranking.png/svg")
    plt.close()

def main():
    print("=== GENERATING ENERGY ACCESS VISUALIZATIONS ===\n")
    
    df = load_data()
    print(f"Loaded {len(df)} states for 2024\n")
    
    fig1_energy_burden_ranking(df)
    fig2_price_vs_burden(df)
    fig3_reliability_ranking(df)
    fig4_access_dashboard(df)
    fig5_consumption_by_state(df)
    
    print("\n=== DONE ===")
    print("Generated 5 visualizations (PNG + SVG)")

if __name__ == "__main__":
    main()