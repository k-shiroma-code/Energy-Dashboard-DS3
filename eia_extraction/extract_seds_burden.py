import json
import csv
from collections import defaultdict

# === CONFIGURATION ===
INPUT_FILE = "SEDS.txt"
OUTPUT_CSV = "seds_expenditure.csv"

# Series patterns for energy burden
BURDEN_PATTERNS = [
    "TEEAP",   # Total energy expenditures per capita ($)
    "ESRCP",   # Residential electricity expenditures per capita ($)
    "ESRCB",   # Residential electricity expenditures (billion $)
    "TERCB",   # Total energy expenditures (billion $)
]

def matches_pattern(series_id):
    return any(pattern in series_id for pattern in BURDEN_PATTERNS)

def parse_series_id(series_id):
    """
    Parse series_id like 'SEDS.TEEAP.AZ.A'
    Returns: (metric, state, frequency)
    """
    parts = series_id.split(".")
    if len(parts) < 4:
        return None, None, None
    
    metric = parts[1]  # TEEAP, ESRCP, etc.
    state = parts[2]   # AZ, CA, etc.
    freq = parts[3]    # A (annual)
    
    return metric, state, freq

def main():
    matched_series = []
    total_lines = 0
    matched_count = 0

    print(f"Reading {INPUT_FILE}...")
    print(f"Looking for patterns: {BURDEN_PATTERNS}\n")

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            total_lines += 1
            if total_lines % 10000 == 0:
                print(f"  Processed {total_lines:,} lines, found {matched_count:,} matches...")

            try:
                record = json.loads(line.strip())
                series_id = record.get("series_id", "")
                
                if matches_pattern(series_id):
                    matched_count += 1
                    matched_series.append(record)
            except json.JSONDecodeError:
                continue

    print(f"\nDone! Found {matched_count:,} series out of {total_lines:,} total.")

    # Flatten to panel format
    panel_data = defaultdict(dict)
    
    for series in matched_series:
        series_id = series.get("series_id", "")
        metric, state, freq = parse_series_id(series_id)
        
        if not metric or not state:
            continue
        
        data = series.get("data", [])
        units = series.get("units", "")
        
        for date_str, value in data:
            if value == "- -" or value is None:
                continue
            
            key = (state, date_str)
            panel_data[key][metric.lower()] = value

    # Write to CSV
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "state", "year",
            "total_energy_expend_per_capita",    # TEEAP
            "elec_resid_expend_per_capita",      # ESRCP
            "elec_resid_expend_billion",         # ESRCB
            "total_energy_expend_billion"        # TERCB
        ])
        
        for key in sorted(panel_data.keys()):
            state, year = key
            v = panel_data[key]
            
            writer.writerow([
                state,
                year,
                v.get("teeap", ""),
                v.get("esrcp", ""),
                v.get("esrcb", ""),
                v.get("tercb", "")
            ])
    
    print(f"Saved: {OUTPUT_CSV}")

    # Summary
    print("\n=== SUMMARY ===")
    states = set(k[0] for k in panel_data.keys())
    years = set(k[1] for k in panel_data.keys())
    print(f"  States: {len(states)}")
    print(f"  Year range: {min(years)} to {max(years)}")
    print(f"  Total rows: {len(panel_data)}")
    
    # Preview
    print(f"\n=== PREVIEW (first 10 rows) ===")
    print(f"{'STATE':<6} {'YEAR':<6} {'TOT $/CAP':>12} {'ELEC $/CAP':>12}")
    print("-" * 40)
    
    for i, key in enumerate(sorted(panel_data.keys())[:10]):
        state, year = key
        v = panel_data[key]
        teeap = f"{v.get('teeap', 0):.0f}" if v.get('teeap') else ""
        esrcp = f"{v.get('esrcp', 0):.0f}" if v.get('esrcp') else ""
        print(f"{state:<6} {year:<6} {teeap:>12} {esrcp:>12}")

if __name__ == "__main__":
    main()