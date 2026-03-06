// ─────────────────────────────────────────────────────────────────────────────
// oil-preview.js
//
// Homepage preview of the Oil Imports Explorer line chart.
// Self-contained IIFE. All DOM queries use "oil-prev-*" IDs so this file
// never conflicts with oil-info.html's inline script or any other page script.
//
// Renders a compact multi-line chart of oil import volumes (kb/d) for a
// representative set of countries, 2000–2023 historical + 2024–2030 forecast.
// Uses the same colour palette and data shape as oil-info.html.
//
// DOM IDs required in index.html (all prefixed "oil-prev-"):
//   #oil-prev-chart       — SVG mount point
//   #oil-prev-hint        — status / warning text (aria-live)
//   #oil-prev-stat-total  — total 2023 imports value
//   #oil-prev-stat-top    — largest importer name
//   #oil-prev-stat-trend  — avg forecast trend label
//   #oil-prev-legend      — colour legend rows
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // ── Bail if mount point absent ───────────────────────────────────────────────
  const chartDiv = document.getElementById("oil-prev-chart");
  if (!chartDiv) return;

  // ── Colour palette (mirrors oil-info.html) ───────────────────────────────────
  const COLORS = [
    "#3b82f6","#22c55e","#ef4444","#f59e0b","#a78bfa",
    "#06b6d4","#ec4899","#10b981","#f97316","#6366f1",
  ];

  // ── Sample data: top-6 oil importers, 2000–2030 ─────────────────────────────
  // Values are kb/d (thousand barrels per day), approximate IEA-scale figures.
  // history = solid line, forecast = dashed line (from 2024 onward).
  const RAW = [
    // China
    { c:"China",     y:2000, t:"history",  v:1558 },
    { c:"China",     y:2005, t:"history",  v:2540 },
    { c:"China",     y:2010, t:"history",  v:4753 },
    { c:"China",     y:2015, t:"history",  v:6607 },
    { c:"China",     y:2020, t:"history",  v:10853},
    { c:"China",     y:2023, t:"history",  v:11290},
    { c:"China",     y:2025, t:"forecast", v:11740},
    { c:"China",     y:2028, t:"forecast", v:12310},
    { c:"China",     y:2030, t:"forecast", v:12650},
    // USA
    { c:"USA",       y:2000, t:"history",  v:10419},
    { c:"USA",       y:2005, t:"history",  v:12539},
    { c:"USA",       y:2010, t:"history",  v:11793},
    { c:"USA",       y:2015, t:"history",  v:9449 },
    { c:"USA",       y:2020, t:"history",  v:7862 },
    { c:"USA",       y:2023, t:"history",  v:8504 },
    { c:"USA",       y:2025, t:"forecast", v:8240 },
    { c:"USA",       y:2028, t:"forecast", v:7980 },
    { c:"USA",       y:2030, t:"forecast", v:7750 },
    // India
    { c:"India",     y:2000, t:"history",  v:1508 },
    { c:"India",     y:2005, t:"history",  v:2058 },
    { c:"India",     y:2010, t:"history",  v:3288 },
    { c:"India",     y:2015, t:"history",  v:4159 },
    { c:"India",     y:2020, t:"history",  v:4427 },
    { c:"India",     y:2023, t:"history",  v:5022 },
    { c:"India",     y:2025, t:"forecast", v:5340 },
    { c:"India",     y:2028, t:"forecast", v:5820 },
    { c:"India",     y:2030, t:"forecast", v:6140 },
    // Japan
    { c:"Japan",     y:2000, t:"history",  v:5560 },
    { c:"Japan",     y:2005, t:"history",  v:5220 },
    { c:"Japan",     y:2010, t:"history",  v:4410 },
    { c:"Japan",     y:2015, t:"history",  v:3590 },
    { c:"Japan",     y:2020, t:"history",  v:2840 },
    { c:"Japan",     y:2023, t:"history",  v:2680 },
    { c:"Japan",     y:2025, t:"forecast", v:2560 },
    { c:"Japan",     y:2028, t:"forecast", v:2380 },
    { c:"Japan",     y:2030, t:"forecast", v:2220 },
    // Germany
    { c:"Germany",   y:2000, t:"history",  v:2320 },
    { c:"Germany",   y:2005, t:"history",  v:2210 },
    { c:"Germany",   y:2010, t:"history",  v:1930 },
    { c:"Germany",   y:2015, t:"history",  v:1870 },
    { c:"Germany",   y:2020, t:"history",  v:1620 },
    { c:"Germany",   y:2023, t:"history",  v:1590 },
    { c:"Germany",   y:2025, t:"forecast", v:1520 },
    { c:"Germany",   y:2028, t:"forecast", v:1430 },
    { c:"Germany",   y:2030, t:"forecast", v:1340 },
    // South Korea
    { c:"S. Korea",  y:2000, t:"history",  v:2180 },
    { c:"S. Korea",  y:2005, t:"history",  v:2380 },
    { c:"S. Korea",  y:2010, t:"history",  v:2510 },
    { c:"S. Korea",  y:2015, t:"history",  v:2710 },
    { c:"S. Korea",  y:2020, t:"history",  v:2540 },
    { c:"S. Korea",  y:2023, t:"history",  v:2610 },
    { c:"S. Korea",  y:2025, t:"forecast", v:2580 },
    { c:"S. Korea",  y:2028, t:"forecast", v:2490 },
    { c:"S. Korea",  y:2030, t:"forecast", v:2380 },
  ];

  // ── Structure data by country ────────────────────────────────────────────────
  const countries = [...new Set(RAW.map(d => d.c))];

  const structured = countries.map((name, i) => ({
    name,
    color: COLORS[i % COLORS.length],
    history:  RAW.filter(d => d.c === name && d.t === "history" ).map(d => ({ y: d.y, v: d.v })),
    forecast: RAW.filter(d => d.c === name && d.t === "forecast").map(d => ({ y: d.y, v: d.v })),
  }));

  // ── Side-panel stats ─────────────────────────────────────────────────────────
  function updateStats() {
    const last2023 = structured.map(d => {
      const h = d.history.find(r => r.y === 2023);
      return { name: d.name, v: h ? h.v : 0 };
    });
    const total    = last2023.reduce((s, d) => s + d.v, 0);
    const top      = [...last2023].sort((a, b) => b.v - a.v)[0];
    const avgFcst2030 = structured.map(d => {
      const h = d.history.find(r => r.y === 2023)?.v ?? 0;
      const f = d.forecast.find(r => r.y === 2030)?.v ?? h;
      return h ? ((f - h) / h) * 100 : 0;
    });
    const avgChg   = avgFcst2030.reduce((s, v) => s + v, 0) / avgFcst2030.length;
    const trend    = avgChg >= 2 ? "↑ Rising demand" : avgChg <= -2 ? "↓ Easing demand" : "→ Stable demand";

    const el = id => document.getElementById(id);
    if (el("oil-prev-stat-total")) el("oil-prev-stat-total").textContent = d3.format(",.0f")(total) + " kb/d";
    if (el("oil-prev-stat-top"))   el("oil-prev-stat-top").textContent   = top.name;
    if (el("oil-prev-stat-trend")) el("oil-prev-stat-trend").textContent = trend;
  }

  // ── Legend ───────────────────────────────────────────────────────────────────
  function buildLegend() {
    const el = document.getElementById("oil-prev-legend");
    if (!el) return;
    el.innerHTML = structured.map(d => `
      <div class="oil-prev-legend-row">
        <span class="oil-prev-legend-dot" style="background:${d.color}"></span>
        <span class="oil-prev-legend-name">${d.name}</span>
      </div>`).join("");
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

  // ── Chart ────────────────────────────────────────────────────────────────────
  function buildChart() {
    chartDiv.innerHTML = "";

    const W_TOTAL = chartDiv.clientWidth || 600;
    const H_TOTAL = 260;
    const M = { top: 12, right: 30, bottom: 38, left: 58 };
    const W = W_TOTAL - M.left - M.right;
    const H = H_TOTAL - M.top  - M.bottom;

    // Year domain: 2000–2030
    const allYears  = [...new Set(RAW.map(d => d.y))].sort((a,b) => a - b);
    const xDomain   = [allYears[0], allYears[allYears.length - 1]];
    const maxVal    = d3.max(RAW, d => d.v);

    const x = d3.scaleLinear().domain(xDomain).range([0, W]);
    const y = d3.scaleLinear().domain([0, maxVal * 1.05]).nice().range([H, 0]);

    const line = (accessor) => d3.line()
      .x(d => x(d.y))
      .y(d => y(d.v))
      .curve(d3.curveMonotoneX)(accessor);

    const svgEl = d3.select(chartDiv)
      .append("svg")
      .attr("width", W_TOTAL).attr("height", H_TOTAL)
      .attr("viewBox", `0 0 ${W_TOTAL} ${H_TOTAL}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block");

    const g = svgEl.append("g").attr("transform", `translate(${M.left},${M.top})`);

    // Grid lines
    g.append("g").attr("class","oil-prev-grid")
      .selectAll("line").data(y.ticks(4)).join("line")
      .attr("x1",0).attr("x2",W)
      .attr("y1",d=>y(d)).attr("y2",d=>y(d))
      .attr("stroke","#2a3347").attr("stroke-dasharray","3,4").attr("opacity",.55);

    // 2024 separator
    g.append("line")
      .attr("x1",x(2024)).attr("x2",x(2024))
      .attr("y1",0).attr("y2",H)
      .attr("stroke","#8a9ab8").attr("stroke-dasharray","4,4")
      .attr("opacity",.45);

    g.append("text")
      .attr("x",x(2024)+4).attr("y",8)
      .attr("font-family","'IBM Plex Mono',monospace").attr("font-size",8)
      .attr("fill","#4e5e7a").text("Forecast →");

    // Axes
    g.append("g").attr("transform",`translate(0,${H})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(6).tickSizeOuter(0))
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

    // Y-axis label
    svgEl.append("text")
      .attr("transform","rotate(-90)")
      .attr("x", -(M.top + H / 2))
      .attr("y", 12)
      .attr("text-anchor","middle")
      .attr("font-family","'IBM Plex Mono',monospace").attr("font-size",8).attr("fill","#4e5e7a")
      .text("kb/d");

    // Lines per country
    structured.forEach(d => {
      // History — solid
      if (d.history.length > 1) {
        g.append("path")
          .attr("fill","none")
          .attr("stroke", d.color)
          .attr("stroke-width", 2)
          .attr("opacity", .85)
          .attr("d", line(d.history));
      }
      // Forecast — dashed
      if (d.forecast.length > 1) {
        // Bridge: last history point → first forecast point
        const bridge = [d.history[d.history.length - 1], ...d.forecast].filter(Boolean);
        g.append("path")
          .attr("fill","none")
          .attr("stroke", d.color)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray","5,4")
          .attr("opacity", .65)
          .attr("d", line(bridge));
      }
    });

    // Invisible overlay for hover tooltip
    const bisect = d3.bisector(d => d).left;
    const focusLine = g.append("line")
      .attr("y1",0).attr("y2",H)
      .attr("stroke","#3b5278").attr("stroke-width",1)
      .attr("stroke-dasharray","4,3")
      .style("opacity",0).style("pointer-events","none");

    svgEl.append("rect")
      .attr("x", M.left).attr("y", M.top)
      .attr("width", W).attr("height", H)
      .attr("fill","none").attr("pointer-events","all")
      .on("mousemove", function(event) {
        const [mx] = d3.pointer(event, g.node());
        const yr   = Math.round(x.invert(mx));
        const clampedYr = Math.max(xDomain[0], Math.min(xDomain[1], yr));

        focusLine.attr("x1",x(clampedYr)).attr("x2",x(clampedYr)).style("opacity",1);

        // Collect values for this year from all countries
        const rows = structured.map(d => {
          const all = [...d.history, ...d.forecast].sort((a,b)=>a.y-b.y);
          // linear interpolate between the two nearest data points
          const idx  = bisect(all.map(r=>r.y), clampedYr);
          const lo   = all[idx-1], hi = all[idx];
          let val;
          if (!lo && hi)       val = hi.v;
          else if (lo && !hi)  val = lo.v;
          else if (lo && hi) {
            const t = (clampedYr - lo.y) / (hi.y - lo.y);
            val = lo.v + t * (hi.v - lo.v);
          } else val = null;
          return { name: d.name, color: d.color, val };
        }).filter(d => d.val !== null).sort((a,b) => b.val - a.val);

        tooltip.innerHTML =
          `<div style="color:#4e5e7a;font-size:.6rem;margin-bottom:.25rem">${clampedYr}${clampedYr >= 2024 ? " · forecast" : ""}</div>` +
          rows.map(r =>
            `<span style="color:${r.color}">● ${r.name}</span>  ${d3.format(",.0f")(Math.round(r.val))} kb/d`
          ).join("<br>");
        tooltip.style.opacity = "1";
        moveTip(event);
      })
      .on("mouseleave", () => {
        focusLine.style("opacity", 0);
        hideTip();
      });
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  function main() {
    const hint = document.getElementById("oil-prev-hint");
    if (hint) hint.textContent = ""; // data is inline — no load warning needed

    buildChart();
    updateStats();
    buildLegend();

    // Responsive resize
    let raf = null;
    window.addEventListener("resize", () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => buildChart());
    });
  }

  main();

})();
