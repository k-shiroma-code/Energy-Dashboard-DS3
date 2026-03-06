(function () {
  "use strict";

  // ── 1. Configuration & Global State ───────────────────────────────────────
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

  // ── 2. DOM Elements ───────────────────────────────────────────────────────
  const chartDiv   = document.getElementById("chart");
  const yearSelect = document.getElementById("yearSelect");
  const viewSelect = document.getElementById("viewSelect");
  const metaTitle  = document.getElementById("metaTitle");
  const metaSub    = document.getElementById("metaSub");
  const dataHint   = document.getElementById("dataHint");
  const mainContainer = document.querySelector("main.container");

  // ── 3. Inject Component Styles ────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    .oil-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
    .oil-stat-card{background:#f9fafb;border-radius:10px;padding:18px 20px;border:1px solid #e5e7eb}
    .oil-stat-label{font-size:11px;font-weight:600;text-transform:uppercase;color:#9ca3af;margin:0 0 6px}
    .oil-stat-value{font-size:1.8rem;font-weight:700;color:#111827;margin:0 0 2px;font-family:'Space Mono',monospace}
    .oil-stat-sub{font-size:12px;color:#6b7280;margin:0}
    .chip-ctrl-btn{padding:4px 12px;border-radius:20px;border:1px solid #d1d5db;background:#fff;font-size:12px;cursor:pointer;margin-right:4px}
    .country-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;font-size:12px;cursor:pointer;margin-bottom:8px;margin-right:8px;transition:all .15s}
    .country-chip.active{border-color:var(--chip-color);background:color-mix(in srgb,var(--chip-color) 10%,#fff);color:#111827}
    .chip-dot{width:8px;height:8px;border-radius:50%}
    .oil-table{width:100%;border-collapse:collapse;font-size:13px}
    .oil-table th{text-align:left;padding:12px;color:#9ca3af;border-bottom:2px solid #e5e7eb}
    .oil-table td{padding:12px;border-bottom:1px solid #f3f4f6}
    .change-up{color:#16a34a;font-weight:600}
    .change-down{color:#ef4444;font-weight:600}
    .oil-tooltip{position:absolute;background:rgba(0,0,0,0.85);color:#fff;padding:10px;border-radius:6px;font-size:12px;pointer-events:none;z-index:1000;font-family:sans-serif}
  `;
  document.head.appendChild(style);

  // ── 4. Setup Containers ──────────────────────────────────────────────────
  const statGrid = document.createElement("div");
  statGrid.className = "oil-stat-grid";
  mainContainer.insertBefore(statGrid, document.querySelector("section[aria-label='Oil trade visualization']"));

  const chipsSection = document.createElement("div");
  chipsSection.className = "card";
  chipsSection.style.padding = "20px";
  chipsSection.innerHTML = `
    <div style="margin-bottom:12px">
      <button id="chipAll" class="chip-ctrl-btn">Select All</button>
      <button id="chipClear" class="chip-ctrl-btn">Clear All</button>
    </div>
    <div id="chipRow"></div>
  `;
  mainContainer.appendChild(chipsSection);

  const tableSection = document.createElement("div");
  tableSection.className = "card";
  tableSection.style.padding = "20px";
  tableSection.innerHTML = `<div id="summaryTable"></div>`;
  mainContainer.appendChild(tableSection);

  let svg, gMain, xScale, yScale, tooltip;

  // ── 5. Logic Functions ────────────────────────────────────────────────────

  function parseCSV(rawData) {
    const countries = [...new Set(rawData.map(d => d.country))];
    return countries.map((country, i) => {
      const rows = rawData.filter(d => d.country === country);
      return {
        country,
        color: COLORS[i % COLORS.length],
        history: rows.filter(d => d.type === "history").map(d => ({ year: +d.year, value: +d.value })),
        forecast: rows.filter(d => d.type === "forecast").map(d => ({ year: +d.year, value: +d.value })),
        conf_int: rows.filter(d => d.type === "forecast").map(d => ({ year: +d.year, lower: +d.lower, upper: +d.upper })),
      };
    });
  }

  function renderChart(selected) {
    chartDiv.innerHTML = "";
    if (!selected.length) return;

    svg = d3.select(chartDiv).append("svg").attr("width", TOTAL_W).attr("height", TOTAL_H);
    gMain = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    tooltip = d3.select("body").append("div").attr("class", "oil-tooltip").style("display", "none");

    const allPts = selected.flatMap(d => [
      ...d.history.filter(p => p.year >= startYear), 
      ...d.forecast,
      ...d.conf_int.map(p => ({value: p.upper})),
      ...d.conf_int.map(p => ({value: p.lower}))
    ]);

    const yMin = d3.min(allPts, d => d.value) < 0 ? d3.min(allPts, d => d.value) * 1.1 : 0;
    const yMax = d3.max(allPts, d => d.value) * 1.1;

    xScale = d3.scaleLinear().domain([startYear, 2030]).range([0, W]);
    yScale = d3.scaleLinear().domain([yMin, yMax]).range([H, 0]);

    // Axes & Zero Line
    gMain.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
    gMain.append("g").call(d3.axisLeft(yScale));
    gMain.append("line").attr("x1", 0).attr("x2", W).attr("y1", yScale(0)).attr("y2", yScale(0)).attr("stroke", "#333").attr("stroke-width", 1);

    const line = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value));

    selected.forEach(d => {
      const histData = d.history.filter(p => p.year >= startYear);
      // CI Area
      const area = d3.area().x(p => xScale(p.year)).y0(p => yScale(p.lower)).y1(p => yScale(p.upper));
      gMain.append("path").datum(d.conf_int).attr("d", area).attr("fill", d.color).attr("opacity", 0.1);
      // Lines
      gMain.append("path").datum(histData).attr("d", line).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      const conn = [histData.at(-1), ...d.forecast].filter(Boolean);
      gMain.append("path").datum(conn).attr("d", line).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4");
    });
  }

  function renderTable() {
    const rows = allData.map(d => {
      const v23 = d.history.at(-1)?.value || 0;
      const v30 = d.forecast.at(-1)?.value || 0;
      const chg = v23 ? ((v30 - v23) / Math.abs(v23)) * 100 : 0;
      return `<tr><td><span style="color:${d.color}">●</span> ${d.country}</td>
              <td>${Math.round(v23).toLocaleString()}</td>
              <td>${Math.round(v30).toLocaleString()}</td>
              <td class="${chg >= 0 ? 'change-up' : 'change-down'}">${chg.toFixed(1)}%</td></tr>`;
    }).join("");
    document.getElementById("summaryTable").innerHTML = `<table class="oil-table"><thead><tr><th>Country</th><th>2023</th><th>2030 (Fc)</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function updateStats(selected) {
    const sum23 = selected.reduce((acc, d) => acc + (d.history.at(-1)?.value || 0), 0);
    statGrid.innerHTML = `
      <div class="oil-stat-card"><p class="oil-stat-label">Combined Flow (2023)</p><p class="oil-stat-value">${Math.round(sum23).toLocaleString()}</p><p class="oil-stat-sub">KBD</p></div>
      <div class="oil-stat-card"><p class="oil-stat-label">Selection</p><p class="oil-stat-value">${active.length}</p><p class="oil-stat-sub">Countries Active</p></div>
    `;
    if (metaTitle) metaTitle.textContent = view === "net" ? "Net Oil Trade (KBD)" : "Oil Imports (KBD)";
  }

  function buildChips() {
    const row = document.getElementById("chipRow");
    row.innerHTML = "";
    allData.forEach(d => {
      const btn = document.createElement("button");
      btn.className = `country-chip ${active.includes(d.country) ? "active" : ""}`;
      btn.style.setProperty("--chip-color", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.onclick = () => {
        active = active.includes(d.country) ? active.filter(c => c !== d.country) : [...active, d.country];
        if (!active.length) active = [allData[0].country];
        buildChips(); render();
      };
      row.appendChild(btn);
    });
  }

  function render() {
    const selected = allData.filter(d => active.includes(d.country));
    updateStats(selected);
    renderChart(selected);
    renderTable();
  }

  // ── 6. Bootstrap ──────────────────────────────────────────────────────────
  Promise.all([
    d3.csv("../data/oil_forecast.csv"),
    d3.csv("../data/net_trade.csv")
  ]).then(([fRaw, nRaw]) => {
    forecastRawGlobal = fRaw;
    netRawGlobal = nRaw;

    viewSelect.onchange = (e) => {
      view = e.target.value;
      allData = parseCSV(view === "net" ? netRawGlobal : forecastRawGlobal);
      active = allData.map(d => d.country);
      if(dataHint) dataHint.textContent = "";
      buildChips(); render();
    };

    yearSelect.onchange = (e) => {
      startYear = +e.target.value;
      render();
    };

    // Init
    allData = parseCSV(viewSelect.value === "net" ? netRawGlobal : forecastRawGlobal);
    active = allData.map(d => d.country);
    buildChips();
    render();
  }).catch(err => {
    console.error(err);
    chartDiv.innerHTML = `<p style="color:red; text-align:center">Data Load Error. Check /data/ folder.</p>`;
  });

})();
