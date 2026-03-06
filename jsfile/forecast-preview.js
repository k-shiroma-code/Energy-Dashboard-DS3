// ─────────────────────────────────────────────────────────────────────────────
// forecast-preview.js
//
// Homepage preview of the EV Forecast page (ev_forecast.html).
// Self-contained IIFE — all DOM queries use "fcast-prev-*" IDs, never
// conflicting with ev_forecast.js (which owns #forecast-chart, #dropdown, etc.)
//
// Renders a compact S-curve multi-line chart for a subset of regions.
// Data: attempts d3.json("./data/ev-data.json"); falls back to built-in sample.
//
// DOM IDs required in index.html (all prefixed "fcast-prev-"):
//   #fcast-prev-chart       — SVG mount point
//   #fcast-prev-hint        — status text (aria-live)
//   #fcast-prev-stat-peak   — peak sales projection value
//   #fcast-prev-stat-region — number of regions shown
//   #fcast-prev-stat-year   — forecast horizon year
//   #fcast-prev-legend      — colour legend rows
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  const chartDiv = document.getElementById("fcast-prev-chart");
  if (!chartDiv) return;

  // ── Colour palette (mirrors ev_forecast.js schemeTableau10 order) ────────────
  const COLORS = [
    "#4e79a7","#f28e2b","#e15759","#76b7b2","#59a14f",
    "#edc948","#b07aa1","#ff9da7","#9c755f","#bab0ac",
  ];

  // ── Sample data: logistic S-curve shape, 2015–2035 ───────────────────────────
  // Mimics ev-data.json structure: { region_country, year, ev_sales, type }
  // "Actual" = 2015–2023, "Forecast" = 2024–2035
  function buildSample() {
    const regions = [
      { name:"China",   L:18000000, k:0.42, t0:2026 },
      { name:"Europe",  L:7500000,  k:0.38, t0:2027 },
      { name:"USA",     L:5500000,  k:0.35, t0:2028 },
      { name:"India",   L:4000000,  k:0.45, t0:2030 },
      { name:"Rest",    L:3000000,  k:0.30, t0:2029 },
    ];
    const rows = [];
    for (let yr = 2015; yr <= 2035; yr++) {
      const type = yr <= 2023 ? "Actual" : "Forecast";
      regions.forEach(r => {
        const val = r.L / (1 + Math.exp(-r.k * (yr - r.t0)));
        rows.push({ region_country: r.name, year: yr, ev_sales: Math.round(val), type });
      });
    }
    return rows;
  }

  // ── Load data (tries real file, falls back to sample) ────────────────────────
  async function loadData() {
    const hint = document.getElementById("fcast-prev-hint");
    try {
      const raw = await d3.json("./data/ev-data.json");
      if (!raw || !raw.length) throw new Error("empty");
      raw.forEach(d => { d.year = +d.year; d.ev_sales = +d.ev_sales; });
      if (hint) hint.textContent = "";
      return raw;
    } catch {
      if (hint) hint.textContent = "Sample data — add data/ev-data.json for real values.";
      return buildSample();
    }
  }

  // ── Tooltip ──────────────────────────────────────────────────────────────────
  const tooltip = (() => {
    const t = document.createElement("div");
    Object.assign(t.style, {
      position:"fixed", pointerEvents:"none", opacity:"0", transition:"opacity .12s",
      background:"rgba(22,27,36,.97)", border:"1px solid #3b5278",
      borderRadius:"8px", padding:".5rem .8rem",
      fontFamily:"'IBM Plex Mono',monospace", fontSize:".7rem", lineHeight:"1.7",
      color:"#e8edf5", zIndex:"9999", boxShadow:"0 6px 24px rgba(0,0,0,.55)",
      whiteSpace:"nowrap",
    });
    document.body.appendChild(t);
    return t;
  })();

  function moveTip(e) {
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, G = 14;
    let tx = e.clientX + G, ty = e.clientY - G - th;
    if (tx + tw > vw - 8) tx = e.clientX - G - tw;
    if (ty < 8)           ty = e.clientY + G;
    tooltip.style.left = Math.max(8, Math.min(tx, vw - tw - 8)) + "px";
    tooltip.style.top  = Math.max(8, Math.min(ty, vh - th - 8)) + "px";
  }
  function hideTip() { tooltip.style.opacity = "0"; }

  // ── Build and render chart ───────────────────────────────────────────────────
  function buildChart(data) {
    chartDiv.innerHTML = "";

    const allRegions = [...new Set(data.map(d => d.region_country))];
    // Take up to 5 regions for readability in preview
    const regions = allRegions.slice(0, 5);

    const colorMap = Object.fromEntries(regions.map((r, i) => [r, COLORS[i % COLORS.length]]));

    const W_TOTAL = chartDiv.clientWidth || 600;
    const H_TOTAL = 260;
    const M = { top: 12, right: 30, bottom: 38, left: 64 };
    const W = W_TOTAL - M.left - M.right;
    const H = H_TOTAL - M.top  - M.bottom;

    const years  = [...new Set(data.map(d => d.year))].sort((a,b) => a - b);
    const maxVal = d3.max(data.filter(d => regions.includes(d.region_country)), d => d.ev_sales);

    const x = d3.scaleLinear().domain([years[0], years[years.length - 1]]).range([0, W]);
    const y = d3.scaleLinear().domain([0, maxVal * 1.05]).nice().range([H, 0]);

    const makeLine = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.ev_sales))
      .curve(d3.curveMonotoneX);

    const svgEl = d3.select(chartDiv)
      .append("svg")
      .attr("width", W_TOTAL).attr("height", H_TOTAL)
      .attr("viewBox", `0 0 ${W_TOTAL} ${H_TOTAL}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block");

    const g = svgEl.append("g").attr("transform", `translate(${M.left},${M.top})`);

    // Grid
    g.append("g").selectAll("line").data(y.ticks(4)).join("line")
      .attr("x1",0).attr("x2",W)
      .attr("y1",d=>y(d)).attr("y2",d=>y(d))
      .attr("stroke","#2a3347").attr("stroke-dasharray","3,4").attr("opacity",.55);

    // 2024 separator
    g.append("line")
      .attr("x1",x(2024)).attr("x2",x(2024))
      .attr("y1",0).attr("y2",H)
      .attr("stroke","#8a9ab8").attr("stroke-dasharray","4,4").attr("opacity",.45);

    g.append("text")
      .attr("x",x(2024)+4).attr("y",8)
      .attr("font-family","'IBM Plex Mono',monospace").attr("font-size",8)
      .attr("fill","#4e5e7a").text("Forecast →");

    // Axes
    g.append("g").attr("transform",`translate(0,${H})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(5).tickSizeOuter(0))
      .call(s => {
        s.selectAll("text").attr("font-family","'IBM Plex Mono',monospace").attr("font-size",9).attr("fill","#8a9ab8");
        s.selectAll(".domain,.tick line").attr("stroke","#2a3347").attr("opacity",.5);
      });

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickFormat(v => d3.format("~s")(v)).tickSizeOuter(0))
      .call(s => {
        s.selectAll("text").attr("font-family","'IBM Plex Mono',monospace").attr("font-size",9).attr("fill","#8a9ab8");
        s.selectAll(".domain,.tick line").attr("stroke","#2a3347").attr("opacity",.5);
      });

    svgEl.append("text")
      .attr("transform","rotate(-90)")
      .attr("x", -(M.top + H / 2)).attr("y", 13)
      .attr("text-anchor","middle")
      .attr("font-family","'IBM Plex Mono',monospace").attr("font-size",8).attr("fill","#4e5e7a")
      .text("EV Sales");

    // Lines per region
    regions.forEach(region => {
      const grouped = data.filter(d => d.region_country === region);
      const actual   = grouped.filter(d => d.type === "Actual"  ).sort((a,b) => a.year - b.year);
      const forecast = grouped.filter(d => d.type === "Forecast").sort((a,b) => a.year - b.year);
      const color    = colorMap[region];

      if (actual.length > 1) {
        g.append("path")
          .attr("fill","none").attr("stroke",color)
          .attr("stroke-width",2).attr("opacity",.85)
          .attr("d", makeLine(actual));
      }

      if (forecast.length > 1) {
        const bridge = actual.length
          ? [actual[actual.length - 1], ...forecast]
          : forecast;
        g.append("path")
          .attr("fill","none").attr("stroke",color)
          .attr("stroke-width",1.5).attr("stroke-dasharray","5,4")
          .attr("opacity",.65)
          .attr("d", makeLine(bridge));
      }
    });

    // Hover overlay
    const focusLine = g.append("line")
      .attr("y1",0).attr("y2",H)
      .attr("stroke","#3b5278").attr("stroke-width",1).attr("stroke-dasharray","4,3")
      .style("opacity",0).style("pointer-events","none");

    svgEl.append("rect")
      .attr("x",M.left).attr("y",M.top)
      .attr("width",W).attr("height",H)
      .attr("fill","none").attr("pointer-events","all")
      .on("mousemove", function(event) {
        const [mx] = d3.pointer(event, g.node());
        const yr   = Math.round(x.invert(mx));
        const clampedYr = Math.max(years[0], Math.min(years[years.length-1], yr));

        focusLine.attr("x1",x(clampedYr)).attr("x2",x(clampedYr)).style("opacity",1);

        const rows = regions.map(region => {
          const pt = data.find(d => d.region_country === region && d.year === clampedYr);
          return pt ? { name: region, color: colorMap[region], val: pt.ev_sales, type: pt.type } : null;
        }).filter(Boolean).sort((a,b) => b.val - a.val);

        tooltip.innerHTML =
          `<div style="color:#4e5e7a;font-size:.6rem;margin-bottom:.25rem">${clampedYr}${clampedYr >= 2024 ? " · forecast" : ""}</div>` +
          rows.map(r =>
            `<span style="color:${r.color}">● ${r.name}</span>  ${d3.format(",d")(r.val)}`
          ).join("<br>");
        tooltip.style.opacity = "1";
        moveTip(event);
      })
      .on("mouseleave", () => {
        focusLine.style("opacity",0);
        hideTip();
      });

    // ── Side-panel stats ───────────────────────────────────────────────────────
    const peak2035 = d3.max(data.filter(d => d.year === 2035), d => d.ev_sales) ??
                     d3.max(data.filter(d => d.year === years[years.length-1]), d => d.ev_sales);
    const el = id => document.getElementById(id);
    if (el("fcast-prev-stat-peak"))   el("fcast-prev-stat-peak").textContent   = d3.format("~s")(peak2035 ?? 0);
    if (el("fcast-prev-stat-region")) el("fcast-prev-stat-region").textContent = allRegions.length + " regions";
    if (el("fcast-prev-stat-year"))   el("fcast-prev-stat-year").textContent   = String(years[years.length - 1]);

    // ── Legend ─────────────────────────────────────────────────────────────────
    const leg = document.getElementById("fcast-prev-legend");
    if (leg) {
      leg.innerHTML = regions.map(r => `
        <div class="fcast-prev-legend-row">
          <span class="fcast-prev-legend-dot" style="background:${colorMap[r]}"></span>
          <span class="fcast-prev-legend-name">${r}</span>
        </div>`).join("");
    }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  async function main() {
    const data = await loadData();

    buildChart(data);

    let raf = null;
    window.addEventListener("resize", () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => buildChart(data));
    });
  }

  main();

})();
