// oil-info.js  –  vanilla D3 v7, no React
// Mounts into:  <div id="chart">  (oil-info.html)
// CSV path:     /data/oil_forecast.csv
// ── State ─────────────────────────────────────────────────────────────────
  let forecastData = []; // <--- Add this (for oil_forecast.csv)
  let netTradeData = []; // <--- Add this (for net_trade.csv)
  let allData      = []; // This remains your "active" source for the chart
  let active       = []; 
  let startYear    = 2000;
  let view         = "imports";

(function () {
  "use strict";

  // ── Palette (matches Oil.jsx) ─────────────────────────────────────────────
  const COLORS = [
    "#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed",
    "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1",
  ];

  // ── Dimensions ────────────────────────────────────────────────────────────
  const MARGIN = { top: 24, right: 32, bottom: 52, left: 72 };
  const TOTAL_W = 860;
  const TOTAL_H = 400;
  const W = TOTAL_W - MARGIN.left - MARGIN.right;
  const H = TOTAL_H - MARGIN.top  - MARGIN.bottom;

  // ── State ─────────────────────────────────────────────────────────────────
  let allData   = [];   // parsed country objects
  let active    = [];   // currently selected country names
  let startYear = 2000; // controlled by #yearSelect
  let view      = "imports"; // controlled by #viewSelect

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const chartDiv   = document.getElementById("chart");
  const emptyState = document.getElementById("emptyState");
  const yearSelect = document.getElementById("yearSelect");
  const viewSelect = document.getElementById("viewSelect");
  const metaTitle  = document.getElementById("metaTitle");
  const metaSub    = document.getElementById("metaSub");
  const dataHint   = document.getElementById("dataHint");
  const yearEl     = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ── Inject chip + table containers after chart section ───────────────────
  const mainContainer = document.querySelector("main.container");

  const chipsSection = document.createElement("section");
  chipsSection.className = "card";
  chipsSection.setAttribute("aria-label", "Country filter");
  chipsSection.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <span style="font-size:13px;font-weight:600;color:#6b7280">Countries:</span>
      <button id="chipAll"   class="chip-ctrl-btn">All</button>
      <button id="chipClear" class="chip-ctrl-btn">Clear</button>
    </div>
    <div id="chipRow" style="display:flex;flex-wrap:wrap;gap:8px"></div>
  `;
  mainContainer.appendChild(chipsSection);

  const tableSection = document.createElement("section");
  tableSection.className = "card";
  tableSection.setAttribute("aria-label", "Forecast summary table");
  tableSection.innerHTML = `
    <p class="oil-section-label" id="tableLabel">Forecast Summary</p>
    <div id="summaryTable" style="overflow-x:auto"></div>
  `;
  mainContainer.appendChild(tableSection);

  const footnote = document.createElement("p");
  footnote.style.cssText = "font-size:11px;color:#9ca3af;text-align:center;margin:16px 0 40px";
  footnote.textContent = "Source: JODI Oil World Database · Log-ARIMA models selected via AIC grid search · Forecast horizon: 2024–2030";
  mainContainer.appendChild(footnote);

  // ── Inject minimal styles for chips & stats ────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    .oil-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
    .oil-stat-card{background:#f9fafb;border-radius:10px;padding:18px 20px;border:1px solid #e5e7eb}
    .oil-stat-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin:0 0 6px}
    .oil-stat-value{font-size:1.8rem;font-weight:700;color:#111827;margin:0 0 2px;font-family:'Space Mono',monospace}
    .oil-stat-sub{font-size:12px;color:#6b7280;margin:0}
    .chip-ctrl-btn{padding:4px 12px;border-radius:20px;border:1px solid #d1d5db;background:#fff;font-size:12px;cursor:pointer;font-weight:500;color:#374151}
    .chip-ctrl-btn:hover{background:#f3f4f6}
    .country-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;font-size:12px;font-weight:500;cursor:pointer;color:#6b7280;transition:all .15s}
    .country-chip.active{color:#111827;border-color:var(--chip-color);background:color-mix(in srgb,var(--chip-color) 10%,#fff)}
    .chip-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .oil-table{width:100%;border-collapse:collapse;font-size:13px}
    .oil-table th{text-align:left;padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;border-bottom:2px solid #e5e7eb}
    .oil-table td{padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151}
    .oil-table tbody tr:hover{background:#f9fafb}
    .td-country{display:flex;align-items:center;gap:8px;font-weight:500}
    .td-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .td-mono{font-family:'Space Mono',monospace;font-size:12px}
    .change-up{color:#16a34a;font-weight:600}
    .change-down{color:#ef4444;font-weight:600}
    .change-flat{color:#6b7280;font-weight:600}
    .mape-badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
    .mape-good{background:#dcfce7;color:#15803d}
    .mape-ok{background:#fef9c3;color:#a16207}
    .mape-weak{background:#fee2e2;color:#b91c1c}
    .oil-section-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin:0 0 16px}
    .oil-notice{padding:40px;text-align:center;color:#9ca3af;font-size:14px}
  `;
  document.head.appendChild(style);

  // ── Build stat cards above chart ──────────────────────────────────────────
  const chartSection = document.querySelector("section[aria-label='Oil trade visualization']");
  const statGrid = document.createElement("div");
  statGrid.className = "oil-stat-grid";
  statGrid.id = "statGrid";
  mainContainer.insertBefore(statGrid, chartSection);

  // ── SVG setup ─────────────────────────────────────────────────────────────
  let svg, gMain, xScale, yScale, tooltip;

  function buildSVG() {
    chartDiv.innerHTML = "";
    const svgEl = d3.select(chartDiv)
      .append("svg")
      .attr("width", TOTAL_W)
      .attr("height", TOTAL_H)
      .style("display", "block")
      .style("margin", "0 auto")
      .style("cursor", "crosshair");

    svg = svgEl;
    gMain = svgEl.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // tooltip
    d3.select(chartDiv).selectAll(".oil-tooltip").remove();
    tooltip = d3.select(chartDiv)
      .append("div")
      .attr("class", "oil-tooltip")
      .style("position", "absolute")
      .style("top", `${MARGIN.top + 8}px`)
      .style("background", "rgba(26,26,26,.88)")
      .style("color", "#fff")
      .style("border-radius", "8px")
      .style("padding", "10px 14px")
      .style("font-size", "12px")
      .style("line-height", "1.8")
      .style("pointer-events", "none")
      .style("min-width", "140px")
      .style("font-family", "DM Sans,sans-serif")
      .style("box-shadow", "0 4px 16px rgba(0,0,0,.2)")
      .style("display", "none");

    // mouse tracking overlay
    svgEl.append("rect")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)
      .attr("width", W)
      .attr("height", H)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mousemove", onMouseMove)
      .on("mouseleave", () => {
        gMain.select(".crosshair").style("display", "none");
        tooltip.style("display", "none");
      });
  }

  // ── Render everything ─────────────────────────────────────────────────────
  function render() {
    if (!allData.length) return;

    const selected = allData.filter(d => active.includes(d.country));

    // Handle non-import views
    if (view !== "imports") {
      emptyState && (emptyState.hidden = false);
      emptyState && (emptyState.textContent = `${view === "exports" ? "Export" : "Net trade"} data is not available in this dataset. Showing import data only.`);
      // still render but with a notice
    } else {
      emptyState && (emptyState.hidden = true);
    }

    updateStats(selected);
    renderChart(selected);
    renderTable();
  }

  // ── Stats cards ───────────────────────────────────────────────────────────
  function updateStats(selected) {
    const lastFcYear = allData[0]?.forecast.at(-1)?.year ?? 2030;
    const total2023  = allData.reduce((s, d) => s + (d.history.at(-1)?.value ?? 0), 0);
    const top        = allData[0];
    const avgChange  = allData.length
      ? allData.reduce((s, d) => {
          const act = d.history.at(-1)?.value ?? 0;
          const fc  = d.forecast.at(-1)?.value ?? 0;
          return s + (act ? ((fc - act) / act) * 100 : 0);
        }, 0) / allData.length
      : 0;

    statGrid.innerHTML = `
      <div class="oil-stat-card">
        <p class="oil-stat-label">Total 2023 Imports (Top 10)</p>
        <p class="oil-stat-value">${Math.round(total2023).toLocaleString()}</p>
        <p class="oil-stat-sub">KBD combined</p>
      </div>
      <div class="oil-stat-card">
        <p class="oil-stat-label">Largest Importer · 2023</p>
        <p class="oil-stat-value" style="font-size:1.4rem">${top?.country ?? "—"}</p>
        <p class="oil-stat-sub">${Math.round(top?.history.at(-1)?.value ?? 0).toLocaleString()} KBD</p>
      </div>
      <div class="oil-stat-card">
        <p class="oil-stat-label">Avg Forecast Change to ${lastFcYear}</p>
        <p class="oil-stat-value" style="color:${avgChange >= 0 ? "#16a34a" : "#ef4444"}">${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(1)}%</p>
        <p class="oil-stat-sub ${avgChange >= 2 ? "change-up" : avgChange <= -2 ? "change-down" : "change-flat"}">
          ${avgChange >= 2 ? "↑ Growing demand" : avgChange <= -2 ? "↓ Declining demand" : "→ Stable demand"}
        </p>
      </div>
      <div class="oil-stat-card">
        <p class="oil-stat-label">Countries Selected</p>
        <p class="oil-stat-value">${active.length}</p>
        <p class="oil-stat-sub">of ${allData.length} tracked</p>
      </div>
    `;

    if (metaTitle) metaTitle.textContent = "Oil Imports (KBD)";
    if (metaSub)   metaSub.textContent   = `Historical + Forecast · Start year: ${startYear}`;
  }

  // ── Line chart ────────────────────────────────────────────────────────────
  function renderChart(selected) {
    buildSVG();

    const filteredSelected = selected.map(d => ({
      ...d,
      history:  d.history.filter(p => p.year >= startYear),
      forecast: d.forecast,
      conf_int: d.conf_int,
    }));

    // Scales
    const allPts = filteredSelected.flatMap(d => [
      ...d.history,
      ...d.forecast,
      ...d.conf_int.map(p => ({ year: p.year, value: p.upper })),
    ]);
    if (!allPts.length) return;

    const xMin = d3.min(allPts, p => p.year);
    const xMax = d3.max(allPts, p => p.year);
    const yMax = d3.max(allPts, p => p.value) * 1.12;

    xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, W]);
    yScale = d3.scaleLinear().domain([0, yMax]).range([H, 0]);

    // Y grid + ticks
    const yStep = Math.ceil(yMax / 6 / 500) * 500;
    const yTicks = d3.range(0, yMax + yStep, yStep);

    gMain.selectAll(".y-grid")
      .data(yTicks).join("line")
      .attr("class", "y-grid")
      .attr("x1", 0).attr("x2", W)
      .attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
      .attr("stroke", "#e5e7eb").attr("stroke-dasharray", "4,3").attr("stroke-width", 1);

    // Forecast divider
    const divX = xScale(2024);
    gMain.append("line")
      .attr("x1", divX).attr("x2", divX).attr("y1", 0).attr("y2", H)
      .attr("stroke", "#d1d5db").attr("stroke-dasharray", "6,3").attr("stroke-width", 1.5);
    gMain.append("text")
      .attr("x", divX + 6).attr("y", 14)
      .attr("fill", "#9ca3af").attr("font-size", 10)
      .attr("font-family", "Space Mono,monospace")
      .text("Forecast →");

    // CI bands
    filteredSelected.forEach(d => {
      if (!d.conf_int.length) return;
      const area = d3.area()
        .x(p => xScale(p.year))
        .y0(p => yScale(p.lower))
        .y1(p => yScale(p.upper));
      gMain.append("path")
        .datum(d.conf_int)
        .attr("d", area)
        .attr("fill", d.color)
        .attr("opacity", 0.09);
    });

    // Line generator
    const line = d3.line().x(p => xScale(p.year)).y(p => yScale(p.value));

    // Historical lines
    filteredSelected.forEach(d => {
      gMain.append("path")
        .datum(d.history)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", d.color)
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    });

    // Forecast lines (connect from last history point)
    filteredSelected.forEach(d => {
      const conn = [d.history.at(-1), ...d.forecast].filter(Boolean);
      gMain.append("path")
        .datum(conn)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", d.color)
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", "7,4")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    });

    // End-of-forecast dots
    filteredSelected.forEach(d => {
      const last = d.forecast.at(-1);
      if (!last) return;
      gMain.append("circle")
        .attr("cx", xScale(last.year)).attr("cy", yScale(last.value))
        .attr("r", 4).attr("fill", d.color)
        .attr("stroke", "#fff").attr("stroke-width", 2);
    });

    // Crosshair line (hidden until hover)
    gMain.append("line")
      .attr("class", "crosshair")
      .attr("y1", 0).attr("y2", H)
      .attr("stroke", "#9ca3af").attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,3")
      .style("display", "none");

    // X axis
    gMain.append("line")
      .attr("x1", 0).attr("x2", W).attr("y1", H).attr("y2", H)
      .attr("stroke", "#e5e7eb");

    const xStep = xMax - xMin > 20 ? 4 : 2;
    const xTicks = d3.range(Math.ceil(xMin / xStep) * xStep, xMax + 1, xStep);
    xTicks.forEach(y => {
      gMain.append("line")
        .attr("x1", xScale(y)).attr("x2", xScale(y))
        .attr("y1", H).attr("y2", H + 5)
        .attr("stroke", "#d1d5db");
      gMain.append("text")
        .attr("x", xScale(y)).attr("y", H + 19)
        .attr("text-anchor", "middle")
        .attr("fill", "#9ca3af").attr("font-size", 11)
        .attr("font-family", "Space Mono,monospace")
        .text(y);
    });

    // Y axis
    gMain.append("line")
      .attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", H)
      .attr("stroke", "#e5e7eb");
    yTicks.forEach(v => {
      gMain.append("text")
        .attr("x", -10).attr("y", yScale(v) + 4)
        .attr("text-anchor", "end")
        .attr("fill", "#9ca3af").attr("font-size", 11)
        .attr("font-family", "Space Mono,monospace")
        .text(v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v);
    });

    // Axis labels
    gMain.append("text")
      .attr("x", W / 2).attr("y", H + 46)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280").attr("font-size", 12)
      .attr("font-family", "DM Sans,sans-serif")
      .text("Year");

    gMain.append("text")
      .attr("transform", `translate(-56,${H / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280").attr("font-size", 12)
      .attr("font-family", "DM Sans,sans-serif")
      .text("Imports (KBD)");

    // Legend
    const legendDiv = d3.select(chartDiv).select(".oil-legend");
    d3.select(chartDiv).selectAll(".oil-legend").remove();
    const leg = d3.select(chartDiv).append("div")
      .attr("class", "oil-legend")
      .style("display", "flex")
      .style("justify-content", "center")
      .style("gap", "24px")
      .style("margin-top", "16px")
      .style("font-size", "12px")
      .style("color", "#6b7280");

    leg.append("div").style("display","flex").style("align-items","center").style("gap","6px")
      .html(`<svg width="28" height="4"><line x1="0" x2="28" y1="2" y2="2" stroke="#6b7280" stroke-width="2.5"/></svg>Historical`);
    leg.append("div").style("display","flex").style("align-items","center").style("gap","6px")
      .html(`<svg width="28" height="4"><line x1="0" x2="28" y1="2" y2="2" stroke="#6b7280" stroke-width="2.5" stroke-dasharray="7,4"/></svg>Forecast`);
    leg.append("div").style("display","flex").style("align-items","center").style("gap","6px")
      .html(`<div style="width:28px;height:10px;background:#6b7280;opacity:.15;border-radius:3px"></div>95% CI`);

    // Store for hover
    svg._filteredSelected = filteredSelected;
    svg._xMin = xMin; svg._xMax = xMax;
  }

  // ── Hover handler ─────────────────────────────────────────────────────────
  function onMouseMove(event) {
    const fs = svg._filteredSelected;
    if (!fs || !fs.length) return;

    const [mx] = d3.pointer(event);
    const xMin = svg._xMin, xMax = svg._xMax;
    const year = Math.round(xScale.invert(mx));
    if (year < xMin || year > xMax) {
      gMain.select(".crosshair").style("display", "none");
      tooltip.style("display", "none");
      return;
    }

    const cx = xScale(year);
    gMain.select(".crosshair")
      .style("display", null)
      .attr("x1", cx).attr("x2", cx);

    const points = fs.map(d => {
      const hp = d.history.find(p => p.year === year);
      const fp = d.forecast.find(p => p.year === year);
      return { country: d.country, color: d.color, value: (fp ?? hp)?.value };
    }).filter(p => p.value != null);

    if (!points.length) { tooltip.style("display", "none"); return; }

    const tooltipX = Math.min(MARGIN.left + cx + 14, TOTAL_W - 160);
    const rows = points.map(p =>
      `<div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
        <span style="color:#d1d5db">${p.country}</span>
        <span style="margin-left:auto;font-family:Space Mono,monospace;font-size:11px">${Math.round(p.value).toLocaleString()}</span>
      </div>`
    ).join("");

    tooltip
      .style("display", "block")
      .style("left", `${tooltipX}px`)
      .html(`<div style="font-family:Space Mono,monospace;font-size:11px;color:#9ca3af;margin-bottom:6px">${year}</div>${rows}`);
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  function renderTable() {
    const lastFcYear = allData[0]?.forecast.at(-1)?.year ?? 2030;
    const hasMape  = allData.some(d => d.mape  != null);
    const hasOrder = allData.some(d => d.order != null);

    document.getElementById("tableLabel").textContent =
      `Forecast Summary — 2023 → ${lastFcYear}`;

    const rows = allData.map(d => {
      const actual = d.history.at(-1)?.value ?? 0;
      const fc     = d.forecast.at(-1)?.value ?? 0;
      const pct    = actual ? ((fc - actual) / actual) * 100 : 0;
      const cls    = pct >= 2 ? "change-up" : pct <= -2 ? "change-down" : "change-flat";
      const mape   = hasMape
        ? (d.mape != null
            ? `<span class="mape-badge ${d.mape < 5 ? "mape-good" : d.mape < 10 ? "mape-ok" : "mape-weak"}">${d.mape.toFixed(1)}%</span>`
            : "—")
        : "";
      return `
        <tr>
          <td><div class="td-country">
            <span class="td-dot" style="background:${d.color}"></span>${d.country}
          </div></td>
          <td class="td-mono">${Math.round(actual).toLocaleString()} KBD</td>
          <td class="td-mono">${Math.round(fc).toLocaleString()} KBD</td>
          <td><span class="${cls}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span></td>
          ${hasMape  ? `<td>${mape}</td>` : ""}
          ${hasOrder ? `<td class="td-mono">${d.order ?? "—"}</td>` : ""}
        </tr>`;
    }).join("");

    document.getElementById("summaryTable").innerHTML = `
      <table class="oil-table">
        <thead><tr>
          <th>Country</th>
          <th>2023 Actual</th>
          <th>${lastFcYear} Forecast</th>
          <th>Change</th>
          ${hasMape  ? "<th>MAPE</th>"        : ""}
          ${hasOrder ? "<th>ARIMA Order</th>" : ""}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── Chip controls ─────────────────────────────────────────────────────────
  function buildChips() {
    const chipRow = document.getElementById("chipRow");
    chipRow.innerHTML = "";

    allData.forEach(d => {
      const btn = document.createElement("button");
      btn.className = `country-chip ${active.includes(d.country) ? "active" : ""}`;
      btn.style.setProperty("--chip-color", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.addEventListener("click", () => {
        if (active.includes(d.country)) {
          if (active.length > 1) active = active.filter(c => c !== d.country);
        } else {
          active = [...active, d.country];
        }
        buildChips();
        render();
      });
      chipRow.appendChild(btn);
    });

    document.getElementById("chipAll").onclick = () => {
      active = allData.map(d => d.country);
      buildChips(); render();
    };
    document.getElementById("chipClear").onclick = () => {
      active = allData.length ? [allData[0].country] : [];
      buildChips(); render();
    };
  }

  // ── Year select ───────────────────────────────────────────────────────────
  function buildYearSelect() {
    // Use start-year options (zoom in/out of history)
    const options = [1971, 1980, 1990, 2000, 2010, 2015, 2020];
    yearSelect.innerHTML = "";
    options.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = `From ${y}`;
      if (y === startYear) opt.selected = true;
      yearSelect.appendChild(opt);
    });
    yearSelect.addEventListener("change", () => {
      startYear = +yearSelect.value;
      render();
    });
  }

  // ── View select ───────────────────────────────────────────────────────────
  viewSelect?.addEventListener("change", () => {
    view = viewSelect.value;
    if (dataHint) {
      dataHint.textContent = view !== "imports"
        ? `Note: only import data is available in this dataset. Showing imports.`
        : "";
    }
    render();
  });

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  function parseCSV(rawData) {
    const countries = [...new Set(rawData.map(d => d.country))];
    return countries.map((country, i) => {
      const rows  = rawData.filter(d => d.country === country);
      const first = rows[0];
      const mapeVal = first.mape !== "" ? +first.mape : null;
      return {
        country,
        color:    COLORS[i % COLORS.length],
        mape:     isNaN(mapeVal) ? null : mapeVal,
        order:    first.order || null,
        history:  rows
          .filter(d => d.type === "history" && !isNaN(+d.value))
          .map(d => ({ year: +d.year, value: +d.value })),
        forecast: rows
          .filter(d => d.type === "forecast")
          .map(d => ({ year: +d.year, value: +d.value })),
        conf_int: rows
          .filter(d => d.type === "forecast")
          .map(d => ({ year: +d.year, lower: +d.lower, upper: +d.upper })),
      };
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  d3.csv("/data/oil_forecast.csv").then(rawData => {
    allData = parseCSV(rawData);
    active  = allData.map(d => d.country);

    buildYearSelect();
    buildChips();
    render();
  }).catch(err => {
    console.error("Failed to load oil_forecast.csv:", err);
    chartDiv.innerHTML = `<div class="oil-notice">⚠ Could not load /data/oil_forecast.csv — make sure it exists in your /public/data folder.</div>`;
  });

})();

