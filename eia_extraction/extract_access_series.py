import json
import csv
import os

# === CONFIGURATION ===
INPUT_FILE = "elec.txt"  # Path to your bulk file
OUTPUT_CSV = "energy_access_data.csv"
OUTPUT_JSON = "energy_access_series.json"

# Series patterns for Energy Access indicators
ACCESS_PATTERNS = [
    "ELEC.SALES.",        # All sales (includes RES, COM, IND, ALL)
    "ELEC.CUSTOMERS.",    # All customer counts
    "ELEC.PRICE.",        # All prices
    "ELEC.REL_SAIDI",     # Outage duration
    "ELEC.REL_SAIFI",     # Outage frequency
    "ELEC.REL_CAIDI",     # Restoration time
]

def matches_pattern(series_id):
    return any(pattern in series_id for pattern in ACCESS_PATTERNS)

def main():
    matched_series = []
    total_lines = 0
    matched_count = 0

    print(f"Reading {INPUT_FILE}...")
    print(f"Looking for patterns: {ACCESS_PATTERNS}\n")

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            total_lines += 1
            if total_lines % 100000 == 0:
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

    # === Save as JSON ===
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(matched_series, f, indent=2)
    print(f"Saved JSON: {OUTPUT_JSON}")

    # === Save as CSV (flattened) ===
    if matched_series:
        with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["series_id", "name", "units", "geography", "frequency", "start", "end", "data_points"])
            
            for s in matched_series:
                writer.writerow([
                    s.get("series_id", ""),
                    s.get("name", ""),
                    s.get("units", ""),
                    s.get("geography", s.get("iso3166", "")),
                    s.get("f", ""),
                    s.get("start", ""),
                    s.get("end", ""),
                    len(s.get("data", []))
                ])
        print(f"Saved CSV index: {OUTPUT_CSV}")

    # === Summary by type ===
    print("\n=== SUMMARY BY TYPE ===")
    from collections import Counter
    patterns_found = Counter()
    for s in matched_series:
        sid = s.get("series_id", "")
        for p in ACCESS_PATTERNS:
            if p in sid:
                patterns_found[p] += 1
                break
    
    for pattern, count in sorted(patterns_found.items()):
        print(f"  {pattern:<25} {count:>6} series")

if __name__ == "__main__":
    main()