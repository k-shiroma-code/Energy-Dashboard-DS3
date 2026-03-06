(function () {
  "use strict";

  // 1. Config & Global State
  const COLORS = ["#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1"];
  const MARGIN = { top: 24, right: 32, bottom: 52, left: 72 };
  const TOTAL_W = 860;
  const TOTAL_H = 400;
  const W = TOTAL_W - MARGIN.left - MARGIN.right;
  const H = TOTAL_H - MARGIN.top - MARGIN.bottom;

  let rawCSVData = []; 
  let allData = [];    
  let active = [];     
  let startYear = 2000;
  let view = "Net_Trade"; // Default view

  // DOM Elements
  const chartDiv = document.getElementById("chart");
  const viewSelect = document.getElementById("viewSelect");
  const yearSelect = document.getElementById("yearSelect");
  const chipRow = document.getElementById("chipRow");
  const metaTitle = document.getElementById("metaTitle");

  // 2. Data Parsing Logic
  // This maps your CSV headers: Country, Year, Type, Net_Trade, Exports, Imports...
  function parseData(rawData, selectedView) {
    const countries = [...new Set(rawData.map(d => d.Country))];
    
    return countries.map((country, i) => {
      const rows = rawData.filter(d => d.Country === country);
      
      // Dynamic column selection based on "view"
      const valCol = selectedView; 
      const lowCol = selectedView === "Net_Trade" ? "Net_CI_Low" : selectedView;
      const highCol = selectedView === "Net_Trade" ? "Net_CI_High" : selectedView;

      return {
        country,
        color: COLORS[i % COLORS.length],
        history: rows.filter(d => d.Type === "Historical").map(d => ({ 
          year: +d.Year, 
          value: +d[valCol] 
        })),
        forecast: rows.filter(d => d.Type === "Forecast").map(d => ({ 
          year: +d.Year, 
          value: +d[valCol] 
        })),
        conf_int: rows.filter(d => d.Type === "Forecast").map(d => ({ 
          year: +d.Year, 
          lower: +d[lowCol], 
          upper: +d[highCol] 
        })),
        // Grab metadata from the first row of the country group
        order: selectedView === "Exports" ? rows[0].Exports_Order : rows[0].Imports_Order,
        mape: rows[0].Avg_MAPE
      };
    });
  }

  // 3. Rendering Logic
  function render() {
    chartDiv.innerHTML = "";
    
    // Filter the parsed data to only show active chips
    const selected = allData.filter(d => active.includes(d.country));
    if (!selected.length) return;

    const svg = d3.select(chartDiv).append("svg").attr("width", TOTAL_W).attr("height", TOTAL_H);
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Calculate Y scale domain
    const allPts = selected.flatMap(d => [
      ...d.history.filter(p => p.year >= startYear), 
      ...d.forecast,
      ...d.conf_int.flatMap(p => [p.lower, p.upper])
    ]);

    const yMin = view === "Net_Trade" ? d3.min(allPts, d => d.value || d) * 1.1 : 0;
    const yMax = d3.max(allPts, d => d.value || d) * 1.1;

    const x = d3.scaleLinear().domain([startYear, 2030]).range([0, W]);
    const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([H, 0]);

    // Draw Axes
    g.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(y));

    // Draw Zero Line (Critical for Net Trade)
    if (view === "Net_Trade") {
      g.append("line").attr("x1", 0).attr("x2", W).attr("y1", y(0)).attr("y2", y(0))
       .attr("stroke", "#ffffff").attr("stroke-width", 1).attr("stroke-dasharray", "4,4").attr("opacity", 0.5);
    }

    const line = d3.line().x(p => x(p.year)).y(p => y(p.value));

    selected.forEach(d => {
      const hist = d.history.filter(p => p.year >= startYear);
      
      // CI Area (Only for Net Trade)
      if (view === "Net_Trade" && d.conf_int.length > 0) {
        const area = d3.area().x(p => x(p.year)).y0(p => y(p.lower)).y1(p => y(p.upper));
        g.append("path").datum(d.conf_int).attr("d", area).attr("fill", d.color).attr("opacity", 0.1);
      }

      // History Path
      g.append("path").datum(hist).attr("d", line).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      
      // Forecast Path (Dashed)
      const conn = [hist.at(-1), ...d.forecast].filter(Boolean);
      g.append("path").datum(conn).attr("d", line).attr("fill", "none").attr("stroke", d.color)
       .attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4");
    });

    if (metaTitle) metaTitle.textContent = view.replace("_", " ") + " (KBD)";
    renderTable(selected);
  }

  function renderTable(selected) {
    const tableDiv = document.getElementById("summaryTable");
    if (!tableDiv) return;

    const rows = selected.map(d => {
      const v23 = d.history.at(-1)?.value || 0;
      const v30 = d.forecast.at(-1)?.value || 0;
      const chg = v23 !== 0 ? ((v30 - v23) / Math.abs(v23)) * 100 : 0;
      return `<tr>
        <td><span style="color:${d.color}">●</span> ${d.country}</td>
        <td>${Math.round(v23).toLocaleString()}</td>
        <td>${Math.round(v30).toLocaleString()}</td>
        <td class="${chg >= 0 ? 'change-up' : 'change-down'}">${chg.toFixed(1)}%</td>
        <td style="font-family:monospace; font-size:11px">${d.order || 'N/A'}</td>
      </tr>`;
    }).join("");

    tableDiv.innerHTML = `
      <table class="oil-table">
        <thead><tr><th>Country</th><th>2023</th><th>2030 (Fc)</th><th>Change</th><th>ARIMA Order</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function buildChips() {
    chipRow.innerHTML = "";
    allData.forEach(d => {
      const btn = document.createElement("button");
      btn.className = `country-chip ${active.includes(d.country) ? "active" : ""}`;
      btn.style.setProperty("--chip-color", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.onclick = () => {
        active = active.includes(d.country) ? active.filter(c => c !== d.country) : [...active, d.country];
        buildChips(); render();
      };
      chipRow.appendChild(btn);
    });
  }

  // 4. Bootstrap
  d3.csv("../data/net_trade.csv").then(data => {
    rawCSVData = data;
    
    // Initialize
    view = viewSelect.value;
    allData = parseData(rawCSVData, view);
    active = [allData[0].country]; 

    // Event: Switch View (Net Trade / Exports / Imports)
    viewSelect.onchange = (e) => {
      view = e.target.value;
      allData = parseData(rawCSVData, view); // Re-parse data for the new column
      render();
    };

    // Event: Switch Start Year
    yearSelect.onchange = (e) => {
      startYear = +e.target.value;
      render();
    };

    // Select/Clear All logic
    document.getElementById("chipAll").onclick = () => { active = allData.map(d => d.country); buildChips(); render(); };
    document.getElementById("chipClear").onclick = () => { active = []; buildChips(); render(); };

    buildChips();
    render();
  }).catch(e => console.error("CSV Load Error:", e));

})();
