// oil-info.js – Complete Integrated Script
(function () {
  "use strict";

  // ── Configuration & State ────────────────────────────────────────────────
  const COLORS = [
    "#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed",
    "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1",
  ];

  const MARGIN = { top: 24, right: 32, bottom: 52, left: 72 };
  const TOTAL_W = 860;
  const TOTAL_H = 400;
  const W = TOTAL_W - MARGIN.left - MARGIN.right;
  const H = TOTAL_H - MARGIN.top - MARGIN.bottom;

  let forecastRawGlobal = []; 
  let netRawGlobal      = [];
  let allData           = []; 
  let active            = []; 
  let startYear         = 2000;
  let view              = "imports";

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const chartDiv   = document.getElementById("chart");
  const yearSelect = document.getElementById("yearSelect");
  const viewSelect = document.getElementById("viewSelect");
  const metaTitle  = document.getElementById("metaTitle");
  const metaSub    = document.getElementById("metaSub");
  const dataHint   = document.getElementById("dataHint");
  const mainContainer = document.querySelector("main.container");

  // ── SVG & Tooltip Elements ────────────────────────────────────────────────
  let svg, gMain, xScale, yScale, tooltip;

  // ── Initialization ────────────────────────────────────────────────────────
  
  // 1. Inject Styles
  const style = document.createElement("style");
  style.textContent = `
    .oil-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
    .oil-stat-card{background:#f9fafb;border-radius:10px;padding:18px 20px;border:1px solid #e5e7eb}
    .oil-stat-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin:0 0 6px}
    .oil-stat-value{font-size:1.8rem;font-weight:700;color:#111827;margin:0 0 2px;font-family:'Space Mono',monospace}
    .oil-stat-sub{font-size:12px;color:#6b7280;margin:0}
    .chip-ctrl-btn{padding:4px 12px;border-radius:20px;border:1px solid #d1d5db;background:#fff;font-size:12px;cursor:pointer;font-weight:500;color:#374151}
    .country-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;font-size:12px;font-weight:500;cursor:pointer;color:#6b7280;transition:all .15s}
    .country-chip.active{color:#111827;border-color:var(--chip-color);background:color-mix(in srgb,var(--chip-color) 10%,#fff)}
    .chip-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .oil-table{width:100%;border-collapse:collapse;font-size:13px}
    .oil-table th{text-align:left;padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:#9ca3af;border-bottom:2px solid #e5e7eb}
    .oil-table td{padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151}
    .td-country{display:flex;align-items:center;gap:8px;font-weight:500}
    .td-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .td-mono{font-family:'Space Mono',monospace;font-size:12px}
    .change-up{color:#16a34a;font-weight:600}
    .change-down{color:#ef4444;font-weight:600}
    .mape-badge{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
    .mape-good{background:#dcfce7;color:#15803d}
    .mape-ok{background:#fef9c3;color:#a16207}
    .oil-tooltip{position:absolute;background:rgba(26,26,26,.9);color:#fff;border-radius:8px;padding:10px;font-size:12px;pointer-events:none;z-index:100;}
  `;
  document.head.appendChild(style);

  // 2. Build UI Containers
  const statGrid = document.createElement("div");
  statGrid.className = "oil-stat-grid";
  mainContainer.insertBefore(statGrid, document.querySelector("section[aria-label='Oil trade visualization']"));

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

  // ── Functions ─────────────────────────────────────────────────────────────

  function parseCSV(rawData) {
    const countries = [...new Set(rawData.map(d => d.country))];
    return countries.map((country, i) => {
      const rows = rawData.filter(d => d.country === country);
      const first = rows[0];
      return {
        country,
        color: COLORS[i % COLORS.length],
        mape: first.mape ? +first.mape : null,
        order: first.order || null,
        history: rows.filter(d => d.type === "history").map(d => ({ year: +d.year, value: +d.value })),
        forecast: rows.filter(d => d.type === "forecast").map(d => ({ year: +d.year, value: +d.value })),
        conf_int: rows.filter(d => d.type === "forecast").map(d => ({ year: +d.year, lower: +d.lower, upper: +d.upper })),
      };
    });
  }

  function buildSVG() {
    chartDiv.innerHTML = "";
    svg = d3.select(chartDiv).append("svg").attr("width", TOTAL_W).attr("height", TOTAL_H);
    gMain = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    
    tooltip = d3.select(chartDiv).append("div").attr("class", "oil-tooltip").style("display", "none");

    svg.append("rect").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)
       .attr("width", W).attr("height", H).attr("fill", "none").attr("pointer-events", "all")
       .on("mousemove", onMouseMove).on("mouseleave", () => {
         gMain.select(".crosshair").style("display", "none");
         tooltip.style("display", "none");
       });
  }

  function renderChart(selected) {
    buildSVG();
    const filtered = selected.map(d => ({
      ...d, history: d.history.filter(p => p.year >= startYear)
    }));

    const allValues = filtered.flatMap(d => [...d.history, ...d.forecast].map(p => p.value));
    const allHighs = filtered.flatMap(d => d.conf_int.map(p => p.upper));
    const allLows = filtered.flatMap(d => d.conf_int.map(p => p.lower));
    const merged = [...allValues, ...allHighs, ...allLows];

    const yMin = d3.min(merged) < 0 ? d3.min(merged) * 1.1 : 0;
    const yMax = d3.max(merged) * 1.1;

    xScale = d3.scaleLinear().domain([startYear, 2030]).range([0, W]);
    yScale = d3.scaleLinear().domain([yMin, yMax]).range([H, 0]);

    // Grid lines
    gMain.selectAll(".grid").data(yScale.ticks(6)).enter().append("line")
      .attr("x1", 0).attr("x2", W).attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
      .attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3");

    // Zero Line (Important for Net Trade)
    gMain.append("line").attr("x1", 0).attr("x2", W).attr("y1", yScale(0)).attr("y2", yScale(0)).attr("stroke", "#374151").attr("stroke-width", 1);

    const line = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value));

    filtered.forEach(d => {
      // CI Band
      const area = d3.area().x(p => xScale(p.year)).y0(p => yScale(p.lower)).y1(p => yScale(p.upper));
      gMain.append("path").datum(d.conf_int).attr("d", area).attr("fill", d.color).attr("opacity", 0.1);
      // History
      gMain.append("path").datum(d.history).attr("d", line).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      // Forecast
      const conn = [d.history.at(-1), ...d.forecast].filter(Boolean);
      gMain.append("path").datum(conn).attr("d", line).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4");
    });

    gMain.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
    gMain.append("g").call(d3.axisLeft(yScale));
    
    gMain.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", H).attr("stroke", "#9ca3af").attr("stroke-dasharray", "4,4").style("display", "none");
    svg._filtered = filtered;
  }

  function onMouseMove(event) {
    const fs = svg._filtered; if (!fs || !fs.length) return;
    const [mx] = d3.pointer(event);
    const year = Math.round(xScale.invert(mx));
    if (year < startYear || year > 2030) return;

    gMain.select(".crosshair").style("display", null).attr("x1", xScale(year)).attr("x2", xScale(year));
    
    const points = fs.map(d => {
      const p = [...d.history, ...d.forecast].find(x => x.year === year);
      return p ? { country: d.country, color: d.color, value: p.value } : null;
    }).filter(Boolean);

    tooltip.style("display", "block").style("left", `${mx + 80}px`).style("top", "20px")
      .html(`<strong>${year}</strong>${points.map(p => `<br><span style="color:${p.color}">●</span> ${p.country}: ${Math.round(p.value).toLocaleString()}`).join('')}`);
  }

  function renderTable() {
    const rows = allData.map(d => {
      const actual = d.history.at(-1)?.value || 0;
      const fc = d.forecast.at(-1)?.value || 0;
      const pct = actual ? ((fc - actual) / Math.abs(actual)) * 100 : 0;
      return `<tr><td class="td-country"><span class="td-dot" style="background:${d.color}"></span>${d.country}</td>
              <td class="td-mono">${Math.round(actual).toLocaleString()}</td>
              <td class="td-mono">${Math.round(fc).toLocaleString()}</td>
              <td class="${pct >= 0 ? 'change-up' : 'change-down'}">${pct.toFixed(1)}%</td></tr>`;
    }).join("");
    document.getElementById("summaryTable").innerHTML = `<table class="oil-table"><thead><tr><th>Country</th><th>2023</th><th>2030</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function updateStats(selected) {
    const total = selected.reduce((s, d) => s + (d.history.at(-1)?.value || 0), 0);
    statGrid.innerHTML = `
      <div class="oil-stat-card"><p class="oil-stat-label">Current View Total</p><p class="oil-stat-value">${Math.round(total).toLocaleString()}</p><p class="oil-stat-sub">KBD (2023)</p></div>
      <div class="oil-stat-card"><p class="oil-stat-label">Countries</p><p class="oil-stat-value">${active.length}</p><p class="oil-stat-sub">Selected</p></div>
    `;
    metaTitle.textContent = view === "net" ? "Net Oil Trade (KBD)" : "Oil Imports (KBD)";
    metaSub.textContent = `Historical + Forecast · From ${startYear}`;
  }

  function buildChips() {
    const chipRow = document.getElementById("chipRow");
    chipRow.innerHTML = "";
    allData.forEach(d => {
      const btn = document.createElement("button");
      btn.className = `country-chip ${active.includes(d.country) ? "active" : ""}`;
      btn.style.setProperty("--chip-color", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.onclick = () => {
        active = active.includes(d.country) ? active.filter(c => c !== d.country) : [...active, d.country];
        if (active.length === 0) active = [allData[0].country];
        buildChips(); render();
      };
      chipRow.appendChild(btn);
    });
    document.getElementById("chipAll").onclick = () => { active = allData.map(d => d.country); buildChips(); render(); };
    document.getElementById("chipClear").onclick = () => { active = [allData[0].country]; buildChips(); render(); };
  }

  function render() {
    const selected = allData.filter(d => active.includes(d.country));
    updateStats(selected);
    renderChart(selected);
    renderTable();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  Promise.all([
    d3.csv("../data/oil_forecast.csv"),
    d3.csv("../data/net_trade.csv")
  ]).then(([forecastRaw, netRaw]) => {
    forecastRawGlobal = forecastRaw;
    netRawGlobal      = netRaw;

    // View listener
    d3.select("#viewSelect").on("change", function() {
      view = this.value;
      allData = parseCSV(view === "net" ? netRawGlobal : forecastRawGlobal);
      active = allData.map(d => d.country);
      dataHint.textContent = ""; 
      buildChips(); render();
    });

    // Year listener
    d3.select("#yearSelect").on("change", function() {
      startYear = +this.value;
      render();
    });

    // Initial Load
    view = viewSelect.value;
    allData = parseCSV(view === "net" ? netRawGlobal : forecastRawGlobal);
    active = allData.map(d => d.country);
    buildChips();
    render();
  });

})();
