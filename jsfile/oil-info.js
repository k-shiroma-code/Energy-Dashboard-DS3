// oil-info.js – vanilla D3 v7
// Mounts into: <div id="chart"> (oil-info.html)
// CSV paths: /data/oil_forecast.csv & /data/net_trade.csv

(function () {
  "use strict";

  // ── Palette ─────────────────────────────────────────────────────────────
  const COLORS = [
    "#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed",
    "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1",
  ];

  // ── Dimensions ────────────────────────────────────────────────────────────
  const MARGIN = { top: 24, right: 32, bottom: 52, left: 72 };
  const TOTAL_W = 860;
  const TOTAL_H = 400;
  const W = TOTAL_W - MARGIN.left - MARGIN.right;
  const H = TOTAL_H - MARGIN.top - MARGIN.bottom;

  // ── Global State (Single Declaration) ─────────────────────────────────────
  let forecastData = []; 
  let netTradeData = []; 
  let allData      = []; // The "active" dataset being graphed
  let active       = []; // Selected country names
  let startYear    = 2000;
  let view         = "imports";

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const chartDiv   = document.getElementById("chart");
  const emptyState = document.getElementById("emptyState");
  const yearSelect = document.getElementById("yearSelect");
  const viewSelect = document.getElementById("viewSelect");
  const metaTitle  = document.getElementById("metaTitle");
  const metaSub    = document.getElementById("metaSub");
  const yearEl     = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ── SVG setup globals ─────────────────────────────────────────────────────
  let svg, gMain, xScale, yScale, tooltip;

  // ── UI Injection (Chips, Stats, Table) ────────────────────────────────────
  const mainContainer = document.querySelector("main.container");

  const statGrid = document.createElement("div");
  statGrid.className = "oil-stat-grid";
  statGrid.id = "statGrid";
  const chartSection = document.querySelector("section[aria-label='Oil trade visualization']");
  mainContainer.insertBefore(statGrid, chartSection);

  const chipsSection = document.createElement("section");
  chipsSection.className = "card";
  chipsSection.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <span style="font-size:13px;font-weight:600;color:#6b7280">Countries:</span>
      <button id="chipAll" class="chip-ctrl-btn">All</button>
      <button id="chipClear" class="chip-ctrl-btn">Clear</button>
    </div>
    <div id="chipRow" style="display:flex;flex-wrap:wrap;gap:8px"></div>
  `;
  mainContainer.appendChild(chipsSection);

  const tableSection = document.createElement("section");
  tableSection.className = "card";
  tableSection.innerHTML = `
    <p class="oil-section-label" id="tableLabel">Forecast Summary</p>
    <div id="summaryTable" style="overflow-x:auto"></div>
  `;
  mainContainer.appendChild(tableSection);

  // ── CSS ──────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    .oil-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
    .oil-stat-card{background:#f9fafb;border-radius:10px;padding:18px 20px;border:1px solid #e5e7eb}
    .oil-stat-label{font-size:11px;font-weight:600;text-transform:uppercase;color:#9ca3af;margin:0 0 6px}
    .oil-stat-value{font-size:1.8rem;font-weight:700;color:#111827;margin:0 0 2px;font-family:monospace}
    .oil-stat-sub{font-size:12px;color:#6b7280;margin:0}
    .chip-ctrl-btn{padding:4px 12px;border-radius:20px;border:1px solid #d1d5db;background:#fff;font-size:12px;cursor:pointer}
    .country-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;font-size:12px;cursor:pointer;color:#6b7280}
    .country-chip.active{color:#111827;border-color:var(--chip-color);background:color-mix(in srgb,var(--chip-color) 10%,#fff)}
    .chip-dot{width:8px;height:8px;border-radius:50%}
    .oil-table{width:100%;border-collapse:collapse;font-size:13px}
    .oil-table th{text-align:left;padding:8px;color:#9ca3af;border-bottom:2px solid #e5e7eb}
    .oil-table td{padding:10px 8px;border-bottom:1px solid #f3f4f6}
    .change-up{color:#16a34a;font-weight:600}
    .change-down{color:#ef4444;font-weight:600}
    .oil-tooltip{position:absolute;pointer-events:none;z-index:100;}
  `;
  document.head.appendChild(style);

  // ── Functions ─────────────────────────────────────────────────────────────

  function buildSVG() {
    chartDiv.innerHTML = "";
    svg = d3.select(chartDiv).append("svg")
      .attr("width", TOTAL_W).attr("height", TOTAL_H)
      .style("display", "block").style("margin", "0 auto");

    gMain = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    tooltip = d3.select(chartDiv).append("div").attr("class", "oil-tooltip")
      .style("background", "rgba(26,26,26,.9)").style("color", "#fff")
      .style("padding", "10px").style("border-radius", "8px").style("display", "none");

    svg.append("rect")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)
      .attr("width", W).attr("height", H).attr("fill", "none").attr("pointer-events", "all")
      .on("mousemove", onMouseMove)
      .on("mouseleave", () => {
        gMain.select(".crosshair").style("display", "none");
        tooltip.style("display", "none");
      });
  }

  function render() {
    const selected = allData.filter(d => active.includes(d.country));
    
    if (!selected.length) {
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = "Please select at least one country to view data.";
      }
      return;
    }
    if (emptyState) emptyState.hidden = true;

    updateStats(selected);
    renderChart(selected);
    renderTable();
  }

  function updateStats(selected) {
    const totalLastActual = selected.reduce((s, d) => s + (d.history.at(-1)?.value ?? 0), 0);
    const label = view === "net" ? "Total Net Trade" : "Total Imports";

    statGrid.innerHTML = `
      <div class="oil-stat-card">
        <p class="oil-stat-label">${label} (2023)</p>
        <p class="oil-stat-value">${Math.round(totalLastActual).toLocaleString()}</p>
        <p class="oil-stat-sub">KBD for selected</p>
      </div>
      <div class="oil-stat-card">
        <p class="oil-stat-label">Countries Selected</p>
        <p class="oil-stat-value">${active.length}</p>
        <p class="oil-stat-sub">out of ${allData.length}</p>
      </div>
    `;
    if (metaTitle) metaTitle.textContent = view === "net" ? "Net Oil Trade (KBD)" : "Oil Imports (KBD)";
    if (metaSub) metaSub.textContent = `Historical + Forecast · Baseline: ${startYear}`;
  }

  function renderChart(selected) {
    buildSVG();

    const filtered = selected.map(d => ({
      ...d,
      history: d.history.filter(p => p.year >= startYear)
    }));

    const allPts = filtered.flatMap(d => [...d.history, ...d.forecast, ...d.conf_int.map(p => ({value: p.upper}))]);
    const xMin = startYear;
    const xMax = d3.max(allPts, p => p.year) || 2030;
    const yMax = d3.max(allPts, p => p.value) * 1.1 || 1000;

    xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, W]);
    yScale = d3.scaleLinear().domain([0, yMax]).range([H, 0]);

    // Grid
    gMain.selectAll(".y-grid").data(yScale.ticks(5)).join("line")
      .attr("x1", 0).attr("x2", W).attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
      .attr("stroke", "#e5e7eb").attr("stroke-dasharray", "4,3");

    // Lines
    const lineGen = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value));

    filtered.forEach(d => {
      // Historical
      gMain.append("path").datum(d.history).attr("d", lineGen)
        .attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      
      // Forecast
      const conn = [d.history.at(-1), ...d.forecast].filter(Boolean);
      gMain.append("path").datum(conn).attr("d", lineGen)
        .attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4");
    });

    // Crosshair
    gMain.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", H)
      .attr("stroke", "#9ca3af").attr("stroke-dasharray", "4,3").style("display", "none");

    // Axes
    gMain.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
    gMain.append("g").call(d3.axisLeft(yScale).tickFormat(d => d >= 1000 ? (d/1000)+"k" : d));

    svg._data = filtered;
  }

  function onMouseMove(event) {
    if (!svg._data) return;
    const [mx] = d3.pointer(event);
    const year = Math.round(xScale.invert(mx));
    const cx = xScale(year);

    gMain.select(".crosshair").style("display", null).attr("x1", cx).attr("x2", cx);

    const points = svg._data.map(d => {
      const p = [...d.history, ...d.forecast].find(pt => pt.year === year);
      return p ? { name: d.country, color: d.color, val: p.value } : null;
    }).filter(Boolean);

    if (!points.length) return tooltip.style("display", "none");

    tooltip.style("display", "block").style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px")
      .html(`<b>${year}</b><br>` + points.map(p => `<div style="color:${p.color}">${p.name}: ${Math.round(p.val).toLocaleString()}</div>`).join(""));
  }

  function renderTable() {
    const tableEl = document.getElementById("summaryTable");
    const lastYear = allData[0]?.forecast.at(-1)?.year ?? 2030;
    
    let html = `<table class="oil-table"><thead><tr><th>Country</th><th>2023 Actual</th><th>${lastYear} Forecast</th><th>Change</th></tr></thead><tbody>`;
    allData.forEach(d => {
      const act = d.history.at(-1)?.value || 0;
      const fct = d.forecast.at(-1)?.value || 0;
      const diff = act ? ((fct - act) / act * 100) : 0;
      html += `<tr>
        <td><span style="color:${d.color}">●</span> ${d.country}</td>
        <td>${Math.round(act).toLocaleString()}</td>
        <td>${Math.round(fct).toLocaleString()}</td>
        <td class="${diff > 0 ? 'change-up' : 'change-down'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}%</td>
      </tr>`;
    });
    tableEl.innerHTML = html + `</tbody></table>`;
  }

  function buildChips() {
    const chipRow = document.getElementById("chipRow");
    chipRow.innerHTML = "";
    allData.forEach(d => {
      const btn = document.createElement("button");
      btn.className = `country-chip ${active.includes(d.country) ? 'active' : ''}`;
      btn.style.setProperty("--chip-color", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.onclick = () => {
        active = active.includes(d.country) ? active.filter(c => c !== d.country) : [...active, d.country];
        buildChips(); render();
      };
      chipRow.appendChild(btn);
    });
  }

  function parseCSV(rawData) {
    const countries = [...new Set(rawData.map(d => d.country))];
    return countries.map((country, i) => {
      const rows = rawData.filter(d => d.country === country);
      return {
        country,
        color: COLORS[i % COLORS.length],
        history: rows.filter(d => d.type === "history").map(d => ({ year: +d.year, value: +d.value })),
        forecast: rows.filter(d => d.type === "forecast").map(d => ({ year: +d.year, value: +d.value })),
        conf_int: rows.filter(d => d.type === "forecast").map(d => ({ year: +d.year, lower: +d.lower, upper: +d.upper }))
      };
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  Promise.all([
    d3.csv("../data/oil_forecast.csv"),
    d3.csv("../data/net_trade.csv")
  ]).then(([forecastRaw, netRaw]) => {
    forecastData = parseCSV(forecastRaw);
    netTradeData = parseCSV(netRaw);

    // Initial State
    view = viewSelect?.value || "imports";
    allData = (view === "net") ? netTradeData : forecastData;
    active = allData.slice(0, 5).map(d => d.country);

    // View Switcher
    d3.select("#viewSelect").on("change", function() {
      view = this.value;
      allData = (view === "net") ? netTradeData : forecastData;
      active = allData.slice(0, 5).map(d => d.country);
      buildChips();
      render();
    });

    // Year Switcher
    d3.select("#yearSelect").on("change", function() {
      startYear = +this.value;
      render();
    });

    document.getElementById("chipAll").onclick = () => { active = allData.map(d => d.country); buildChips(); render(); };
    document.getElementById("chipClear").onclick = () => { active = []; buildChips(); render(); };

    buildChips();
    render();
  }).catch(err => {
    console.error(err);
    chartDiv.innerHTML = "Error loading data.";
  });

})();
