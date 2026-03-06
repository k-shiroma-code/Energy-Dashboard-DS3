import { useState, useEffect } from "react";
import * as d3 from "d3";

// ── Color palette for up to 10 countries ──────────────────────────────────────
const COLORS = [
  "#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed",
  "#0891b2", "#be185d", "#059669", "#b45309", "#6366f1",
];

// ── SVG chart dimensions ───────────────────────────────────────────────────────
const W   = 860;
const H   = 400;
const PAD = { top: 24, right: 32, bottom: 52, left: 72 };
const CW  = W - PAD.left - PAD.right;
const CH  = H - PAD.top  - PAD.bottom;

// ── Scale helpers ─────────────────────────────────────────────────────────────
function makeScales(selected) {
  const allPts = selected.flatMap(d => [
    ...d.history,
    ...d.forecast,
    ...d.conf_int.map(p => ({ year: p.year, value: p.upper })),
  ]);
  if (!allPts.length) return { xScale: () => 0, yScale: () => 0, xMin: 2010, xMax: 2030, yMax: 5000 };

  const xMin = Math.min(...allPts.map(p => p.year));
  const xMax = Math.max(...allPts.map(p => p.year));
  const yMax = Math.max(...allPts.map(p => p.value)) * 1.12;

  return {
    xScale: y => ((y - xMin) / (xMax - xMin)) * CW,
    yScale: v => CH - (v / yMax) * CH,
    xMin, xMax, yMax,
  };
}

function toPath(pts, xScale, yScale) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.year).toFixed(1)} ${yScale(p.value).toFixed(1)}`).join(" ");
}

function niceYTicks(yMax, n = 6) {
  const step = Math.ceil(yMax / n / 500) * 500;
  const ticks = [];
  for (let v = 0; v <= yMax + step; v += step) ticks.push(v);
  return ticks;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Oil() {
  const [data,    setData]    = useState([]);
  const [active,  setActive]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [hovered, setHovered] = useState(null);

  // ── Load CSV data ──────────────────────────────────────────────────────────
useEffect(() => {
  d3.csv('/data/oil_forecast.csv').then(rawData => {
    const countries = [...new Set(rawData.map(d => d.country))];

    const parsed = countries.map((country, i) => {
      const rows  = rawData.filter(d => d.country === country);
      const first = rows[0];
      return {
        country,
        color:    COLORS[i % COLORS.length],
        mape:     first.mape !== "" ? +first.mape : null,
        order:    first.order || null,
        history:  rows.filter(d => d.type === "history" && +d.year >= 2000)
                      .map(d => ({ year: +d.year, value: +d.value })),
        forecast: rows.filter(d => d.type === "forecast")
                      .map(d => ({ year: +d.year, value: +d.value })),
        conf_int: rows.filter(d => d.type === "forecast")
                      .map(d => ({ year: +d.year, lower: +d.lower, upper: +d.upper })),
      };
    });

    setData(parsed);
    setActive(parsed.map(d => d.country));
    setLoading(false);
  }).catch(() => {
    setError(true);
    setLoading(false);
  });
}, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selected   = data.filter(d => active.includes(d.country));
  const lastFcYear = data[0]?.forecast.at(-1)?.year ?? 2030;
  const total2023  = data.reduce((s, d) => s + (d.history.at(-1)?.value ?? 0), 0);
  const topCountry = data[0];
  const avgChange  = data.length
    ? data.reduce((s, d) => {
        const act = d.history.at(-1)?.value ?? 0;
        const fc  = d.forecast.at(-1)?.value ?? 0;
        return s + (act ? ((fc - act) / act) * 100 : 0);
      }, 0) / data.length
    : 0;

  // ── Chip toggle ────────────────────────────────────────────────────────────
  const toggle = country =>
    setActive(prev =>
      prev.includes(country)
        ? prev.length > 1 ? prev.filter(c => c !== country) : prev
        : [...prev, country]
    );

  // ── Chart scales ───────────────────────────────────────────────────────────
  const { xScale, yScale, xMin, xMax } = makeScales(selected);
  const yTicks = niceYTicks(makeScales(selected).yMax);
  const xTicks = [];
  for (let y = xMin; y <= xMax; y += 2) xTicks.push(y);

  // ── Mouse hover ────────────────────────────────────────────────────────────
  const handleMouseMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx   = e.clientX - rect.left - PAD.left;
    const year = Math.round((xMax - xMin) * (mx / CW) + xMin);

    if (year < xMin || year > xMax) { setHovered(null); return; }

    const points = selected.map(d => {
      const hp = d.history.find(p => p.year === year);
      const fp = d.forecast.find(p => p.year === year);
      return { country: d.country, color: d.color, hist: hp, fc: fp };
    }).filter(p => p.hist || p.fc);

    setHovered({ x: xScale(year), year, points });
  };

  // ── MAPE badge ─────────────────────────────────────────────────────────────
  const mapeBadge = v =>
    v == null ? "" : v < 5 ? "mape-good" : v < 10 ? "mape-ok" : "mape-weak";

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) return <div className="oil-empty" style={{ padding: 80, textAlign: "center" }}>Loading…</div>;
  if (error)   return <div className="oil-empty" style={{ padding: 80, textAlign: "center" }}>⚠ Could not load oil_forecast.csv — make sure it is in /public/data</div>;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 48px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 40 }}>
        <p className="oil-label">Commodities · Log-ARIMA Forecast</p>
        <h1 className="oil-title">Refined Oil Imports</h1>
        <p className="oil-subtitle">
          Top 10 global importers tracked from historical IEA data through{" "}
          <strong>{lastFcYear} forecast</strong>. Log-ARIMA models selected by
          minimum AIC across a (p, d, q) grid search.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="oil-stats">
        <div className="oil-stat-card">
          <p className="oil-stat-label">Total 2023 Imports (Top 10)</p>
          <p className="oil-stat-value">{Math.round(total2023).toLocaleString()}</p>
          <p className="oil-stat-sub">KBD combined</p>
        </div>
        <div className="oil-stat-card">
          <p className="oil-stat-label">Largest Importer · 2023</p>
          <p className="oil-stat-value" style={{ fontSize: "1.4rem" }}>
            {topCountry?.country ?? "—"}
          </p>
          <p className="oil-stat-sub">
            {Math.round(topCountry?.history.at(-1)?.value ?? 0).toLocaleString()} KBD
          </p>
        </div>
        <div className="oil-stat-card">
          <p className="oil-stat-label">Avg Forecast Change to {lastFcYear}</p>
          <p className="oil-stat-value" style={{ color: avgChange >= 0 ? "#16a34a" : "#ef4444" }}>
            {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(1)}%
          </p>
          <p className={`oil-stat-sub ${avgChange >= 2 ? "change-up" : avgChange <= -2 ? "change-down" : "change-flat"}`}>
            {avgChange >= 2 ? "↑ Growing demand" : avgChange <= -2 ? "↓ Declining demand" : "→ Stable demand"}
          </p>
        </div>
        <div className="oil-stat-card">
          <p className="oil-stat-label">Countries Monitored</p>
          <p className="oil-stat-value">{data.length}</p>
          <p className="oil-stat-sub">{active.length} currently selected</p>
        </div>
      </div>

      {/* ── Country chips ── */}
      <div className="oil-controls">
        <button className="oil-ctrl-btn" onClick={() => setActive(data.map(d => d.country))}>All</button>
        <button className="oil-ctrl-btn" onClick={() => data[0] && setActive([data[0].country])}>Clear</button>
      </div>

      <div className="oil-chips">
        {data.map(d => (
          <button
            key={d.country}
            className={`oil-chip ${active.includes(d.country) ? "active" : ""}`}
            style={{ "--chip-color": d.color }}
            onClick={() => toggle(d.country)}
          >
            <span className="oil-chip-dot" style={{ background: d.color }} />
            {d.country}
          </button>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="oil-chart-box">
        <p className="oil-section-label">Historical + Forecast (KBD)</p>
        <div style={{ overflowX: "auto", position: "relative" }}>
          <svg
            width={W} height={H}
            style={{ display: "block", margin: "0 auto", cursor: "crosshair" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <g transform={`translate(${PAD.left},${PAD.top})`}>

              {/* Y grid */}
              {yTicks.map(v => (
                <line key={v} x1={0} x2={CW} y1={yScale(v)} y2={yScale(v)}
                  stroke="#e5e7eb" strokeDasharray="4,3" strokeWidth={1} />
              ))}

              {/* Forecast divider */}
              <line x1={xScale(2024)} x2={xScale(2024)} y1={0} y2={CH}
                stroke="#d1d5db" strokeDasharray="6,3" strokeWidth={1.5} />
              <text x={xScale(2024) + 6} y={14}
                fill="#9ca3af" fontSize={10} fontFamily="Space Mono, monospace">
                Forecast →
              </text>

              {/* CI bands */}
              {selected.map(d => {
                if (!d.conf_int.length) return null;
                const upper = d.conf_int.map(p => `${xScale(p.year).toFixed(1)},${yScale(p.upper).toFixed(1)}`).join(" L ");
                const lower = [...d.conf_int].reverse().map(p => `${xScale(p.year).toFixed(1)},${yScale(p.lower).toFixed(1)}`).join(" L ");
                return (
                  <path key={`ci-${d.country}`}
                    d={`M ${upper} L ${lower} Z`}
                    fill={d.color} opacity={0.09} />
                );
              })}

              {/* Historical lines */}
              {selected.map(d => (
                <path key={`hist-${d.country}`}
                  d={toPath(d.history, xScale, yScale)}
                  fill="none" stroke={d.color} strokeWidth={2.5}
                  strokeLinecap="round" strokeLinejoin="round" />
              ))}

              {/* Forecast lines */}
              {selected.map(d => {
                const fcConn = [d.history.at(-1), ...d.forecast].filter(Boolean);
                return (
                  <path key={`fc-${d.country}`}
                    d={toPath(fcConn, xScale, yScale)}
                    fill="none" stroke={d.color} strokeWidth={2.5}
                    strokeDasharray="7,4"
                    strokeLinecap="round" strokeLinejoin="round" />
                );
              })}

              {/* End-of-forecast dots */}
              {selected.map(d => {
                const last = d.forecast.at(-1);
                return last ? (
                  <circle key={`dot-${d.country}`}
                    cx={xScale(last.year)} cy={yScale(last.value)}
                    r={4} fill={d.color} stroke="#fff" strokeWidth={2} />
                ) : null;
              })}

              {/* Hover crosshair */}
              {hovered && (
                <line x1={hovered.x} x2={hovered.x} y1={0} y2={CH}
                  stroke="#9ca3af" strokeWidth={1} strokeDasharray="4,3" />
              )}

              {/* X axis */}
              <line x1={0} x2={CW} y1={CH} y2={CH} stroke="#e5e7eb" strokeWidth={1} />
              {xTicks.map(y => (
                <g key={y}>
                  <line x1={xScale(y)} x2={xScale(y)} y1={CH} y2={CH + 5} stroke="#d1d5db" />
                  <text x={xScale(y)} y={CH + 19} textAnchor="middle"
                    fill="#9ca3af" fontSize={11} fontFamily="Space Mono, monospace">{y}</text>
                </g>
              ))}

              {/* Y axis */}
              <line x1={0} x2={0} y1={0} y2={CH} stroke="#e5e7eb" strokeWidth={1} />
              {yTicks.map(v => (
                <text key={v} x={-10} y={yScale(v) + 4} textAnchor="end"
                  fill="#9ca3af" fontSize={11} fontFamily="Space Mono, monospace">
                  {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
                </text>
              ))}

              {/* Axis labels */}
              <text x={CW / 2} y={CH + 46} textAnchor="middle"
                fill="#6b7280" fontSize={12} fontFamily="DM Sans, sans-serif">Year</text>
              <text transform={`translate(-56,${CH / 2}) rotate(-90)`}
                textAnchor="middle" fill="#6b7280" fontSize={12} fontFamily="DM Sans, sans-serif">
                Imports (KBD)
              </text>

            </g>
          </svg>

          {/* Hover tooltip */}
          {hovered && hovered.points.length > 0 && (
            <div style={{
              position: "absolute", top: PAD.top + 8,
              left: Math.min(PAD.left + hovered.x + 14, W - 160),
              background: "rgba(26,26,26,0.88)", color: "#fff",
              borderRadius: 8, padding: "10px 14px", fontSize: 12,
              lineHeight: 1.8, pointerEvents: "none", minWidth: 140,
              fontFamily: "DM Sans, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
                {hovered.year}
              </div>
              {hovered.points.map(p => (
                <div key={p.country} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <span style={{ color: "#d1d5db" }}>{p.country}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "Space Mono, monospace", fontSize: 11 }}>
                    {Math.round((p.fc ?? p.hist)?.value ?? 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16, fontSize: 12, color: "#6b7280" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width={28} height={4}><line x1={0} x2={28} y1={2} y2={2} stroke="#6b7280" strokeWidth={2.5} /></svg>
              Historical
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width={28} height={4}><line x1={0} x2={28} y1={2} y2={2} stroke="#6b7280" strokeWidth={2.5} strokeDasharray="7,4" /></svg>
              Forecast
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 28, height: 10, background: "#6b7280", opacity: 0.15, borderRadius: 3 }} />
              95% CI
            </div>
          </div>
        </div>
      </div>

      {/* ── Forecast table ── */}
      <div className="oil-table-box">
        <p className="oil-section-label">Forecast Summary — 2023 → {lastFcYear}</p>
        <table className="oil-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>2023 Actual</th>
              <th>{lastFcYear} Forecast</th>
              <th>Change</th>
              {data.some(d => d.mape != null) && <th>MAPE</th>}
              {data.some(d => d.order != null) && <th>ARIMA Order</th>}
            </tr>
          </thead>
          <tbody>
            {data.map(d => {
              const actual = d.history.at(-1)?.value ?? 0;
              const fc     = d.forecast.at(-1)?.value ?? 0;
              const pct    = actual ? ((fc - actual) / actual) * 100 : 0;
              return (
                <tr key={d.country}>
                  <td>
                    <div className="oil-td-country">
                      <span className="oil-td-dot" style={{ background: d.color }} />
                      {d.country}
                    </div>
                  </td>
                  <td className="oil-td-mono">{Math.round(actual).toLocaleString()} KBD</td>
                  <td className="oil-td-mono">{Math.round(fc).toLocaleString()} KBD</td>
                  <td>
                    <span className={pct >= 2 ? "change-up" : pct <= -2 ? "change-down" : "change-flat"}>
                      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                    </span>
                  </td>
                  {data.some(d2 => d2.mape != null) && (
                    <td>
                      {d.mape != null
                        ? <span className={`oil-mape-badge ${mapeBadge(d.mape)}`}>{d.mape.toFixed(1)}%</span>
                        : <span className="oil-td-mono">—</span>}
                    </td>
                  )}
                  {data.some(d2 => d2.order != null) && (
                    <td className="oil-td-mono">{d.order ?? "—"}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="oil-footnote">
        Source: JODI Oil World Database · Log-ARIMA models selected via AIC grid search ·
        Forecast horizon: 2024–{lastFcYear}
      </p>
    </div>
  );
}