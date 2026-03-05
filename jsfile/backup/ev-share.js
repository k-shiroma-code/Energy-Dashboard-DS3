// ─────────────────────────────────────────────────────────────────────────────
// ev-share.js  (ES module)
// Requirements: D3 v7 loaded in the page
// Optional:     data/ev_sales_pred.csv
//
// HTML it expects:
//   <div  id="chart">          — chart mount point
//   <select id="yearSelect">   — year picker (populated here)
//   <select id="topNSelect">   — top-N picker  (optional; falls back gracefully)
//   <div  id="metaTitle">      — dynamic heading text
//   <div  id="metaSub">        — dynamic sub-heading text
//   <div  id="dataHint">       — status / error message
//   <span id="year">           — footer year
// ─────────────────────────────────────────────────────────────────────────────

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  csvPath:        "./data/ev_sales_pred.csv",
  defaultTopN:    20,
  transitionMs:   600,          // bar animation duration
  barPadding:     0.22,         // scaleBand padding
  barMinHeight:   18,           // px – minimum row height for readability
  barMaxHeight:   40,           // px – maximum row height
  margin:         { top: 16, right: 110, bottom: 52, left: 170 },

  // Dashboard palette — teal → amber gradient across rank
  colorHigh:  "#2dd4bf",        // rank 1  (accent-teal)
  colorLow:   "#f5a623",        // rank N  (accent-amber)
  colorMuted: "#4e5e7a",        // axes / gridlines
  colorText:  "#e8edf5",        // primary text
  colorSub:   "#8a9ab8",        // secondary text
  fontMono:   "'IBM Plex Mono', monospace",
  fontDisplay:"'Syne', sans-serif",
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const chartEl     = document.querySelector("#chart");
const yearSelect  = document.querySelector("#yearSelect");
const topNSelect  = document.querySelector("#topNSelect");   // optional
const metaTitle   = document.querySelector("#metaTitle");
const metaSub     = document.querySelector("#metaSub");
const dataHint    = document.querySelector("#dataHint");

// ── Tooltip (created once, reused) ───────────────────────────────────────────
const tooltip = (() => {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position:       "fixed",
    pointerEvents:  "none",
    opacity:        "0",
    transition:     "opacity 0.12s",
    background:     "rgba(22,27,36,0.97)",
    border:         "1px solid #3b5278",
    borderRadius:   "8px",
    padding:        "0.6rem 0.9rem",
    fontFamily:     CONFIG.fontMono,
    fontSize:       "0.73rem",
    color:          CONFIG.colorText,
    lineHeight:     "1.7",
    zIndex:         "9999",
    boxShadow:      "0 6px 24px rgba(0,0,0,0.55)",
    maxWidth:       "220px",
    whiteSpace:     "nowrap",
  });
  document.body.appendChild(el);
  return el;
})();

function showTooltip(event, d, rank) {
  tooltip.innerHTML =
    `<div style="color:${CONFIG.colorSub};font-size:.65rem;margin-bottom:.25rem">
       #${rank} · ${d.year}
     </div>
     <div style="font-size:.85rem;font-weight:600;color:${CONFIG.colorText}">
       ${d.country}
     </div>
     <div style="margin-top:.2rem;color:${CONFIG.colorSub}">
       ${d3.format(",")(Math.round(d.value))} <span style="font-size:.65rem">vehicles</span>
     </div>`;

  tooltip.style.opacity = "1";
  positionTooltip(event);
}

function positionTooltip(event) {
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  const vw = window.innerWidth,   vh = window.innerHeight;
  const gap = 14;

  let tx = event.clientX + gap;
  let ty = event.clientY - gap - th;

  if (tx + tw > vw - 8) tx = event.clientX - gap - tw;
  if (ty < 8)           ty = event.clientY + gap;

  tx = Math.max(8, Math.min(tx, vw - tw - 8));
  ty = Math.max(8, Math.min(ty, vh - th - 8));

  tooltip.style.left = `${tx}px`;
  tooltip.style.top  = `${ty}px`;
}

function hideTooltip() {
  tooltip.style.opacity = "0";
}

// ── Data loading ──────────────────────────────────────────────────────────────

/** Case-insensitive CSV column normaliser */
function normalizeRow(row) {
  const k = Object.fromEntries(Object.keys(row).map(key => [key.toLowerCase(), key]));

  const yearKey    = k["year"];
  const countryKey = k["country"] ?? k["region"] ?? k["name"];
  const valueKey   = k["ev_sales"] ?? k["ev_sale"] ?? k["sales"] ?? k["value"] ?? k["evs"];

  if (!yearKey || !countryKey || !valueKey) return null;

  const year    = Number(row[yearKey]);
  const country = String(row[countryKey]).trim();
  const value   = Number(row[valueKey]);

  if (!Number.isFinite(year) || !country || !Number.isFinite(value)) return null;
  return { year, country, value };
}

async function loadData() {
  try {
    const raw    = await d3.csv(CONFIG.csvPath);
    const parsed = raw.map(normalizeRow).filter(Boolean);
    if (!parsed.length) throw new Error("No valid rows parsed.");
    setStatus(`Loaded ${parsed.length} rows from ${CONFIG.csvPath}.`, "ok");
    return parsed;
  } catch {
    setStatus(
      `Could not load ${CONFIG.csvPath} — showing sample data.
       Add your CSV to data/ to use real values.`,
      "warn"
    );
    return buildSampleData();
  }
}

function setStatus(msg, level = "ok") {
  if (!dataHint) return;
  dataHint.textContent = msg;
  dataHint.style.color = level === "warn" ? "var(--accent-amber, #f5a623)"
                        : level === "err"  ? "var(--red, #ff6b6b)"
                        : "var(--text-muted, #4e5e7a)";
}

/** Deterministic sample data — 2025–2030, 26 countries */
function buildSampleData() {
  const countries = [
    "China","United States","Germany","UK","France","Norway","Netherlands","Sweden",
    "Canada","Japan","South Korea","Italy","Spain","India","Australia","Brazil",
    "Mexico","Denmark","Belgium","Switzerland","Portugal","Austria","Poland",
    "Thailand","Indonesia","Turkey",
  ];
  const years = [2025, 2026, 2027, 2028, 2029, 2030];
  const data  = [];

  for (const y of years) {
    for (let i = 0; i < countries.length; i++) {
      const base   = (countries.length - i) * 12_000;
      const growth = (y - 2025) * (2_000 + (i % 6) * 350);
      const noise  = (i % 5) * 900;
      data.push({ year: y, country: countries[i], value: Math.max(0, base + growth - noise) });
    }
  }
  return data;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function uniqueYears(data) {
  return [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
}

function topNByYear(data, year, n) {
  return data
    .filter(d => d.year === year)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

// ── Chart (built once, updated via D3 transitions) ────────────────────────────

let chartState = null;   // holds scales, selections, and dimensions across updates

/**
 * First call: builds the SVG skeleton.
 * Subsequent calls: transitions bars, labels, and axes in place.
 */
function renderOrUpdate(container, rows, year) {
  const totalW = container.clientWidth;
  const rowH   = Math.max(CONFIG.barMinHeight, Math.min(CONFIG.barMaxHeight,
                   Math.floor((totalW * 0.55) / rows.length)));
  const innerH = rows.length * rowH;
  const totalH = innerH + CONFIG.margin.top + CONFIG.margin.bottom;
  const { margin } = CONFIG;
  const innerW = totalW - margin.left - margin.right;

  // ── Colour scale — sequential by rank ──────────────────────────
  const colorScale = d3.scaleSequential()
    .domain([0, rows.length - 1])
    .interpolator(d3.interpolateRgb(CONFIG.colorHigh, CONFIG.colorLow));

  // ── Scales ──────────────────────────────────────────────────────
  const xMax = d3.max(rows, d => d.value) || 1;
  const x = d3.scaleLinear()
    .domain([0, xMax])
    .nice()
    .range([0, innerW]);

  const yBand = d3.scaleBand()
    .domain(rows.map(d => d.country))
    .range([0, innerH])
    .padding(CONFIG.barPadding);

  // ── First render: build skeleton ────────────────────────────────
  if (!chartState || chartState.containerId !== container.id) {
    container.innerHTML = "";

    const svg = d3.select(container)
      .append("svg")
      .attr("width",  totalW)
      .attr("height", totalH)
      .style("display", "block")
      .style("overflow", "visible");

    const g = svg.append("g")
      .attr("class", "chart-root")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Gridlines group (behind bars)
    g.append("g").attr("class", "gridlines");

    // Axes groups
    g.append("g").attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`);
    g.append("g").attr("class", "y-axis");

    // Bars and labels groups
    g.append("g").attr("class", "bars");
    g.append("g").attr("class", "bar-labels");
    g.append("g").attr("class", "rank-labels");

    // X-axis label
    svg.append("text")
      .attr("class", "x-axis-label")
      .attr("x", margin.left + innerW / 2)
      .attr("y", totalH - 6)
      .attr("text-anchor", "middle")
      .attr("font-family", CONFIG.fontMono)
      .attr("font-size", 11)
      .attr("fill", CONFIG.colorMuted)
      .text("EV Sales (vehicles)");

    chartState = { svg, g, containerId: container.id };
  }

  const { svg, g } = chartState;

  // Resize SVG to match new dimensions
  svg.attr("width", totalW).attr("height", totalH);
  g.select(".x-axis").attr("transform", `translate(0,${innerH})`);

  const T = d3.transition().duration(CONFIG.transitionMs).ease(d3.easeCubicOut);

  // ── Gridlines ────────────────────────────────────────────────────
  g.select(".gridlines")
    .call(sel => {
      sel.selectAll(".grid-line")
        .data(x.ticks(5))
        .join(
          enter => enter.append("line")
            .attr("class", "grid-line")
            .attr("x1", d => x(d)).attr("x2", d => x(d))
            .attr("y1", 0).attr("y2", innerH)
            .attr("stroke", CONFIG.colorMuted)
            .attr("stroke-width", 0.5)
            .attr("stroke-dasharray", "3,4")
            .attr("opacity", 0)
            .call(e => e.transition(T).attr("opacity", 0.35)),
          update => update.transition(T)
            .attr("x1", d => x(d)).attr("x2", d => x(d))
            .attr("y2", innerH)
            .attr("opacity", 0.35),
          exit => exit.transition(T).attr("opacity", 0).remove()
        );
    });

  // ── X axis ───────────────────────────────────────────────────────
  g.select(".x-axis")
    .transition(T)
    .call(
      d3.axisBottom(x)
        .ticks(5)
        .tickFormat(d3.format("~s"))
        .tickSizeOuter(0)
    )
    .call(sel => styleAxis(sel, false));

  // ── Y axis ───────────────────────────────────────────────────────
  g.select(".y-axis")
    .transition(T)
    .call(
      d3.axisLeft(yBand)
        .tickSizeOuter(0)
        .tickSizeInner(0)
        .tickPadding(10)
    )
    .call(sel => styleAxis(sel, true));

  // ── Bars ─────────────────────────────────────────────────────────
  g.select(".bars")
    .selectAll(".bar")
    .data(rows, d => d.country)
    .join(
      enter => enter.append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => yBand(d.country) ?? 0)
        .attr("height", yBand.bandwidth())
        .attr("width", 0)                          // animate from 0
        .attr("rx", 3)
        .attr("fill", (_, i) => colorScale(i))
        .attr("opacity", 0.88)
        .on("mouseover", function(event, d) {
          d3.select(this).attr("opacity", 1).attr("filter", "brightness(1.15)");
          const rank = rows.indexOf(d) + 1;
          showTooltip(event, d, rank);
        })
        .on("mousemove", positionTooltip)
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.88).attr("filter", null);
          hideTooltip();
        })
        .call(e => e.transition(T)
          .attr("width", d => x(d.value))
          .attr("y", d => yBand(d.country) ?? 0)
          .attr("height", yBand.bandwidth())
        ),

      update => update
        .on("mouseover", function(event, d) {
          d3.select(this).attr("opacity", 1).attr("filter", "brightness(1.15)");
          const rank = rows.indexOf(d) + 1;
          showTooltip(event, d, rank);
        })
        .on("mousemove", positionTooltip)
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.88).attr("filter", null);
          hideTooltip();
        })
        .transition(T)
        .attr("y", d => yBand(d.country) ?? 0)
        .attr("height", yBand.bandwidth())
        .attr("width", d => x(d.value))
        .attr("fill", (_, i) => colorScale(i)),

      exit => exit.transition(T).attr("width", 0).attr("opacity", 0).remove()
    );

  // ── Value labels (end of bar) ─────────────────────────────────────
  g.select(".bar-labels")
    .selectAll(".bar-label")
    .data(rows, d => d.country)
    .join(
      enter => enter.append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.value) + 8)
        .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .attr("font-family", CONFIG.fontMono)
        .attr("font-size", 11)
        .attr("fill", CONFIG.colorSub)
        .attr("opacity", 0)
        .text(d => d3.format("~s")(d.value))
        .call(e => e.transition(T).attr("opacity", 1)),

      update => update.transition(T)
        .attr("x", d => x(d.value) + 8)
        .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
        .text(d => d3.format("~s")(d.value))
        .attr("opacity", 1),

      exit => exit.transition(T).attr("opacity", 0).remove()
    );

  // ── Rank labels (left of country name) ──────────────────────────
  g.select(".rank-labels")
    .selectAll(".rank-label")
    .data(rows, d => d.country)
    .join(
      enter => enter.append("text")
        .attr("class", "rank-label")
        .attr("x", -margin.left + 4)
        .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "start")
        .attr("font-family", CONFIG.fontMono)
        .attr("font-size", 10)
        .attr("fill", CONFIG.colorMuted)
        .attr("opacity", 0)
        .text((_, i) => `#${String(i + 1).padStart(2, "0")}`)
        .call(e => e.transition(T).attr("opacity", 0.7)),

      update => update.transition(T)
        .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
        .text((_, i) => `#${String(i + 1).padStart(2, "0")}`)
        .attr("opacity", 0.7),

      exit => exit.transition(T).attr("opacity", 0).remove()
    );

  // Update x-axis label position
  svg.select(".x-axis-label")
    .attr("x", margin.left + innerW / 2)
    .attr("y", totalH - 6);
}

/** Apply consistent axis text styling after a transition call */
function styleAxis(selection, isY) {
  selection.selectAll("text")
    .attr("font-family", CONFIG.fontMono)
    .attr("font-size",   isY ? 11 : 11)
    .attr("fill",        CONFIG.colorSub);

  selection.selectAll(".domain")
    .attr("stroke", CONFIG.colorMuted)
    .attr("opacity", 0.4);

  selection.selectAll(".tick line")
    .attr("stroke", CONFIG.colorMuted)
    .attr("opacity", 0.4);
}

// ── Responsive resize ─────────────────────────────────────────────────────────

function attachResize(handler) {
  let raf = null;
  window.addEventListener("resize", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(handler);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main() {
  // Footer year
  const footerYear = document.querySelector("#year");
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());

  const data  = await loadData();
  const years = uniqueYears(data);

  // ── Populate year select ───────────────────────────────────────
  if (yearSelect) {
    yearSelect.innerHTML = "";
    for (const y of years) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
    // Default to latest year
    yearSelect.value = String(years[years.length - 1]);
  }

  // ── Populate Top-N select (if present in HTML) ─────────────────
  // Falls back to CONFIG.defaultTopN if the element doesn't exist.
  if (topNSelect) {
    topNSelect.innerHTML = "";
    for (const n of [5, 10, 15, 20, 25]) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === CONFIG.defaultTopN) opt.selected = true;
      topNSelect.appendChild(opt);
    }
  }

  // ── Update function (called on every control change) ────────────
  const update = () => {
    const year = yearSelect ? Number(yearSelect.value)
                            : years[years.length - 1];
    const topN = topNSelect  ? Number(topNSelect.value)
                             : CONFIG.defaultTopN;
    const rows = topNByYear(data, year, topN);

    if (metaTitle) metaTitle.textContent = `Top ${topN} Countries`;
    if (metaSub)   metaSub.textContent   = `EV Sales · ${year}`;

    renderOrUpdate(chartEl, rows, year);
  };

  yearSelect?.addEventListener("change", update);
  topNSelect?.addEventListener("change", update);
  attachResize(update);

  update();
}

main();
