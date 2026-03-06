/**
 * oil-info.js 
 * Handles Imports, Exports, and Net Trade with custom parsing for different CSV schemas.
 */
(function () {
  "use strict";

  // ── Configuration ────────────────────────────────────────────────────────
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];
  const MARGIN = { top: 40, right: 30, bottom: 60, left: 65 };
  const TOTAL_H = 500;

  // ── State ────────────────────────────────────────────────────────────────
  let datasets = { exports: [], imports: [], net: [] };
  let allData = [], active = [], startYear = 1971, view = "exports";

  // ── DOM Elements ─────────────────────────────────────────────────────────
  const chartDiv     = document.getElementById("chart");
  const yearSelect   = document.getElementById("yearSelect");
  const viewSelect   = document.getElementById("viewSelect");
  const metaTitle    = document.getElementById("metaTitle");
  const metaSub      = document.getElementById("metaSub");
  const chipRow      = document.getElementById("chipRow");
  const statsGrid    = document.getElementById("statsGrid"); // Matched to HTML
  const summaryTable = document.getElementById("summaryTable");
  const tooltip      = d3.select("#tooltip");

  // ── Data Parsing ─────────────────────────────────────────────────────────
  function parseCSV(rawData, type) {
    // Determine keys based on the CSV schema provided in your previous prompts
    const isNet = type === "net";
    const countryKey = isNet ? "Country" : (rawData[0].hasOwnProperty("Country") ? "Country" : "country");
    const yearKey    = isNet ? "Year" : (rawData[0].hasOwnProperty("Year") ? "Year" : "year");
    const typeKey    = isNet ? "Type" : (rawData[0].hasOwnProperty("Type") ? "Type" : "type");
    const valueKey   = isNet ? "Net_Trade" : (rawData[0].hasOwnProperty("Value") ? "Value" : "value");
    
    // Confidence Interval Keys
    const lowKey     = isNet ? "Net_CI_Low" : "Lower_CI";
    const highKey    = isNet ? "Net_CI_High" : "Upper_CI";

    const countries = [...new Set(rawData.map(d => d[countryKey]))].filter(Boolean);
    
    return countries.map((name, i) => {
      const rows = rawData.filter(d => d[countryKey] === name);
      const isHist = (t) => t?.toLowerCase().startsWith("his");

      return {
        country: name,
        color: COLORS[i % COLORS.length],
        order: rows.find(r => r.ARIMA_Order)?.ARIMA_Order || "—",
        mape: rows.find(r => r.MAPE)?.MAPE ? +rows.find(r => r.MAPE).MAPE : null,
        history: rows.filter(d => isHist(d[typeKey])).map(d => ({
          year: +d[yearKey], value: +d[valueKey]
        })).sort((a,b) => a.year - b.year),
        forecast: rows.filter(d => !isHist(d[typeKey])).map(d => ({
          year: +d[yearKey], value: +d[valueKey], lower: +d[lowKey], upper: +d[highKey]
        })).sort((a,b) => a.year - b.year)
      };
    });
  }

  // ── Visualization ────────────────────────────────────────────────────────
  function renderChart() {
    const containerW = chartDiv.clientWidth || 800;
    const W = containerW - MARGIN.left - MARGIN.right;
    const H = TOTAL_H - MARGIN.top - MARGIN.bottom;

    chartDiv.innerHTML = "";
    const selected = allData.filter(d => active.includes(d.country));
    
    if (!selected.length) {
      chartDiv.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-dim)">Select countries to visualize data.</div>`;
      return;
    }

    const svg = d3.select(chartDiv).append("svg")
      .attr("viewBox", `0 0 ${containerW} ${TOTAL_H}`)
      .style("width", "100%").style("height", "auto")
      .on("mousemove", (e) => onHover(e, selected, xScale, yScale, containerW))
      .on("mouseleave", () => tooltip.style("display", "none"));

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const displayData = selected.map(d => ({
      ...d,
      history: d.history.filter(p => p.year >= startYear)
    }));

    const allPts = displayData.flatMap(d => [...d.history, ...d.forecast]);
    const xScale = d3.scaleLinear().domain([startYear, 2031]).range([0, W]);
    const yScale = d3.scaleLinear()
      .domain([
        d3.min(allPts, p => p.value) < 0 ? d3.min(allPts, p => p.value) * 1.1 : 0, 
        d3.max(allPts, p => p.value) * 1.15
      ]).range([H, 0]).nice();

    // Axes & Grid
    g.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(yScale).ticks(6).tickSize(-W))
     .call(g => g.selectAll(".tick line").attr("stroke", "var(--border)").attr("stroke-dasharray", "2,2"))
     .call(g => g.select(".domain").remove());

    const lineGen = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value));

    displayData.forEach(d => {
      // Confidence Area
      if (d.forecast.length && d.forecast[0].lower !== undefined) {
        const areaGen = d3.area().x(p => xScale(p.year)).y0(p => yScale(p.lower)).y1(p => yScale(p.upper));
        g.append("path").datum(d.forecast).attr("d", areaGen).attr("fill", d.color).attr("opacity", 0.1);
      }

      // Lines
      g.append("path").datum(d.history).attr("d", lineGen).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      const conn = [d.history.at(-1), ...d.forecast].filter(Boolean);
      g.append("path").datum(conn).attr("d", lineGen).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "5,5");
    });
  }

  function onHover(event, data, x, y, containerW) {
    const [mx] = d3.pointer(event);
    const year = Math.round(x.invert(mx - MARGIN.left));
    
    const matches = data.map(d => {
      const pt = [...d.history, ...d.forecast].find(p => p.year === year);
      return pt ? { name: d.country, val: pt.value, color: d.color } : null;
    }).filter(Boolean).sort((a,b) => b.val - a.val);

    if (!matches.length || year < startYear) return tooltip.style("display", "none");

    tooltip.style("display", "block")
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 20) + "px")
      .html(`<div style="font-weight:700;margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:4px">${year}</div>` + 
        matches.map(m => `<div style="display:flex;justify-content:space-between;gap:20px;font-size:0.8rem;margin-top:3px">
          <span><span style="color:${m.color}">●</span> ${m.name}</span>
          <span style="font-family:Space Mono">${Math.round(m.val).toLocaleString()}</span>
        </div>`).join(""));
  }

  function updateStats() {
    const selected = allData.filter(d => active.includes(d.country));
    if (!selected.length) { statsGrid.innerHTML = ""; return; }

    const latestYear = selected[0]?.history.at(-1)?.year || "2023";
    const totalVal = selected.reduce((s, d) => s + (d.history.at(-1)?.value || 0), 0);
    const avgMape = selected.reduce((a, b) => a + (b.mape || 0), 0) / (selected.filter(s => s.mape).length || 1);
    
    statsGrid.innerHTML = `
      <div class="stat-card">
        <p class="stat-label">${view.toUpperCase()} VOLUME (${latestYear})</p>
        <p class="stat-value">${Math.round(totalVal).toLocaleString()}</p>
        <p class="stat-sub">Thousand Barrels / Day</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">AVG MODEL ERROR</p>
        <p class="stat-value">${avgMape.toFixed(1)}%</p>
        <p class="stat-sub">MAPE (Selected Countries)</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">ACTIVE SELECTION</p>
        <p class="stat-value">${active.length}</p>
        <p class="stat-sub">Countries displayed</p>
      </div>
    `;
  }

  function renderTable() {
    const selected = allData.filter(d => active.includes(d.country));
    let html = `<thead><tr><th>Country</th><th>2023 Actual</th><th>2031 FC</th><th>ARIMA</th><th>Trend</th></tr></thead><tbody>`;
    selected.forEach(d => {
      const cur = d.history.at(-1)?.value || 0;
      const fct = d.forecast.at(-1)?.value || 0;
      const diff = cur ? ((fct - cur) / Math.abs(cur) * 100) : 0;
      const colorClass = diff > 1 ? "mape-good" : diff < -1 ? "mape-bad" : "";
      
      html += `<tr>
        <td><span style="color:${d.color}">●</span> ${d.country}</td>
        <td class="td-mono">${Math.round(cur).toLocaleString()}</td>
        <td class="td-mono">${Math.round(fct).toLocaleString()}</td>
        <td class="td-mono" style="font-size:0.75rem">${d.order}</td>
        <td class="${colorClass} td-mono">${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}%</td>
      </tr>`;
    });
    summaryTable.innerHTML = html + `</tbody>`;
  }

  function buildChips() {
    chipRow.innerHTML = "";
    allData.forEach(d => {
      const isActive = active.includes(d.country);
      const btn = document.createElement("div");
      btn.className = `country-chip ${isActive ? 'active' : ''}`;
      btn.style.setProperty("--chip-c", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.onclick = () => {
        active = isActive ? active.filter(c => c !== d.country) : [...active, d.country];
        buildChips(); updateStats(); renderChart(); renderTable();
      };
      chipRow.appendChild(btn);
    });
  }

  // ── Initialization ───────────────────────────────────────────────────────
  async function init() {
    try {
      const [exRaw, imRaw, netRaw] = await Promise.all([
        d3.csv("data/export.csv"),
        d3.csv("data/oil-forecast.csv"),
        d3.csv("data/net_trade.csv").catch(() => [])
      ]);

      datasets.exports = parseCSV(exRaw, "exports");
      datasets.imports = parseCSV(imRaw, "imports");
      datasets.net     = netRaw.length ? parseCSV(netRaw, "net") : [];

      // Set initial view
      const updateView = () => {
        view = viewSelect.value;
        allData = datasets[view] || [];
        if (metaTitle) metaTitle.textContent = `Crude Oil ${view.charAt(0).toUpperCase() + view.slice(1)} (KBD)`;
        if (metaSub) metaSub.textContent = `Historical + Log-ARIMA Forecasts · Target 2031`;
        active = allData.slice(0, 5).map(d => d.country);
        buildChips(); updateStats(); renderChart(); renderTable();
      };

      viewSelect.onchange = updateView;
      
      // Populate Year Select
      [1971, 1980, 1990, 2000, 2010, 2020].forEach(y => {
        const opt = document.createElement("option");
        opt.value = y; opt.textContent = `From ${y}`;
        if (y === startYear) opt.selected = true;
        yearSelect.appendChild(opt);
      });
      yearSelect.onchange = (e) => { startYear = +e.target.value; renderChart(); };

      document.getElementById("chipAll").onclick = () => { active = allData.map(d => d.country); buildChips(); renderChart(); updateStats(); renderTable(); };
      document.getElementById("chipClear").onclick = () => { active = []; buildChips(); renderChart(); updateStats(); renderTable(); };

      updateView();
      window.addEventListener("resize", renderChart);

    } catch (err) {
      console.error(err);
      chartDiv.innerHTML = `<div style="color:var(--red); padding:40px">Error loading datasets. Please ensure CSVs are in the /data folder.</div>`;
    }
  }

  init();

})();
