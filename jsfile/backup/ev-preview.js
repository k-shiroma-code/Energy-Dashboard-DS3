// ─────────────────────────────────────────────────────────────────────────────
// ev-preview.js
//
// Homepage preview of the EV Share Explorer bar chart.
// Uses the same data pipeline and D3 rendering logic as ev-share.js but is
// fully self-contained: all DOM queries use "ev-preview-*" IDs so this file
// never conflicts with index.js (which owns #yearSelect, #topNSelect, #chart)
// or ev-share.js.
//
// Features vs full ev-share.js:
//   ✓  Same CSV / sample-data pipeline
//   ✓  Same D3 horizontal bar chart with smooth transitions
//   ✓  Same colour palette
//   ✓  Hover tooltip (viewport-safe)
//   ✓  Year picker populates dynamically
//   ✓  Live stat tiles + top-5 ranking list in the side panel
//   ✗  No country chips (full-page feature only)
//   ✗  No summary table (full-page feature only)
//   ✗  Fixed top-10 (not configurable — keeps preview compact)
//
// DOM IDs required in index.html  (all prefixed "ev-preview-"):
//   #ev-preview-year          — year <select>
//   #ev-preview-chart         — SVG mount point
//   #ev-preview-hint          — status / warning text
//   #ev-preview-meta-title    — "Top 10 Countries"
//   #ev-preview-meta-sub      — "EV Sales · 2030"
//   #ev-preview-stat-total    — total-sales value
//   #ev-preview-stat-total-sub
//   #ev-preview-stat-leader   — leader country name
//   #ev-preview-stat-leader-sub
//   #ev-preview-stat-share    — leader share %
//   #ev-preview-ranking       — top-5 ranked list container
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // ── Palette ─────────────────────────────────────────────────────────────────
  const COLORS = [
    "#2dd4bf", "#5b8dee", "#f5a623", "#a78bfa", "#fb7185",
    "#34d399", "#fbbf24", "#60a5fa", "#e879f9", "#4ade80",
    "#f472b6", "#38bdf8", "#c084fc", "#86efac", "#fdba74",
    "#67e8f9", "#a5b4fc", "#fca5a5", "#6ee7b7", "#d8b4fe",
  ];

  // ── Config ───────────────────────────────────────────────────────────────────
  // CSV path is relative to index.html, which lives at the project root.
  const CSV_PATH  = "./data/ev_sales_pred.csv";
  const PREVIEW_N = 10;   // always show top 10
  const T_MS      = 500;  // transition ms
  // Slightly tighter margins than the full page to fit the smaller card
  const MARGIN    = { top: 10, right: 84, bottom: 44, left: 148 };
  const BAR_MIN_H = 18;
  const BAR_MAX_H = 34;

  // ── DOM refs (all namespaced — none clash with index.js) ─────────────────────
  const yearSel     = document.getElementById("ev-preview-year");
  const chartDiv    = document.getElementById("ev-preview-chart");
  const hintEl      = document.getElementById("ev-preview-hint");
  const metaTitle   = document.getElementById("ev-preview-meta-title");
  const metaSub     = document.getElementById("ev-preview-meta-sub");
  const statTotal   = document.getElementById("ev-preview-stat-total");
  const statTotalSb = document.getElementById("ev-preview-stat-total-sub");
  const statLeader  = document.getElementById("ev-preview-stat-leader");
  const statLeaderSb= document.getElementById("ev-preview-stat-leader-sub");
  const statShare   = document.getElementById("ev-preview-stat-share");
  const rankingEl   = document.getElementById("ev-preview-ranking");

  // Bail silently if the preview section isn't in the page
  if (!chartDiv) return;

  // ── State ────────────────────────────────────────────────────────────────────
  let allData = [];   // [{country, color, values:[{year,value}]}]
  let svgRef  = null; // D3 selection, built once then transitioned

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function colorFor(i) { return COLORS[i % COLORS.length]; }

  function setHint(msg, level = "ok") {
    if (!hintEl) return;
    hintEl.textContent = msg;
    hintEl.style.color =
      level === "warn" ? "#f5a623"
      : level === "err" ? "#ff6b6b"
      : "#4e5e7a";
  }

  // ── Data helpers ─────────────────────────────────────────────────────────────

  function normalizeRow(row) {
    const k  = Object.fromEntries(Object.keys(row).map(key => [key.toLowerCase(), key]));
    const yK = k["year"];
    const cK = k["country"] ?? k["region"] ?? k["name"];
    const vK = k["ev_sales"] ?? k["ev_sale"] ?? k["sales"] ?? k["value"] ?? k["evs"];
    if (!yK || !cK || !vK) return null;
    const year    = Number(row[yK]);
    const country = String(row[cK]).trim();
    const value   = Number(row[vK]);
    if (!Number.isFinite(year) || !country || !Number.isFinite(value)) return null;
    return { year, country, value };
  }

  async function loadData() {
    try {
      const raw    = await d3.csv(CSV_PATH);
      const parsed = raw.map(normalizeRow).filter(Boolean);
      if (!parsed.length) throw new Error("no rows");
      setHint("", "ok");
      return parsed;
    } catch {
      setHint("Sample data — add data/ev_sales_pred.csv for real values.", "warn");
      return buildSample();
    }
  }

  function structureData(flatRows) {
    const countrySet = [...new Set(flatRows.map(d => d.country))];
    const totals     = Object.fromEntries(
      countrySet.map(c => [c, d3.sum(flatRows.filter(r => r.country === c), r => r.value)])
    );
    countrySet.sort((a, b) => totals[b] - totals[a]);
    return countrySet.map((country, i) => ({
      country,
      color: colorFor(i),
      values: flatRows.filter(d => d.country === country).sort((a, b) => a.year - b.year),
    }));
  }

  function uniqueYears(flatRows) {
    return [...new Set(flatRows.map(d => d.year))].sort((a, b) => a - b);
  }

  function getValue(entry, year) {
    return entry.values.find(v => v.year === year)?.value ?? 0;
  }

  function topNForYear(year, n) {
    return allData
      .map(d => ({ ...d, value: getValue(d, year) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }

  // ── Sample data (identical generator to ev-share.js) ────────────────────────
  function buildSample() {
    const countries = [
      "China","United States","Germany","UK","France","Norway","Netherlands","Sweden",
      "Canada","Japan","South Korea","Italy","Spain","India","Australia","Brazil",
      "Mexico","Denmark","Belgium","Switzerland","Portugal","Austria","Poland",
      "Thailand","Indonesia","Turkey",
    ];
    const years = [2025, 2026, 2027, 2028, 2029, 2030];
    const rows  = [];
    for (const y of years) {
      for (let i = 0; i < countries.length; i++) {
        const base   = (countries.length - i) * 12_000;
        const growth = (y - 2025) * (2_000 + (i % 6) * 350);
        const noise  = (i % 5) * 900;
        rows.push({ year: y, country: countries[i], value: Math.max(0, base + growth - noise) });
      }
    }
    return rows;
  }

  // ── Tooltip ──────────────────────────────────────────────────────────────────
  const tooltip = (() => {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position:      "fixed",
      pointerEvents: "none",
      opacity:       "0",
      transition:    "opacity .12s",
      background:    "rgba(22,27,36,.97)",
      border:        "1px solid #3b5278",
      borderRadius:  "8px",
      padding:       ".55rem .85rem",
      fontFamily:    "'IBM Plex Mono', monospace",
      fontSize:      ".7rem",
      lineHeight:    "1.75",
      color:         "#e8edf5",
      zIndex:        "9999",
      boxShadow:     "0 6px 24px rgba(0,0,0,.55)",
      whiteSpace:    "nowrap",
    });
    document.body.appendChild(el);
    return el;
  })();

  function showTip(event, d, rank, total) {
    const share = total ? ((d.value / total) * 100).toFixed(1) : "—";
    tooltip.innerHTML =
      `<div style="color:#4e5e7a;font-size:.6rem;margin-bottom:.2rem">#${rank}</div>
       <div style="font-size:.78rem;font-weight:600;color:#e8edf5">${d.country}</div>
       <div style="color:#8a9ab8">${d3.format(",")(Math.round(d.value))} vehicles</div>
       <div style="color:#8a9ab8">${share}% of top-10</div>`;
    tooltip.style.opacity = "1";
    moveTip(event);
  }

  function moveTip(event) {
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    const vw = window.innerWidth,   vh = window.innerHeight;
    const G  = 12;
    let tx = event.clientX + G;
    let ty = event.clientY - G - th;
    if (tx + tw > vw - 8) tx = event.clientX - G - tw;
    if (ty < 8)           ty = event.clientY + G;
    tooltip.style.left = `${Math.max(8, Math.min(tx, vw - tw - 8))}px`;
    tooltip.style.top  = `${Math.max(8, Math.min(ty, vh - th - 8))}px`;
  }

  function hideTip() { tooltip.style.opacity = "0"; }

  // ── D3 Chart ─────────────────────────────────────────────────────────────────

  function buildChart(rows) {
    chartDiv.innerHTML = "";
    svgRef = null;

    const W     = chartDiv.clientWidth  || 500;
    const rowH  = Math.max(BAR_MIN_H, Math.min(BAR_MAX_H, Math.floor((W * 0.55) / rows.length)));
    const innerH = rows.length * rowH;
    const innerW = W - MARGIN.left - MARGIN.right;
    const H      = innerH + MARGIN.top + MARGIN.bottom;

    const svg = d3.select(chartDiv)
      .append("svg")
      .attr("width", W)
      .attr("height", H)
      .style("display", "block")
      .style("overflow", "visible");

    const g = svg.append("g")
      .attr("class", "pvw-root")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    g.append("g").attr("class", "pvw-grid");
    g.append("g").attr("class", "pvw-bars");
    g.append("g").attr("class", "pvw-bar-labels");
    g.append("g").attr("class", "pvw-x-axis").attr("transform", `translate(0,${innerH})`);
    g.append("g").attr("class", "pvw-y-axis");

    // X-axis label
    svg.append("text")
      .attr("class", "pvw-x-label")
      .attr("x", MARGIN.left + innerW / 2)
      .attr("y", H - 5)
      .attr("text-anchor", "middle")
      .attr("font-family", "'IBM Plex Mono', monospace")
      .attr("font-size", 10)
      .attr("fill", "#4e5e7a")
      .text("EV Sales (vehicles)");

    svgRef = svg;
  }

  function updateChart(rows, year) {
    if (!svgRef || !rows.length) return;

    const W     = chartDiv.clientWidth || 500;
    const rowH  = Math.max(BAR_MIN_H, Math.min(BAR_MAX_H, Math.floor((W * 0.55) / rows.length)));
    const innerH = rows.length * rowH;
    const innerW = W - MARGIN.left - MARGIN.right;
    const H      = innerH + MARGIN.top + MARGIN.bottom;
    const total  = d3.sum(rows, d => d.value);

    const x = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d.value) || 1])
      .nice()
      .range([0, innerW]);

    const yBand = d3.scaleBand()
      .domain(rows.map(d => d.country))
      .range([0, innerH])
      .padding(0.2);

    // Resize SVG
    svgRef.attr("width", W).attr("height", H);
    svgRef.select(".pvw-x-axis").attr("transform", `translate(0,${innerH})`);
    svgRef.select(".pvw-x-label").attr("x", MARGIN.left + innerW / 2).attr("y", H - 5);

    const T = d3.transition().duration(T_MS).ease(d3.easeCubicOut);
    const g = svgRef.select(".pvw-root");

    // Grid
    g.select(".pvw-grid")
      .selectAll(".pvw-gridline")
      .data(x.ticks(4))
      .join(
        e  => e.append("line").attr("class","pvw-gridline")
               .attr("y1",0).attr("y2",innerH)
               .attr("x1",d=>x(d)).attr("x2",d=>x(d))
               .attr("stroke","#2a3347").attr("stroke-width",.5)
               .attr("stroke-dasharray","3,4").attr("opacity",0)
               .call(en => en.transition(T).attr("opacity",.55)),
        u  => u.transition(T)
               .attr("x1",d=>x(d)).attr("x2",d=>x(d))
               .attr("y2",innerH).attr("opacity",.55),
        ex => ex.transition(T).attr("opacity",0).remove()
      );

    // X axis
    g.select(".pvw-x-axis")
      .transition(T)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("~s")).tickSizeOuter(0))
      .call(sel => {
        sel.selectAll("text").attr("font-family","'IBM Plex Mono',monospace").attr("font-size",10).attr("fill","#8a9ab8");
        sel.selectAll(".domain, .tick line").attr("stroke","#2a3347").attr("opacity",.5);
      });

    // Y axis
    g.select(".pvw-y-axis")
      .transition(T)
      .call(d3.axisLeft(yBand).tickSizeOuter(0).tickSizeInner(0).tickPadding(9))
      .call(sel => {
        sel.selectAll("text")
           .attr("font-family","'Syne',sans-serif").attr("font-size",11)
           .attr("font-weight",600).attr("fill","#e8edf5");
        sel.selectAll(".domain").attr("stroke","#2a3347").attr("opacity",.4);
        sel.selectAll(".tick line").remove();
      });

    // Bars
    g.select(".pvw-bars")
      .selectAll(".pvw-bar")
      .data(rows, d => d.country)
      .join(
        enter => enter.append("rect")
          .attr("class","pvw-bar")
          .attr("x",0)
          .attr("y",   d => yBand(d.country) ?? 0)
          .attr("height", yBand.bandwidth())
          .attr("width",0)
          .attr("rx",3)
          .attr("fill", d => d.color)
          .attr("opacity",.85)
          .style("cursor","default")
          .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity",1).attr("filter","brightness(1.12)");
            showTip(event, d, rows.indexOf(d)+1, total);
          })
          .on("mousemove", moveTip)
          .on("mouseout", function() {
            d3.select(this).attr("opacity",.85).attr("filter",null);
            hideTip();
          })
          .call(en => en.transition(T).attr("width", d => x(d.value))),

        update => update
          .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity",1).attr("filter","brightness(1.12)");
            showTip(event, d, rows.indexOf(d)+1, total);
          })
          .on("mousemove", moveTip)
          .on("mouseout", function() {
            d3.select(this).attr("opacity",.85).attr("filter",null);
            hideTip();
          })
          .transition(T)
          .attr("y",      d => yBand(d.country) ?? 0)
          .attr("height", yBand.bandwidth())
          .attr("width",  d => x(d.value))
          .attr("fill",   d => d.color),

        exit => exit.transition(T).attr("width",0).attr("opacity",0).remove()
      );

    // Value labels
    g.select(".pvw-bar-labels")
      .selectAll(".pvw-bar-label")
      .data(rows, d => d.country)
      .join(
        enter => enter.append("text")
          .attr("class","pvw-bar-label")
          .attr("x", d => x(d.value) + 7)
          .attr("y", d => (yBand(d.country)??0) + yBand.bandwidth()/2)
          .attr("dominant-baseline","middle")
          .attr("font-family","'IBM Plex Mono',monospace")
          .attr("font-size",9)
          .attr("fill","#8a9ab8")
          .attr("opacity",0)
          .text(d => d3.format("~s")(d.value))
          .call(en => en.transition(T).attr("opacity",1)),
        update => update.transition(T)
          .attr("x", d => x(d.value) + 7)
          .attr("y", d => (yBand(d.country)??0) + yBand.bandwidth()/2)
          .text(d => d3.format("~s")(d.value))
          .attr("opacity",1),
        exit => exit.transition(T).attr("opacity",0).remove()
      );
  }

  // ── Side panel updaters ───────────────────────────────────────────────────────

  function updateStats(rows, year) {
    const total  = d3.sum(rows, d => d.value);
    const leader = rows[0];
    const share  = total ? ((leader.value / total) * 100).toFixed(1) : "—";

    if (metaTitle)    metaTitle.textContent    = `Top ${rows.length} Countries`;
    if (metaSub)      metaSub.textContent      = `EV Sales · ${year}`;
    if (statTotal)    statTotal.textContent    = d3.format("~s")(total);
    if (statTotalSb)  statTotalSb.textContent  = `${year} · top ${rows.length}`;
    if (statLeader)   statLeader.textContent   = leader?.country ?? "—";
    if (statLeaderSb) statLeaderSb.textContent = `${d3.format("~s")(leader?.value ?? 0)} vehicles`;
    if (statShare)    statShare.textContent    = `${share}%`;
  }

  function updateRanking(rows) {
    if (!rankingEl) return;
    rankingEl.innerHTML = rows.slice(0, 5).map((d, i) => `
      <div class="preview-rank-row">
        <span class="preview-rank-num">#${i + 1}</span>
        <span class="preview-rank-dot" style="background:${d.color}"></span>
        <span class="preview-rank-name">${d.country}</span>
        <span class="preview-rank-val">${d3.format("~s")(d.value)}</span>
      </div>`).join("");
  }

  // ── Main render cycle ────────────────────────────────────────────────────────

  function render() {
    const year = yearSel ? Number(yearSel.value) : 2030;
    const rows = topNForYear(year, PREVIEW_N);
    if (!rows.length) return;

    if (!svgRef) buildChart(rows);
    updateChart(rows, year);
    updateStats(rows, year);
    updateRanking(rows);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────

  async function main() {
    const flatRows = await loadData();
    allData = structureData(flatRows);

    const years = uniqueYears(flatRows);

    // Populate year picker
    if (yearSel) {
      years.forEach(y => {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        yearSel.appendChild(opt);
      });
      // Default: latest year
      yearSel.value = String(years[years.length - 1]);
      yearSel.addEventListener("change", () => { svgRef = null; render(); });
    }

    // Responsive resize
    let raf = null;
    window.addEventListener("resize", () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { svgRef = null; render(); });
    });

    render();
  }

  main();

})();
