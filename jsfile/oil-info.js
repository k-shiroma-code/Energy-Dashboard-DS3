// oil-info.js – vanilla D3 v7
(function () {
  "use strict";

  // ── Configuration & State ────────────────────────────────────────────────
  const COLORS = ["#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1"];
  const MARGIN = { top: 30, right: 30, bottom: 50, left: 70 };
  const TOTAL_W = 860;
  const TOTAL_H = 400;
  const W = TOTAL_W - MARGIN.left - MARGIN.right;
  const H = TOTAL_H - MARGIN.top - MARGIN.bottom;

  let forecastData = []; 
  let netTradeData = []; 
  let allData      = []; 
  let active       = []; 
  let startYear    = 2000;
  let view         = "imports";

  // DOM Elements
  const chartDiv   = document.getElementById("chart");
  const yearSelect = document.getElementById("yearSelect");
  const viewSelect = document.getElementById("viewSelect");
  const metaTitle  = document.getElementById("metaTitle");
  const chipRow    = document.getElementById("chipRow");

  // ── Data Parsing ─────────────────────────────────────────────────────────
  function parseCSV(rawData, isNetTrade = false) {
    // Detect column names based on file type
    const countryKey = isNetTrade ? "Country" : "country";
    const yearKey    = isNetTrade ? "Year" : "year";
    const valueKey   = isNetTrade ? "Net_Trade" : "value";
    const typeKey    = isNetTrade ? "Type" : "type";

    const countries = [...new Set(rawData.map(d => d[countryKey]))].filter(Boolean);
    
    return countries.map((name, i) => {
      const rows = rawData.filter(d => d[countryKey] === name);
      return {
        country: name,
        color: COLORS[i % COLORS.length],
        history: rows
          .filter(d => d[typeKey]?.toLowerCase() === "historical" || d[typeKey]?.toLowerCase() === "history")
          .map(d => ({ year: +d[yearKey], value: +d[valueKey] }))
          .sort((a, b) => a.year - b.year),
        forecast: rows
          .filter(d => d[typeKey]?.toLowerCase() === "forecast")
          .map(d => ({ year: +d[yearKey], value: +d[valueKey] }))
          .sort((a, b) => a.year - b.year)
      };
    });
  }

  // ── Visualization ────────────────────────────────────────────────────────
  function renderChart() {
    chartDiv.innerHTML = "";
    const selected = allData.filter(d => active.includes(d.country));
    if (!selected.length) {
      chartDiv.innerHTML = `<div style="padding:100px; text-align:center; color:#9ca3af;">Select a country to view data</div>`;
      return;
    }

    const svg = d3.select(chartDiv).append("svg")
      .attr("viewBox", `0 0 ${TOTAL_W} ${TOTAL_H}`)
      .style("width", "100%").style("height", "auto");

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Flatten data for scale calculations
    const displayData = selected.map(d => ({
      ...d,
      history: d.history.filter(p => p.year >= startYear)
    }));

    const allPts = displayData.flatMap(d => [...d.history, ...d.forecast]);
    if (!allPts.length) return;

    const xExtent = d3.extent(allPts, d => d.year);
    const yMin = d3.min(allPts, d => d.value);
    const yMax = d3.max(allPts, d => d.value);

    const xScale = d3.scaleLinear().domain(xExtent).range([0, W]);
    const yScale = d3.scaleLinear()
      .domain([yMin < 0 ? yMin * 1.1 : 0, yMax * 1.1])
      .range([H, 0]).nice();

    // Axes
    g.append("g").attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(10));
    g.append("g").call(d3.axisLeft(yScale).tickFormat(d => d3.format(".2s")(d).replace('G', 'B')));

    // Zero Line (for Net Trade)
    if (yMin < 0) {
      g.append("line")
        .attr("x1", 0).attr("x2", W).attr("y1", yScale(0)).attr("y2", yScale(0))
        .attr("stroke", "#000").attr("stroke-width", 1).attr("stroke-dasharray", "2,2");
    }

    const lineGen = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value));

    // Draw Lines
    displayData.forEach(d => {
      // History
      g.append("path").datum(d.history).attr("d", lineGen)
        .attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      
      // Forecast Connection
      const conn = [d.history.at(-1), ...d.forecast].filter(Boolean);
      g.append("path").datum(conn).attr("d", lineGen)
        .attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "5,5");
    });
  }

  function buildChips() {
    if (!chipRow) return;
    chipRow.innerHTML = "";
    allData.forEach(d => {
      const isActive = active.includes(d.country);
      const btn = document.createElement("button");
      btn.className = `country-chip ${isActive ? 'active' : ''}`;
      btn.style.cssText = `
        padding: 5px 12px; border-radius: 20px; border: 1px solid ${isActive ? d.color : '#e5e7eb'};
        background: ${isActive ? d.color + '1a' : '#fff'}; cursor: pointer; font-size: 12px; margin: 4px;
      `;
      btn.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${d.color}; margin-right:6px;"></span>${d.country}`;
      btn.onclick = () => {
        if (active.includes(d.country)) active = active.filter(c => c !== d.country);
        else active.push(d.country);
        buildChips();
        renderChart();
      };
      chipRow.appendChild(btn);
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  Promise.all([
    d3.csv("../data/oil_forecast.csv"),
    d3.csv("../data/net_trade.csv")
  ]).then(([forecastRaw, netRaw]) => {
    forecastData = parseCSV(forecastRaw, false);
    netTradeData = parseCSV(netRaw, true);

    // Initial Load
    view = viewSelect?.value || "imports";
    allData = (view === "net") ? netTradeData : forecastData;
    active = allData.slice(0, 3).map(d => d.country);

    if (metaTitle) metaTitle.textContent = view === "net" ? "Net Oil Trade (KBD)" : "Oil Imports (KBD)";

    // Event Listeners
    viewSelect?.addEventListener("change", (e) => {
      view = e.target.value;
      allData = (view === "net") ? netTradeData : forecastData;
      if (metaTitle) metaTitle.textContent = view === "net" ? "Net Oil Trade (KBD)" : "Oil Imports (KBD)";
      buildChips();
      renderChart();
    });

    yearSelect?.addEventListener("change", (e) => {
      startYear = +e.target.value;
      renderChart();
    });

    document.getElementById("chipAll")?.addEventListener("click", () => {
      active = allData.map(d => d.country);
      buildChips(); renderChart();
    });

    document.getElementById("chipClear")?.addEventListener("click", () => {
      active = [];
      buildChips(); renderChart();
    });

    buildChips();
    renderChart();

  }).catch(err => {
    console.error("Data Load Error:", err);
    chartDiv.innerHTML = `<div style="color:red; padding:20px;">Error loading CSV files. Check console.</div>`;
  });

})();
