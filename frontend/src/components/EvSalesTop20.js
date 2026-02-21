import * as d3 from "d3";

export async function renderEvSalesTop20({
  container = "#chart-sales",
  dataUrl = "/data/ev_sales_by_country_year.json",
  initialYear = 2030
} = {}) {
  const root = d3.select(container);
  root.selectAll("*").remove();

  // ---- layout ----
  const width = 1100;
  const height = 560;
  const margin = { top: 50, right: 30, bottom: 140, left: 90 };

  // Controls
  const controls = root.append("div").attr("class", "controls");
  controls.append("label").text("Year: ").style("margin-right", "8px");
  const yearLabel = controls.append("span").attr("class", "year-label");

  const slider = controls
    .append("input")
    .attr("type", "range")
    .style("width", "420px")
    .style("margin-left", "12px");

  // SVG
  const svg = root
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const title = svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 28)
    .attr("font-size", 18)
    .attr("font-weight", 700)
    .text("Top 20 Countries: EV Sales");

  // Scales + axes
  const x = d3.scaleBand().padding(0.2).range([0, innerW]);
  const y = d3.scaleLinear().range([innerH, 0]);

  const xAxisG = g.append("g").attr("transform", `translate(0,${innerH})`);
  const yAxisG = g.append("g");

  // Tooltip
  const tip = root
    .append("div")
    .style("position", "fixed")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("padding", "8px 10px")
    .style("border-radius", "10px")
    .style("background", "rgba(0,0,0,0.75)")
    .style("color", "white")
    .style("font-size", "12px");

  // ---- load data ----
  const raw = await d3.json(dataUrl);

  raw.forEach(d => {
    d.year = +d.year;
    d.ev_sales = +d.ev_sales;
    d.country = String(d.country);
  });

  const years = Array.from(new Set(raw.map(d => d.year))).sort((a, b) => a - b);
  if (!years.length) {
    root.append("div").text("No data found. Check JSON path and content.");
    return;
  }

  const defaultYear = years.includes(initialYear) ? initialYear : years[0];
  slider.attr("min", years[0]).attr("max", years[years.length - 1]).attr("step", 1).attr("value", defaultYear);

  function top20ForYear(year) {
    return raw
      .filter(d => d.year === year)
      .sort((a, b) => d3.descending(a.ev_sales, b.ev_sales))
      .slice(0, 20);
  }

  function update(year) {
    yearLabel.text(year);
    title.text(`Top 20 Countries: EV Sales (${year})`);

    const data = top20ForYear(year);

    x.domain(data.map(d => d.country));
    y.domain([0, d3.max(data, d => d.ev_sales) || 0]).nice();

    const t = svg.transition().duration(650);

    xAxisG
      .transition(t)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-0.6em")
      .attr("dy", "0.15em");

    yAxisG
      .transition(t)
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".2s")));

    const bars = g.selectAll("rect.bar").data(data, d => d.country);

    bars
      .exit()
      .transition(t)
      .attr("y", y(0))
      .attr("height", innerH - y(0))
      .style("opacity", 0)
      .remove();

    const barsEnter = bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.country))
      .attr("width", x.bandwidth())
      .attr("y", y(0))
      .attr("height", innerH - y(0))
      .style("opacity", 0.9);

    barsEnter
      .merge(bars)
      .on("mousemove", (event, d) => {
        tip
          .style("left", `${event.clientX + 12}px`)
          .style("top", `${event.clientY + 12}px`)
          .style("opacity", 1)
          .html(`<div style="font-weight:700">${d.country}</div><div>EV sales: ${d3.format(",")(d.ev_sales)}</div>`);
      })
      .on("mouseleave", () => tip.style("opacity", 0))
      .transition(t)
      .attr("x", d => x(d.country))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d.ev_sales))
      .attr("height", d => innerH - y(d.ev_sales));
  }

  update(defaultYear);

  slider.on("input", function () {
    update(+this.value);
  });
}
