// ─────────────────────────────────────────────────────────────────────────────
// ev-share.js
//
// Interaction model: mirrors oil-info.html (Oil Explorer)
//   • Stat cards auto-populate on load
//   • Year select + Top-N select drive a D3 horizontal bar chart
//   • Country chips highlight / dim individual bars (chart stays full)
//   • Hover tooltip shows rank, country, value, share %
//   • Summary table lists every visible country with rank + value
//   • Responsive resize re-draws the chart
//
// DOM contract (IDs that must exist in ev-share.html):
//   #statGrid     — stat card container
//   #yearSelect   — year <select>  (populated here)
//   #topNSelect   — top-N <select> (already has options in HTML)
//   #metaTitle    — dynamic heading
//   #metaSub      — dynamic sub-heading
//   #dataHint     — status / warning text
//   #chart        — SVG mount point
//   #emptyState   — hidden fallback message
//   #chipRow      — chip container
//   #chipAll      — "Select All" button
//   #chipClear    — "Clear" button
//   #tableLabel   — table section heading
//   #summaryTable — table container
//   #year         — footer year span
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // ── Palette (matches dashboard accent tokens) ───────────────────────────────
  const COLORS = [
    "#2dd4bf", // teal
    "#5b8dee", // blue
    "#f5a623", // amber
    "#a78bfa", // purple
    "#fb7185", // rose
    "#34d399", // emerald
    "#fbbf24", // yellow
    "#60a5fa", // sky
    "#e879f9", // fuchsia
    "#4ade80", // green
    "#f472b6", // pink
    "#38bdf8", // light-blue
    "#c084fc", // violet
    "#86efac", // light-green
    "#fdba74", // light-orange
    "#67e8f9", // cyan
    "#a5b4fc", // indigo-light
    "#fca5a5", // red-light
    "#6ee7b7", // mint
    "#d8b4fe", // lavender
    "#fde68a", // lemon
    "#7dd3fc", // cornflower
    "#f9a8d4", // blush
    "#bbf7d0", // pale-green
    "#fed7aa", // peach
    "#e2e8f0", // slate-light
  ];

  // ── Config ──────────────────────────────────────────────────────────────────
  const CSV_PATH     = "../data/ev_sales_pred.csv";
  const DEFAULT_TOPN = 20;
  const T_MS         = 550;   // transition duration ms
  const MARGIN       = { top: 12, right: 100, bottom: 52, left: 172 };
  const BAR_MIN_H    = 18;
  const BAR_MAX_H    = 38;

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const yearSelect  = document.getElementById("yearSelect");
  const topNSelect  = document.getElementById("topNSelect");
  const metaTitle   = document.getElementById("metaTitle");
  const metaSub     = document.getElementById("metaSub");
  const dataHint    = document.getElementById("dataHint");
  const chartDiv    = document.getElementById("chart");
  const emptyState  = document.getElementById("emptyState");
  const chipRowEl   = document.getElementById("chipRow");

  // ── State ───────────────────────────────────────────────────────────────────
  let allData    = [];   // [{country, color, values:[{year,value}]}]
  let highlighted = []; // countries currently active in chips
  let svgRef     = null; // D3 selection – built once

  // ── Colour helper ───────────────────────────────────────────────────────────
  function colorFor(i) { return COLORS[i % COLORS.length]; }

  // ── Status helper ───────────────────────────────────────────────────────────
  function setHint(msg, level = "ok") {
    if (!dataHint) return;
    dataHint.textContent = msg;
    dataHint.style.color =
      level === "warn" ? "var(--accent-amber, #f5a623)"
      : level === "err" ? "var(--red, #ff6b6b)"
      : "var(--text-muted, #4e5e7a)";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA
  // ─────────────────────────────────────────────────────────────────────────────

  /** Case-insensitive CSV column normaliser */
  function normalizeRow(row) {
    const k = Object.fromEntries(Object.keys(row).map(key => [key.toLowerCase(), key]));
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
      if (!parsed.length) throw new Error("No valid rows.");
      setHint(`Loaded ${parsed.length} rows from ${CSV_PATH}.`, "ok");
      return parsed;
    } catch {
      setHint(`Could not load ${CSV_PATH} — showing sample data. Add your CSV to data/ to use real values.`, "warn");
      return buildSample();
    }
  }

  /** Flat rows → [{country, color, values:[{year,value}]}] */
  function structureData(flatRows) {
    const countrySet = [...new Set(flatRows.map(d => d.country))];
    // Sort by total sales descending so colour assignment is stable
    const totals = Object.fromEntries(
      countrySet.map(c => [c, d3.sum(flatRows.filter(d => d.country === c), d => d.value)])
    );
    countrySet.sort((a, b) => totals[b] - totals[a]);

    return countrySet.map((country, i) => ({
      country,
      color: colorFor(i),
      values: flatRows
        .filter(d => d.country === country)
        .sort((a, b) => a.year - b.year),
    }));
  }

  function uniqueYears(flatRows) {
    return [...new Set(flatRows.map(d => d.year))].sort((a, b) => a - b);
  }

  /** Get value for a specific country + year, returns 0 if missing */
  function getValue(entry, year) {
    return entry.values.find(v => v.year === year)?.value ?? 0;
  }

  /** Return top-N rows for a given year, sorted desc */
  function topNForYear(year, n) {
    return allData
      .map(d => ({ ...d, value: getValue(d, year) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SAMPLE DATA
  // ─────────────────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────────────────
  // STAT CARDS
  // ─────────────────────────────────────────────────────────────────────────────

  function buildStatCards(year, rows) {
    const grid = document.getElementById("statGrid");
    if (!grid) return;

    const totalSales = d3.sum(rows, d => d.value);
    const leader     = rows[0];
    const leaderPct  = totalSales ? ((leader.value / totalSales) * 100).toFixed(1) : 0;
    const years      = uniqueYears(allData.flatMap(d => d.values));
    const prevYear   = years[years.indexOf(year) - 1];
    let   yoyLabel   = "—";
    if (prevYear != null) {
      const prevTotal = d3.sum(allData, d => getValue(d, prevYear));
      if (prevTotal) {
        const pct = ((totalSales - prevTotal) / prevTotal) * 100;
        yoyLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
      }
    }

    const stats = [
      {
        label: "Total EV Sales",
        value: d3.format("~s")(totalSales),
        sub:   `${year} · Top ${rows.length} countries`,
      },
      {
        label: "Market Leader",
        value: leader?.country ?? "—",
        sub:   `${d3.format("~s")(leader?.value ?? 0)} vehicles`,
      },
      {
        label: "Leader Share",
        value: `${leaderPct}%`,
        sub:   `of top-${rows.length} total`,
      },
      {
        label: "YoY Growth",
        value: yoyLabel,
        sub:   prevYear ? `vs ${prevYear}` : "No prior year",
      },
    ];

    grid.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-sub">${s.sub}</div>
      </div>`).join("");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOOLTIP
  // ─────────────────────────────────────────────────────────────────────────────

  const tooltip = (() => {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position:      "fixed",
      pointerEvents: "none",
      opacity:       "0",
      transition:    "opacity 0.12s",
      background:    "rgba(22,27,36,0.97)",
      border:        "1px solid #3b5278",
      borderRadius:  "10px",
      padding:       "0.65rem 1rem",
      fontFamily:    "'IBM Plex Mono', monospace",
      fontSize:      "0.72rem",
      lineHeight:    "1.75",
      color:         "#e8edf5",
      zIndex:        "9999",
      boxShadow:     "0 8px 28px rgba(0,0,0,0.55)",
      minWidth:      "160px",
      whiteSpace:    "nowrap",
    });
    document.body.appendChild(el);
    return el;
  })();

  function showTooltip(event, d, rank, totalSales) {
    const share = totalSales ? ((d.value / totalSales) * 100).toFixed(1) : "—";
    tooltip.innerHTML = `
      <div style="color:#4e5e7a;font-size:.63rem;margin-bottom:.3rem">#${rank} · ${d.year ?? ""}</div>
      <div style="font-size:.82rem;font-weight:600;color:#e8edf5;margin-bottom:.2rem">${d.country}</div>
      <div style="color:#8a9ab8">${d3.format(",")(Math.round(d.value))} <span style="font-size:.63rem">vehicles</span></div>
      <div style="color:#8a9ab8;margin-top:.1rem">${share}% of total</div>`;
    tooltip.style.opacity = "1";
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    const vw = window.innerWidth,   vh = window.innerHeight;
    const G  = 14;
    let tx = event.clientX + G;
    let ty = event.clientY - G - th;
    if (tx + tw > vw - 8) tx = event.clientX - G - tw;
    if (ty < 8)           ty = event.clientY + G;
    tx = Math.max(8, Math.min(tx, vw - tw - 8));
    ty = Math.max(8, Math.min(ty, vh - th - 8));
    tooltip.style.left = `${tx}px`;
    tooltip.style.top  = `${ty}px`;
  }

  function hideTooltip() { tooltip.style.opacity = "0"; }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHART
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build SVG skeleton once, then call updateChart() to transition data.
   * Chip highlighting dims bars rather than removing them.
   */
  function buildChart(rows) {
    chartDiv.innerHTML = "";
    svgRef = null;

    const W     = chartDiv.clientWidth;
    const rowH  = Math.max(BAR_MIN_H, Math.min(BAR_MAX_H, Math.floor((W * 0.6) / rows.length)));
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
      .attr("class", "chart-root")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Skeleton groups (render order: grid → bars → labels → axes)
    g.append("g").attr("class", "ev-grid");
    g.append("g").attr("class", "ev-bars");
    g.append("g").attr("class", "ev-bar-labels");
    g.append("g").attr("class", "ev-rank-labels");
    g.append("g").attr("class", "ev-x-axis").attr("transform", `translate(0,${innerH})`);
    g.append("g").attr("class", "ev-y-axis");

    // X-axis label
    svg.append("text")
      .attr("class", "ev-x-label")
      .attr("x", MARGIN.left + innerW / 2)
      .attr("y", H - 6)
      .attr("text-anchor", "middle")
      .attr("font-family", "'IBM Plex Mono', monospace")
      .attr("font-size", 11)
      .attr("fill", "#4e5e7a")
      .text("EV Sales (vehicles)");

    svgRef = svg;
  }

  function updateChart(rows, year) {
    if (!svgRef || !rows.length) {
      emptyState && (emptyState.hidden = !rows.length);
      return;
    }
    emptyState && (emptyState.hidden = true);

    const W     = chartDiv.clientWidth;
    const rowH  = Math.max(BAR_MIN_H, Math.min(BAR_MAX_H, Math.floor((W * 0.6) / rows.length)));
    const innerH = rows.length * rowH;
    const innerW = W - MARGIN.left - MARGIN.right;
    const H      = innerH + MARGIN.top + MARGIN.bottom;

    const totalSales = d3.sum(rows, d => d.value);

    const xMax = d3.max(rows, d => d.value) || 1;
    const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerW]);
    const yBand = d3.scaleBand()
      .domain(rows.map(d => d.country))
      .range([0, innerH])
      .padding(0.2);

    // Resize SVG
    svgRef.attr("width", W).attr("height", H);
    svgRef.select(".ev-x-axis").attr("transform", `translate(0,${innerH})`);
    svgRef.select(".ev-x-label").attr("x", MARGIN.left + innerW / 2).attr("y", H - 6);

    const T = d3.transition().duration(T_MS).ease(d3.easeCubicOut);
    const g = svgRef.select(".chart-root");

    // ── Grid ──────────────────────────────────────────────────────────────
    g.select(".ev-grid")
      .selectAll(".ev-grid-line")
      .data(x.ticks(5))
      .join(
        e => e.append("line").attr("class", "ev-grid-line")
          .attr("y1", 0).attr("y2", innerH)
          .attr("x1", d => x(d)).attr("x2", d => x(d))
          .attr("stroke", "#2a3347").attr("stroke-width", 0.6)
          .attr("stroke-dasharray", "3,4").attr("opacity", 0)
          .call(en => en.transition(T).attr("opacity", 0.6)),
        u => u.transition(T).attr("x1", d => x(d)).attr("x2", d => x(d)).attr("y2", innerH).attr("opacity", 0.6),
        ex => ex.transition(T).attr("opacity", 0).remove()
      );

    // ── X Axis ────────────────────────────────────────────────────────────
    g.select(".ev-x-axis")
      .transition(T)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("~s")).tickSizeOuter(0))
      .call(sel => {
        sel.selectAll("text").attr("font-family", "'IBM Plex Mono', monospace").attr("font-size", 11).attr("fill", "#8a9ab8");
        sel.selectAll(".domain, .tick line").attr("stroke", "#2a3347").attr("opacity", 0.5);
      });

    // ── Y Axis ────────────────────────────────────────────────────────────
    g.select(".ev-y-axis")
      .transition(T)
      .call(d3.axisLeft(yBand).tickSizeOuter(0).tickSizeInner(0).tickPadding(10))
      .call(sel => {
        sel.selectAll("text")
          .attr("font-family", "'Syne', sans-serif")
          .attr("font-size", 12)
          .attr("font-weight", 600)
          .attr("fill", d => highlighted.includes(d) ? "#e8edf5" : "#4e5e7a");
        sel.selectAll(".domain").attr("stroke", "#2a3347").attr("opacity", 0.4);
        sel.selectAll(".tick line").remove();
      });

    // ── Bars ──────────────────────────────────────────────────────────────
    g.select(".ev-bars")
      .selectAll(".ev-bar")
      .data(rows, d => d.country)
      .join(
        enter => enter.append("rect")
          .attr("class", "ev-bar")
          .attr("x", 0)
          .attr("y", d => yBand(d.country) ?? 0)
          .attr("height", yBand.bandwidth())
          .attr("width", 0)
          .attr("rx", 3)
          .attr("fill", d => d.color)
          .attr("opacity", d => highlighted.includes(d.country) ? 0.88 : 0.22)
          .on("mouseover", function (event, d) {
            if (highlighted.includes(d.country)) {
              d3.select(this).attr("opacity", 1).attr("filter", "brightness(1.15)");
            }
            const rank = rows.indexOf(d) + 1;
            const row  = { ...d, year };
            showTooltip(event, row, rank, totalSales);
          })
          .on("mousemove", moveTooltip)
          .on("mouseout", function (_, d) {
            d3.select(this).attr("opacity", highlighted.includes(d.country) ? 0.88 : 0.22).attr("filter", null);
            hideTooltip();
          })
          .call(en => en.transition(T).attr("width", d => x(d.value))),

        update => update
          .on("mouseover", function (event, d) {
            if (highlighted.includes(d.country)) {
              d3.select(this).attr("opacity", 1).attr("filter", "brightness(1.15)");
            }
            const rank = rows.indexOf(d) + 1;
            const row  = { ...d, year };
            showTooltip(event, row, rank, totalSales);
          })
          .on("mousemove", moveTooltip)
          .on("mouseout", function (_, d) {
            d3.select(this).attr("opacity", highlighted.includes(d.country) ? 0.88 : 0.22).attr("filter", null);
            hideTooltip();
          })
          .transition(T)
          .attr("y", d => yBand(d.country) ?? 0)
          .attr("height", yBand.bandwidth())
          .attr("width", d => x(d.value))
          .attr("fill", d => d.color)
          .attr("opacity", d => highlighted.includes(d.country) ? 0.88 : 0.22),

        exit => exit.transition(T).attr("width", 0).attr("opacity", 0).remove()
      );

    // ── Value labels ──────────────────────────────────────────────────────
    g.select(".ev-bar-labels")
      .selectAll(".ev-bar-label")
      .data(rows, d => d.country)
      .join(
        enter => enter.append("text")
          .attr("class", "ev-bar-label")
          .attr("x", d => x(d.value) + 8)
          .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-family", "'IBM Plex Mono', monospace")
          .attr("font-size", 10)
          .attr("fill", d => highlighted.includes(d.country) ? "#8a9ab8" : "#2a3347")
          .attr("opacity", 0)
          .text(d => d3.format("~s")(d.value))
          .call(en => en.transition(T).attr("opacity", 1)),

        update => update.transition(T)
          .attr("x", d => x(d.value) + 8)
          .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
          .attr("fill", d => highlighted.includes(d.country) ? "#8a9ab8" : "#2a3347")
          .text(d => d3.format("~s")(d.value))
          .attr("opacity", 1),

        exit => exit.transition(T).attr("opacity", 0).remove()
      );

    // ── Rank labels ───────────────────────────────────────────────────────
    g.select(".ev-rank-labels")
      .selectAll(".ev-rank-label")
      .data(rows, d => d.country)
      .join(
        enter => enter.append("text")
          .attr("class", "ev-rank-label")
          .attr("x", -(MARGIN.left - 4))
          .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
          .attr("dominant-baseline", "middle")
          .attr("text-anchor", "start")
          .attr("font-family", "'IBM Plex Mono', monospace")
          .attr("font-size", 10)
          .attr("fill", d => highlighted.includes(d.country) ? "#4e5e7a" : "#2a3347")
          .attr("opacity", 0)
          .text((_, i) => `#${String(i + 1).padStart(2, "0")}`)
          .call(en => en.transition(T).attr("opacity", 0.8)),

        update => update.transition(T)
          .attr("y", d => (yBand(d.country) ?? 0) + yBand.bandwidth() / 2)
          .attr("fill", d => highlighted.includes(d.country) ? "#4e5e7a" : "#2a3347")
          .text((_, i) => `#${String(i + 1).padStart(2, "0")}`)
          .attr("opacity", 0.8),

        exit => exit.transition(T).attr("opacity", 0).remove()
      );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHIPS
  // ─────────────────────────────────────────────────────────────────────────────

  function buildChips(rows) {
    chipRowEl.innerHTML = "";
    rows.forEach(d => {
      const btn = document.createElement("button");
      btn.className = `country-chip${highlighted.includes(d.country) ? " active" : ""}`;
      btn.style.setProperty("--chip-c", d.color);
      btn.innerHTML = `<span class="chip-dot" style="background:${d.color}"></span>${d.country}`;
      btn.onclick = () => {
        if (highlighted.includes(d.country)) {
          if (highlighted.length > 1) highlighted = highlighted.filter(c => c !== d.country);
        } else {
          highlighted.push(d.country);
        }
        buildChips(rows);
        applyHighlight(rows);
      };
      chipRowEl.appendChild(btn);
    });

    document.getElementById("chipAll").onclick = () => {
      highlighted = rows.map(d => d.country);
      buildChips(rows);
      applyHighlight(rows);
    };
    document.getElementById("chipClear").onclick = () => {
      highlighted = [rows[0]?.country].filter(Boolean);
      buildChips(rows);
      applyHighlight(rows);
    };
  }

  /** Re-apply opacity to existing bars + labels without a full redraw */
  function applyHighlight(rows) {
    if (!svgRef) return;
    const T = d3.transition().duration(200);

    svgRef.select(".ev-bars").selectAll(".ev-bar")
      .transition(T)
      .attr("opacity", d => highlighted.includes(d.country) ? 0.88 : 0.22);

    svgRef.select(".ev-bar-labels").selectAll(".ev-bar-label")
      .transition(T)
      .attr("fill", d => highlighted.includes(d.country) ? "#8a9ab8" : "#2a3347");

    svgRef.select(".ev-rank-labels").selectAll(".ev-rank-label")
      .transition(T)
      .attr("fill", d => highlighted.includes(d.country) ? "#4e5e7a" : "#2a3347");

    // Update y-axis tick colours
    svgRef.select(".ev-y-axis").selectAll(".tick text")
      .transition(T)
      .attr("fill", d => highlighted.includes(d) ? "#e8edf5" : "#4e5e7a");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY TABLE
  // ─────────────────────────────────────────────────────────────────────────────

  function buildTable(rows, year) {
    const totalSales = d3.sum(rows, d => d.value);
    const years      = uniqueYears(allData.flatMap(d => d.values));
    const prevYear   = years[years.indexOf(year) - 1];

    document.getElementById("tableLabel").textContent =
      `Sales Summary — ${year}${prevYear ? ` (vs ${prevYear})` : ""}`;

    const tableRows = rows.map((d, i) => {
      const share = totalSales ? ((d.value / totalSales) * 100).toFixed(1) : "—";
      let changeHtml = '<span class="change-flat">—</span>';

      if (prevYear != null) {
        const prev = getValue(allData.find(e => e.country === d.country), prevYear);
        if (prev > 0) {
          const pct   = ((d.value - prev) / prev) * 100;
          const cls   = pct >= 2 ? "change-up" : pct <= -2 ? "change-down" : "change-flat";
          const arrow = pct >= 2 ? "↑" : pct <= -2 ? "↓" : "→";
          changeHtml  = `<span class="${cls}">${arrow} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span>`;
        }
      }

      return `<tr>
        <td class="td-mono">#${String(i + 1).padStart(2, "0")}</td>
        <td><div class="td-country"><span class="td-dot" style="background:${d.color}"></span>${d.country}</div></td>
        <td class="td-mono">${Math.round(d.value).toLocaleString()}</td>
        <td class="td-mono">${share}%</td>
        <td>${changeHtml}</td>
      </tr>`;
    }).join("");

    document.getElementById("summaryTable").innerHTML = `
      <table class="ev-table">
        <thead><tr>
          <th>Rank</th>
          <th>Country</th>
          <th>${year} Sales</th>
          <th>Share</th>
          <th>vs ${prevYear ?? "—"}</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN UPDATE CYCLE
  // ─────────────────────────────────────────────────────────────────────────────

  function render() {
    const year = yearSelect ? Number(yearSelect.value) : 2030;
    const topN = topNSelect  ? Number(topNSelect.value) : DEFAULT_TOPN;
    const rows = topNForYear(year, topN);

    if (metaTitle) metaTitle.textContent = `Top ${topN} Countries`;
    if (metaSub)   metaSub.textContent   = `EV Sales · ${year}`;

    // First render: build SVG skeleton
    if (!svgRef) buildChart(rows);

    // Ensure highlighted is seeded (all visible countries on first run)
    if (!highlighted.length) highlighted = rows.map(d => d.country);

    updateChart(rows, year);
    buildChips(rows);
    buildStatCards(year, rows);
    buildTable(rows, year);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────────────────────

  async function main() {
    // Footer year
    const footEl = document.getElementById("year");
    if (footEl) footEl.textContent = String(new Date().getFullYear());

    // Load + structure data
    const flatRows = await loadData();
    allData = structureData(flatRows);

    // Populate year select
    const years = uniqueYears(flatRows);
    if (yearSelect) {
      yearSelect.innerHTML = "";
      years.forEach(y => {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        yearSelect.appendChild(opt);
      });
      yearSelect.value = String(years[years.length - 1]);
    }

    // Wire controls
    yearSelect?.addEventListener("change", () => { svgRef = null; highlighted = []; render(); });
    topNSelect?.addEventListener("change", () => { svgRef = null; highlighted = []; render(); });

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
