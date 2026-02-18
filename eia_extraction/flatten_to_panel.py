import json
import csv
import re
from collections import defaultdict

# === CONFIGURATION ===
INPUT_JSON = "energy_access_series.json"
OUTPUT_CSV = "energy_access_panel.csv"

def parse_series_id(series_id):
    """
    Parse series_id like 'ELEC.SALES.TN-RES.M' 
    Returns: (metric, geography, sector, frequency)
    """
    parts = series_id.split(".")
    if len(parts) < 4:
        return None, None, None, None
    
    metric = parts[1]  # SALES, PRICE, CUSTOMERS
    geo_sector = parts[2]  # TN-RES or SAT-ALL
    freq = parts[3]  # M or A
    
    # Split geography and sector
    if "-" in geo_sector:
        geo, sector = geo_sector.rsplit("-", 1)
    else:
        geo = geo_sector
        sector = "ALL"
    
    return metric, geo, sector, freq

def format_date(date_str):
    """Convert 202501 to 2025-01"""
    if len(date_str) == 6:
        return f"{date_str[:4]}-{date_str[4:]}"
    return date_str

def main():
    print(f"Reading {INPUT_JSON}...")
    
    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        series_list = json.load(f)
    
    print(f"Loaded {len(series_list)} series")
    
    # Organize data by (geography, sector, date) -> {metric: value}
    panel_data = defaultdict(dict)
    
    for series in series_list:
        series_id = series.get("series_id", "")
        metric, geo, sector, freq = parse_series_id(series_id)
        
        if not metric or not geo:
            continue
        
        # Only process monthly data for now
        if freq != "M":
            continue
        
        data = series.get("data", [])
        
        for date_str, value in data:
            # Skip null values
            if value == "- -" or value is None:
                continue
            
            key = (geo, sector, date_str)
            panel_data[key][metric.lower()] = value
    
    print(f"Created {len(panel_data)} unique geo-sector-date combinations")
    
    # Write to CSV
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "geography", "sector", "date", "year", "month",
            "sales_million_kwh", "price_cents_kwh", "customers"
        ])
        
        # Sort by geography, sector, date
        for key in sorted(panel_data.keys()):
            geo, sector, date_str = key
            values = panel_data[key]
            
            # Parse year/month
            year = date_str[:4] if len(date_str) >= 4 else ""
            month = date_str[4:] if len(date_str) >= 6 else ""
            
            writer.writerow([
                geo,
                sector,
                format_date(date_str),
                year,
                month,
                values.get("sales", ""),
                values.get("price", ""),
                values.get("customers", "")
            ])
    
    print(f"Saved: {OUTPUT_CSV}")
    
    # === Summary ===
    print("\n=== SUMMARY ===")
    
    # Count unique geographies
    geos = set(k[0] for k in panel_data.keys())
    sectors = set(k[1] for k in panel_data.keys())
    dates = set(k[2] for k in panel_data.keys())
    
    print(f"  Geographies: {len(geos)}")
    print(f"  Sectors: {sorted(sectors)}")
    print(f"  Date range: {min(dates)} to {max(dates)}")
    print(f"  Total rows: {len(panel_data)}")
    
    # Preview
    print(f"\n=== PREVIEW (first 10 rows) ===")
    print(f"{'GEO':<6} {'SECTOR':<6} {'DATE':<8} {'SALES':>12} {'PRICE':>8} {'CUSTOMERS':>12}")
    print("-" * 60)
    
    for i, key in enumerate(sorted(panel_data.keys())[:10]):
        geo, sector, date_str = key
        v = panel_data[key]
        sales = f"{v.get('sales', ''):.1f}" if v.get('sales') else ""
        price = f"{v.get('price', ''):.2f}" if v.get('price') else ""
        cust = f"{v.get('customers', ''):.0f}" if v.get('customers') else ""
        print(f"{geo:<6} {sector:<6} {date_str:<8} {sales:>12} {price:>8} {cust:>12}")

if __name__ == "__main__":
    main()