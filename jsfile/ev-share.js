// ev-share.js (ES module)
// Requirements:
// - D3 v7 loaded in the page
// - Optional: data/ev_sales_pred.csv

const CSV_PATH = "./data/ev_sales_pred.csv";
const TOP_N = 20;

const chartEl = document.querySelector("#chart");
const yearSelect = document.querySelector("#yearSelect");
const metaTitle = document.querySelector("#metaTitle");
const metaSub = document.querySelector("#metaSub");
const dataHint = document.querySelector("#dataHint");

function setFooterYear() {
  const y = document.querySelector("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

/** Normalize row keys and parse */
function normalizeRow(row) {
  // case-insensitive mapping
  const keys = Object.fromEntries(Object.keys(row).map(k => [k.toLowerCase(), k]));

  const yearKey = keys["year"];
  const countryKey = keys["country"] ?? keys["region"] ?? keys["name"];
  const valueKey =
    keys["ev_sales"] ?? keys["ev_sale"] ?? keys["sales"] ?? keys["value"] ?? keys["evs"];

  if (!yearKey || !countryKey || !valueKey) return null;

  const year = Number(row[yearKey]);
  const country = String(row[countryKey]).trim();
  const value = Number(row[valueKey]);

  if (!Number.isFinite(year) || !country || !Number.isFinite(value)) return null;

  return { year, country, value };
}

async function loadData() {
  try {
    const raw = await d3.csv(CSV_PATH);
    const parsed = raw.map(normalizeRow).filter(Boolean);

    if (!parsed.length) throw new Error("CSV loaded but no valid rows parsed.");

    dataHint.textContent = `Loaded data from ${CSV_PATH}.`;
    return parsed;
  } catch (err) {
    // Fallback sample data
    dataHint.textContent =
      `Could not load ${CSV_PATH}. Using sample data for now. (Add your CSV to data/ to use real values.)`;

    return sampleData();
  }
}

function sampleData() {
  // Sample years 2025–2030, fake values
  const countries = [
    "China","United States","Germany","UK","France","Norway","Netherlands","Sweden","Canada","Japan",
    "South Korea","Italy","Spain","India","Australia","Brazil","Mexico","Denmark","Belgium","Switzerland",
    "Portugal","Austria","Poland","Thailand","Indonesia","Turkey"
  ];

  const years = [2025, 2026, 2027, 2028, 2029, 2030];

  const data = [];
  for (const y of years) {
    for (let i = 0; i < countries.length; i++) {
      // deterministic-ish growth pattern
      const base = (countries.length - i) * 12000;
      const growth = (y - 2025) * (2000 + (i % 6) * 350);
      const noise = (i % 5) * 900;
      data.push({ year: y, country: countries[i], value: Math.max(0, base + growth - noise) });
    }
  }
  return data;
}

function uniqueYears(data) {
  return Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);
}

function topNByYear(data, year, n = TOP_N) {
  return data
    .filter(d => d.year === year)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** --- D3 Chart --- */
function renderBarChart(container, rows, year) {
  // Clear
  container.innerHTML = "";

  // Responsive sizing
  const width = container.clientWidth;
  const height = Math.max(520, Math.min(720, rows.length * 26 + 120));

  const margin = { top: 24, right: 24, bottom: 48, left: 160 };

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(rows, d => d.value) || 1])
    .nice()
    .range([0, innerW]);

  const y = d3
    .scaleBand()
    .domain(rows.map(d => d.country))
    .range([0, innerH])
    .padding(0.18);

  // Axes
  const xAxis = d3.axisBottom(x).ticks(6).tickFormat(d3.format("~s"));
  const yAxis = d3.axisLeft(y).tickSizeOuter(0);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(xAxis);

  g.append("g").call(yAxis);

  // Bars
  g.selectAll(".bar")
    .data(rows, d => d.country)
    .join("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => y(d.country))
    .attr("height", y.bandwidth())
    .attr("width", d => x(d.value))
    .attr("fill", "currentColor")
    .attr("opacity", 0.85);

  // Labels on bars
  g.selectAll(".value")
    .data(rows, d => d.country)
    .join("text")
    .attr("class", "value")
    .attr("x", d => x(d.value) + 8)
    .attr("y", d => (y(d.country) ?? 0) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .attr("fill", "rgba(17,17,17,0.75)")
    .text(d => d3.format(",")(Math.round(d.value)));

  // Title
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 18)
    .attr("font-size", 14)
    .attr("font-weight", 700)
    .text(`Top ${rows.length} EV Sales Countries — ${year}`);
}

/** Re-render on resize */
function attachResize(handler) {
  let raf = null;
  window.addEventListener("resize", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(handler);
  });
}

async function main() {
  setFooterYear();

  const data = await loadData();
  const years = uniqueYears(data);

  // Populate dropdown
  yearSelect.innerHTML = "";
  for (const y of years) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }

  // Default = latest year
  const defaultYear = years[years.length - 1];
  yearSelect.value = String(defaultYear);

  const update = () => {
    const year = Number(yearSelect.value);
    const rows = topNByYear(data, year, TOP_N);

    metaTitle.textContent = `Top ${TOP_N} Countries`;
    metaSub.textContent = `EV sales • Year ${year}`;

    renderBarChart(chartEl, rows, year);
  };

  yearSelect.addEventListener("change", update);
  attachResize(update);

  update();
}

main();
