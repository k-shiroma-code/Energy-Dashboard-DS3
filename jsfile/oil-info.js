(function () {
  "use strict";

  // 1. Configuration
  const COLORS = ["#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1"];
  const MARGIN = { top: 24, right: 32, bottom: 52, left: 72 };
  const TOTAL_W = 860;
  const TOTAL_H = 400;
  const W = TOTAL_W - MARGIN.left - MARGIN.right;
  const H = TOTAL_H - MARGIN.top - MARGIN.bottom;

  let rawCSVData = []; // Full contents of net_trade.csv
  let allData = [];    // Parsed for current view
  let active = [];     // Selected country names
  let startYear = 2000;
  let view = "Net_Trade";

  // DOM
  const chartDiv = document.getElementById("chart");
  const viewSelect = document.getElementById("viewSelect");
  const yearSelect = document.getElementById("yearSelect");
  const metaTitle = document.getElementById("metaTitle");
  const chipRow = document.getElementById("chipRow");

  // 2. Data Parsing Logic (Handles your specific CSV headers)
  function parseData(rawData, selectedView) {
    const countries = [...new Set(rawData.map(d => d.Country))];
    
    return countries.map((country, i) => {
      const rows = rawData.filter(d => d.Country === country);
      
      // Map view to CSV columns
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
        order: selectedView === "Exports" ? rows[0].Exports_Order : rows[0].Imports_Order,
        mape: rows[0].Avg_MAPE
      };
    });
  }

  // 3. Rendering Engine
  function render() {
    chartDiv.innerHTML = "";
    const selected = allData.filter(d => active.includes(d.country));
    if (!selected.length) return;

    const svg = d3.select(chartDiv).append("svg").attr("width", TOTAL_W).attr("height", TOTAL_H);
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Flatten data for scales
    const allPts = selected.flatMap(d => [
      ...d.history.filter(p => p.year >= startYear), 
      ...d.forecast,
      ...d.conf_int.flatMap(p => [p.lower, p.upper])
    ]);

    const yMin = view === "Net_Trade" ? d3.min(allPts, d => (typeof d === 'number' ? d : d.value)) * 1.1 : 0;
    const yMax = d3.max(allPts, d => (typeof d === 'number' ? d : d.value)) * 1.1;

    const x = d3.scaleLinear().domain([startYear, 2030]).range([0, W]);
    const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([H, 0]);

    // Axes
    g.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(y));

    // Zero Line (Only show for Net Trade)
    if (view === "Net_Trade") {
      g.append("line").attr("x1", 0).attr("x2", W).attr("y1", y(0)).attr("y2", y(0))
       .attr("stroke", "#555").attr("stroke-width", 1.5).attr("stroke-dasharray", "4");
    }

    const line = d3.line().x(p => x(p.year)).y(p => y(p.value));

    selected.forEach(d => {
      const hist = d.history.filter(p => p.year >= startYear);
      
      // CI Area
      if (view === "Net_Trade") {
        const area = d3.area().x(p => x(p.year)).y0(p => y(p.lower)).y1(p => y(p.upper));
        g.append("path").datum(d.conf_int).attr("d", area).attr("fill", d.color).attr("opacity", 0.15);
      }

      // History
      g.append("path").datum(hist).attr("d", line).attr("fill", "none").attr("stroke", d.color).attr("stroke-width", 2.5);
      
      // Forecast connection
      const conn = [hist.at(-1), ...d.forecast].filter(Boolean);
      g.append("path").datum(conn).attr("d", line).attr("fill", "none").attr("stroke", d.color)
       .attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4");
    });

    renderTable(selected);
    updateStats(selected);
  }

  function renderTable(selected) {
    const rows = selected.map(d => {
      const v23 = d.history.at(-1)?.value || 0;
      const v30 = d.forecast.at(-1)?.value || 0;
      const chg = v23 !== 0 ? ((v30 - v23) / Math.abs(v23)) * 100 : 0;
      return `<tr>
        <td><span style="color:${d.color}">●</span> ${d.country}</td>
        <td>${Math.round(v23).toLocaleString()}</td>
        <td>${Math.round(v30).toLocaleString()}</td>
        <td class="${chg >= 0 ? 'change-up' : 'change-down'}">${chg.toFixed(1)}%</td>
        <td style="font-family:monospace">${d.order || 'N/A'}</td>
      </tr>`;
    }).join("");
    document.getElementById("summaryTable").innerHTML = `
      <table class="oil-table">
        <thead><tr><th>Country</th><th>2023</th><th>2030 (Fc)</th><th>Change</th><th>Model Order</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function updateStats(selected) {
    if (metaTitle) metaTitle.textContent = view.replace("_", " ") + " (KBD)";
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

  // 4. Init
  d3.csv("../data/net_trade.csv").then(data => {
    rawCSVData = data;
    allData = parseData(rawCSVData, view);
    active = [allData[0].country]; // Default to first country
    
    // View Switcher logic
    viewSelect.onchange = (e) => {
      view = e.target.value;
      allData = parseData(rawCSVData, view);
      render();
    };

    // Year Switcher logic
    yearSelect.onchange = (e) => { startYear = +e.target.value; render(); };

    // Select/Clear All
    document.getElementById("chipAll").onclick = () => { active = allData.map(d => d.country); buildChips(); render(); };
    document.getElementById("chipClear").onclick = () => { active = []; buildChips(); render(); };

    buildChips();
    render();
  });

})();
