# Energy Dashboard — EV Adoption & Oil Imports

A data-driven dashboard exploring whether rising electric vehicle adoption measurably reduces oil dependency in non-producing countries, and how the resulting savings could fund clean energy infrastructure.

**Live Site:** [https://k-shiroma-code.github.io/Energy-Dashboard-DS3/](https://k-shiroma-code.github.io/Energy-Dashboard-DS3/index.html)

## Overview

This project combines IEA oil import/export data with global EV sales figures across 50+ countries spanning 1971–2023 for oil trade and 2010–2030 for EV sales. Forecasts extend through 2035 using ARIMA and logistic S-curve models.

### Key Metrics

- **~18%** — Global new-car EV share (2023)
- **↓ 2.4 Mb/d** — Estimated oil displaced by EVs (2023)
- **50+** — Countries in the dataset

## Pages

- **Dashboard** — Landing page with summary statistics, preview charts, and key findings
- **EV Share Explorer** — Top EV sales countries by year with interactive country filters and ranking
- **EV Forecast** — Logistic S-curve projections of EV sales by region through 2035
- **Oil Explorer** — Historical oil import volumes (kb/d) with ARIMA-model forecasts through 2030
- **EV GDP Impact** — Analysis of EV adoption's economic impact by country
- **Datasets** — Access to all underlying data files

## Data Sources

- **Oil Data:** [IEA Oil Information Database](https://www.iea.org/data-and-statistics) — import/export volumes by country
- **EV Data:** [IEA Global EV Outlook](https://www.iea.org/reports/global-ev-outlook-2023) — sales and market share figures

## Methodology

- Country-level EV market share is compared to year-over-year oil import changes, controlling for GDP growth
- Oil forecasts use **Log-ARIMA** models fitted to historical IEA data
- EV adoption is projected via a **logistic S-curve** (*f(t) = L / (1 + e^(-k(t - t₀)))*) fitted by nonlinear least-squares regression
- Investment estimates apply a conservative oil price to displaced barrels and scale to per-capita grid benchmarks

## Project Structure

```
├── analysis/                # Data processing and analysis notebooks
│   ├── Access_To_Energy.csv
│   ├── targets_download/    # Downloaded target datasets
│   └── yearly_electricity_data/
├── frontend/                # Website source files
│   ├── public/data/         # JSON and CSV data for charts
│   └── src/pages/           # Page templates
├── htmlfile/                # Static HTML pages
├── jsfile/                  # Chart implementations (JavaScript)
└── data/                    # Raw datasets
```

## Caveats

Oil demand is shaped by industry, heating, and shipping — not just cars. This analysis focuses on light-vehicle transport fuel and should be read as indicative rather than causal. GDP growth and energy-mix shifts are controlled for but not eliminated.

## Contributing

Open project — chart implementations live in `./jsfile/` and datasets in `./data/`. Pull requests welcome.

## License

Data sourced from the International Energy Agency (IEA). All IEA data is subject to their terms of use.
