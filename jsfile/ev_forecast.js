const margin = {top: 50, right: 80, bottom: 60, left: 90};
const width = 1000 - margin.left - margin.right;
const height = 550 - margin.top - margin.bottom;

const svg = d3.select("svg")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

d3.json("ev_forecast.json").then(data => {

    data.forEach(d => {
        d.year = +d.year;
        d.ev_sales = +d.ev_sales;
    });

    const countries = Array.from(new Set(data.map(d => d.region_country))).sort();

    // x axis
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);

    // y axis (dynamic rescaling)
    const y = d3.scaleLinear().range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(countries)
        .range(d3.schemeTableau10);

   
    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.ev_sales));

    // initial axis render
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    const yAxisGroup = svg.append("g").attr("class", "y-axis");

    // vertical separator at 2024
    svg.append("line")
        .attr("x1", x(2024)).attr("x2", x(2024))
        .attr("y1", 0).attr("y2", height)
        .attr("stroke", "black").attr("stroke-dasharray", "4");

    const grouped = d3.group(data, d => d.region_country);

    //  container for lines 
    const countryGroups = svg.selectAll(".country")
        .data(grouped)
        .enter()
        .append("g")
        .attr("class", "country");

    // function to update the chart 
    function updateChart(selected) {
        // calculate new Y domain
        const filteredData = selected === "All" ? data : data.filter(d => d.region_country === selected);
        const maxSales = d3.max(filteredData, d => d.ev_sales);
        
        y.domain([0, maxSales]).nice();

        // update Y Axis with transition
        yAxisGroup.transition().duration(750).call(d3.axisLeft(y).tickFormat(d3.format(",")));

        // update paths for each country
        countryGroups.each(function([country, values]) {
            const isVisible = (selected === "All" || selected === country);
            const group = d3.select(this);
            
            group.style("display", isVisible ? null : "none");

            if (isVisible) {
                const actual = values.filter(d => d.type === "Actual").sort((a,b) => a.year - b.year);
                const forecast = values.filter(d => d.type === "Forecast").sort((a,b) => a.year - b.year);

                // check if paths exist, if not create them
                let pathActual = group.select(".path-actual");
                if (pathActual.empty()) {
                    pathActual = group.append("path").attr("class", "path-actual").attr("fill", "none").attr("stroke-width", 2);
                    group.append("path").attr("class", "path-forecast").attr("fill", "none").attr("stroke-width", 2).attr("stroke-dasharray", "5,5");
                }

                group.select(".path-actual")
                    .datum(actual)
                    .transition().duration(750)
                    .attr("stroke", color(country))
                    .attr("d", line);

                group.select(".path-forecast")
                    .datum(forecast)
                    .transition().duration(750)
                    .attr("stroke", color(country))
                    .attr("d", line);
            }
        });
    }

    // dropdown 
    const dropdown = d3.select("#dropdown");
    dropdown.append("option").attr("value", "All").text("Show All Countries");
    countries.forEach(c => dropdown.append("option").attr("value", c).text(c));

    dropdown.on("change", function() {
        const selected = this.value;
        d3.select("#title").text(selected === "All" ? "EV Sales Forecast — All Countries" : `EV Sales Forecast — ${selected}`);
        updateChart(selected);
    });

    // tooltip
    const tooltip = d3.select("#tooltip");
    const focusLine = svg.append("line").attr("stroke", "black").attr("stroke-dasharray", "4").attr("y1", 0).attr("y2", height).style("opacity", 0);

    const overlay = svg.append("rect")
        .attr("width", width).attr("height", height)
        .style("fill", "none").style("pointer-events", "all");

    overlay.on("mousemove", function(event) {
        const selected = dropdown.property("value");
        const [mx] = d3.pointer(event);
        const hoveredYear = Math.round(x.invert(mx));

        focusLine.attr("x1", x(hoveredYear)).attr("x2", x(hoveredYear)).style("opacity", 1);

        // filter data for tooltip based on current selection
        const yearData = data.filter(d => d.year === hoveredYear && (selected === "All" || d.region_country === selected));

        if (yearData.length === 0) return;
        yearData.sort((a,b) => b.ev_sales - a.ev_sales);

        tooltip.html(
            `<strong>Year: ${hoveredYear}</strong><br>` +
            yearData.map(d =>
                `<span style="color:${color(d.region_country)}">● ${d.region_country}</span>: ${d3.format(",")(Math.round(d.ev_sales))}`
            ).join("<br>")
        )
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 20) + "px")
        .style("opacity", 1);
    })
    .on("mouseout", () => {
        focusLine.style("opacity", 0);
        tooltip.style("opacity", 0);
    });

    // run initial state
    updateChart("All");
});