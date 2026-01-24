# ⚡ Energy Dashboard DS3

An interactive dashboard tracking national renewable energy commitments and 2030 targets across 88 countries worldwide.

## 🌍 Overview

This project visualizes global renewable energy targets, including:
- Capacity targets (GW)
- Share targets (%)
- Regional breakdowns
- Technology-specific commitments (Solar, Wind, Hydro, etc.)

**Data Source:** [Ember Climate](https://ember-climate.org/) - 2030 Targets Dataset

---

## 🛠️ Tech Stack

**Frontend:**
- [Astro](https://astro.build/) - Static site framework
- [React](https://react.dev/) - UI components
- [Recharts](https://recharts.org/) - Data visualization

**Data Analysis:**
- Python 3.11
- Pandas, NumPy
- Matplotlib, Seaborn, Plotly

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18+ or [Bun](https://bun.sh/)
- [Conda](https://docs.conda.io/) (for Python environment)
- Git

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/k-shiroma-code/Energy-Dashboard-DS3.git
cd Energy-Dashboard-DS3
```

### 2. Set up Python environment (for data analysis)

```bash
conda create -n energy-dashboard python=3.11 -y
conda activate energy-dashboard
pip install -r requirements.txt
```

### 3. Set up Frontend

```bash
cd frontend
bun install
```

Or with npm:
```bash
cd frontend
npm install
```

---

## 🏃 Running the Project

### Start the frontend dev server

```bash
cd frontend
bun run dev
```

Or with npm:
```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

### Run Jupyter notebooks (for EDA)

```bash
conda activate energy-dashboard
jupyter notebook
```

---

## 📁 Project Structure

```
Energy-Dashboard-DS3/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── CapacityChart.jsx    # Interactive chart component
│   │   └── pages/
│   │       └── index.astro          # Main landing page
│   ├── public/
│   ├── astro.config.mjs
│   ├── package.json
│   └── tsconfig.json
├── targets_download/
│   ├── merged_targets_clean.csv     # Cleaned dataset
│   ├── capacity_target_wide-Table 1.csv
│   ├── share_target_wide-Table 1.csv
│   └── raw_data_long-Table 1.csv
├── main.ipynb                        # Data analysis notebook
├── eda.ipynb                         # Exploratory data analysis
├── requirements.txt                  # Python dependencies
└── README.md
```

---

## 📊 Data Fields

| Field | Description |
|-------|-------------|
| `country_code` | ISO 3-letter country code |
| `country_name` | Full country name |
| `ember_region` | Geographic region (Europe, Asia, etc.) |
| `target_year` | Target year (2030) |
| `capacity_target_gw` | Renewable capacity target in GW |
| `share_target_pct` | Renewable share target as % |
| `Solar`, `Wind`, `Hydro`, etc. | Technology-specific targets |

---

## 🌐 Regions Covered

| Region | Countries |
|--------|-----------|
| Europe | 41 |
| Asia | 19 |
| Africa | 12 |
| Latin America & Caribbean | 7 |
| Middle East | 4 |
| Oceania | 2 |
| North America | 2 |

---

## 👥 Team

- Kyle Shiroma
- Essie Cheng

---

## 📝 License

This project is for educational purposes as part of the DS3 Data Science program.

---

## 🐛 Troubleshooting

### "astro: command not found" or wrong Astro runs
If you have Apache Airflow's Astro CLI installed, it conflicts with the web framework. Use:
```bash
bun run dev
# or
./node_modules/.bin/astro dev
```

### npm install fails with ENOTEMPTY
```bash
sudo rm -rf node_modules
bun install
```

### tsconfig.json shows red in VS Code
Run:
```bash
bunx astro sync
```
Then reload VS Code window (Cmd + Shift + P → "Reload Window")
