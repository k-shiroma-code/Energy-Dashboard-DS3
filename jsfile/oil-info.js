/**
 * oil-info.js 
 * Handles Imports, Exports, and Net Trade with custom parsing for different CSV schemas.
 */
(function () {
  "use strict";

  // ── Configuration ────────────────────────────────────────────────────────
  const COLORS = ["#2dd4bf", "#5b8dee", "#f5a623", "#a78bfa", "#ff6b6b", "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1"];
  const MARGIN = { top: 30, right: 40, bottom: 50, left: 70 };
  const TOTAL_W = 860;
  const TOTAL_H = 420;
  const W = TOTAL_W - MARGIN.left - MARGIN.right;
  const H = TOTAL_H - MARGIN.top - MARGIN.bottom;

  // ── State ────────────────────────────────────────────────────────────────
  let forecastData = [], netTradeData = [], exportData = [];
  let allData = [], active = [], startYear = 2000, view = "imports";

  // ── DOM Elements ─────────────────────────────────────────────────────────
  const chartDiv   = document.getElementById("chart");
  const yearSelect = document.getElementById("yearSelect");
  const viewSelect = document.getElementById("viewSelect");
  const metaTitle  = document.getElementById("metaTitle");
  const chipRow    = document.getElementById("chipRow");
  const statGrid   = document.getElementById("statGrid");
  const summaryTable = document.getElementById("summaryTable");

  // Populate Year Select
  if (yearSelect) {
    [1971, 1980, 1990, 2000, 2010, 2020].forEach(y => {
      const opt = document.createElement("option");
      opt.value = y; opt.textContent = y;
      if (y === 2000) opt.selected = true;
      yearSelect.appendChild(opt);
    });
  }

  // ── Data Parsing ─────────────────────────────────────────────────────────
  function parseCSV(rawData, type) {
    const isNet = type === "net";
    const countryKey = isNet ? "Country" : "country";
    const yearKey    = isNet ? "Year" : "year";
    const valueKey   = isNet ? "Net_Trade" : "value";
    const lowKey     = isNet ? "Net_CI_Low" : "lower";
    const highKey    = isNet ? "Net_CI_High" : "upper";
    const typeKey    = isNet ? "Type" : "type";

    const countries = [...new Set(rawData.map(d => d[countryKey]))].filter(Boolean);
    
    return countries.map((name, i) => {
      const rows = rawData.filter(d => d[countryKey] === name);
      return {
        country: name,
        color: COLORS[i % COLORS.length],
        history: rows.filter(d => d[typeKey]?.toLowerCase().startsWith("his")).map(d => ({
          year: +d[yearKey], value: +d[valueKey]
        })).sort((a,b) => a.year - b.year),
        forecast: rows.filter(d => d[typeKey]?.toLowerCase().startsWith("for")).map(d => ({
          year: +d[yearKey], value: +d[valueKey], lower: +d[lowKey], upper: +d[highKey]
        })).sort((a,b) => a.year - b.year),
        fullRow: rows[0] // Store for metadata like MAPE
      };
    });
  }

  // ── Visualization ────────────────────────────────────────────────────────
  function renderChart() {
    chartDiv.innerHTML = "";
    const selected = allData.filter(d => active.includes(d.country));
    
    if (!selected.length) {
      chartDiv.innerHTML = `<div class="empty-notice">Select countries below to visualize ${view} data.</div>`;
      return;
    }

    const svg = d3.select(chartDiv).append("svg")
      .attr("viewBox", `0 0 ${TOTAL_W} ${TOTAL_H}`)
      .style("width", "100%").style("height", "auto");

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const displayData = selected.map(d => ({
      ...d,
      history: d.history.filter(p => p.year >= startYear)
    }));

    const allPts = displayData.flatMap(d => [...d.history, ...d.forecast]);
    const xExtent = d3.extent(allPts, d => d.year);
    const yMin = d3.min(allPts, d => d.value);
    const yMax = d3.max(allPts, d => d.value);

    const xScale = d3.scaleLinear().domain(xExtent).range([0, W]);
    const yScale = d3.scaleLinear()
      .domain([yMin * 1.1, yMax * 1.1])
      .range([H, 0]).nice();

    // Gridlines
    g.append("g").attr("class", "grid").attr("opacity", 0.1)
      .call(d3.axisLeft(yScale).tickSize(-W).tickFormat(""));

    // Axes
    g.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(yScale).tickFormat(d3.format(".2s")));

    // Zero line for Net Trade
    if (yMin < 0) {
      g.append("line").attr("x1", 0).attr("x2", W).attr("y1", yScale(0)).attr("y2", yScale(0))
        .attr("stroke", "var(--text-dim)").attr("stroke-width", 1).attr("stroke-dasharray", "4,4");
    }

    const lineGen = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value));

    displayData.forEach(d => {
      // Confidence Interval Area
      const areaGen = d3.area().x(p => xScale(p.year)).y0(p => yScale(p.lower)).y1(p => yScale(p.upper));
      g.append("path").datum(d.forecast).attr("d", areaGen).attr("fill", d.color).attr("opacity", 0.12);

      // History Line
      g.append("path").datum(d.history).attr("d", lineGen).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      
      // Forecast Line (Dashed)
      const conn = [d.history.at(-1), ...d.forecast].filter(Boolean);
      g.append("path").datum(conn).attr("d", lineGen).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4");
    });
  }

  function updateStats() {
    const selected = allData.filter(d => active.includes(d.country));
    const latestYear = selected[0]?.history.at(-1)?.year || "2023";
    const totalVal = selected.reduce((s, d) => s + (d.history.at(-1)?.value || 0), 0);
    
    statGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">${view.toUpperCase()} VOLUME (${latestYear})</div>
        <div class="stat-value">${Math.round(totalVal).toLocaleString()}</div>
        <div class="stat-sub">Thousand Barrels / Day</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ACTIVE SELECTION</div>
        <div class="stat-value">${active.length}</div>
        <div class="stat-sub">Countries displayed</div>
      </div>
    `;
  }

  function renderTable() {
    let html = `<table class="oil-table"><thead><tr><th>Country</th><th>Current</th><th>2030 Forecast</th><th>Trend</th></tr></thead><tbody>`;
    allData.forEach(d => {
      const cur = d.history.at(-1)?.value || 0;
      const fct = d.forecast.at(-1)?.value || 0;
      const diff = ((fct - cur) / Math.abs(cur) * 100) || 0;
      const colorClass = diff > 1 ? "change-up" : diff < -1 ? "change-down" : "change-flat";
      
      html += `<tr>
        <td class="td-country"><span class="td-dot" style="background:${d.color}"></span>${d.country}</td>
        <td class="td-mono">${Math.round(cur).toLocaleString()}</td>
        <td class="td-mono">${Math.round(fct).toLocaleString()}</td>
        <td class="${colorClass}">${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}%</td>
      </tr>`;
    });
    summaryTable.innerHTML = html + `</tbody></table>`;
  }

  function buildChips() {
    chipRow.innerHTML = "";
    allData.forEach(d => {
      const isActive = active.includes(d.country);
      const btn = document.createElement("button");
      btn.className = `country-chip ${isActive ? 'active' : ''}`;
      btn.style.setProperty("--chip-c", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.onclick = () => {
        active = isActive ? active.filter(c => c !== d.country) : [...active, d.country];
        buildChips(); updateStats(); renderChart();
      };
      chipRow.appendChild(btn);
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  Promise.all([
    d3.csv("../data/oil_forecast.csv"),
    d3.csv("../data/net_trade.csv")
    // Note: add export csv here if separate
  ]).then(([impRaw, netRaw]) => {
    forecastData = parseCSV(impRaw, "imports");
    netTradeData = parseCSV(netRaw, "net");

    const updateView = () => {
      view = viewSelect.value;
      allData = (view === "net") ? netTradeData : forecastData;
      if (metaTitle) metaTitle.textContent = `Oil ${view.charAt(0).toUpperCase() + view.slice(1)} (KBD)`;
      active = allData.slice(0, 4).map(d => d.country);
      buildChips(); updateStats(); renderChart(); renderTable();
    };

    viewSelect.onchange = updateView;
    yearSelect.onchange = (e) => { startYear = +e.target.value; renderChart(); };
    document.getElementById("chipAll").onclick = () => { active = allData.map(d => d.country); buildChips(); renderChart(); updateStats(); };
    document.getElementById("chipClear").onclick = () => { active = []; buildChips(); renderChart(); updateStats(); };

    // Initial Run
    updateView();

  }).catch(err => {
    console.error(err);
    chartDiv.innerHTML = `<div class="empty-notice" style="color:var(--red)">Error loading datasets. Check file paths.</div>`;
  });

  // Modal Logic
  const modal = document.getElementById("infoModal");
  document.getElementById("infoBtn").onclick = () => modal.classList.add("open");
  document.getElementById("modalClose").onclick = () => modal.classList.remove("open");

})();

