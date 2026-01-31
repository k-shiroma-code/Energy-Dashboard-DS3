// src/components/BurdenVsPriceChart.jsx
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function BurdenVsPriceChart() {
  const svgRef = useRef();
  const [data, setData] = useState([]);

  // Load CSV data
  useEffect(() => {
    d3.csv('/data/energy_access_with_burden.csv').then(rawData => {
      const parsed = rawData
        .filter(d => d.year === '2024' && d.state && d.state.length === 2 && d.energy_burden_pct && d.avg_price_cents_kwh)
        .map(d => ({
          state: d.state,
          burden: +d.energy_burden_pct,
          price: +d.avg_price_cents_kwh,
          income: +d.median_income_2024,
          bill: +d.est_annual_bill,
          customers: +d.avg_customers || 1000000
        }))
        .filter(d => !isNaN(d.burden) && !isNaN(d.price));
      
      setData(parsed);
    });
  }, []);

  // Draw chart
  useEffect(() => {
    if (data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 900;
    const height = 550;
    const margin = { top: 50, right: 120, bottom: 60, left: 70 };

    // Scales
    const x = d3.scaleLinear()
      .domain([10, d3.max(data, d => d.price) * 1.05])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([1, d3.max(data, d => d.burden) * 1.05])
      .range([height - margin.bottom, margin.top]);

    const size = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.customers)])
      .range([5, 25]);

    // Color by income quartile
    const incomeExtent = d3.extent(data, d => d.income);
    const colorScale = d3.scaleSequential()
      .domain([incomeExtent[1], incomeExtent[0]]) // Reverse: low income = red
      .interpolator(d3.interpolateRdYlGn);

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x)
        .ticks(8)
        .tickSize(-(height - margin.top - margin.bottom))
        .tickFormat('')
      )
      .selectAll('line')
      .attr('stroke', '#f1f5f3');

    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)
        .ticks(6)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat('')
      )
      .selectAll('line')
      .attr('stroke', '#f1f5f3');

    svg.selectAll('.grid .domain').remove();

    // Tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('background', '#1a1a1a')
      .style('color', '#ffffff')
      .style('padding', '12px 16px')
      .style('border-radius', '8px')
      .style('font-size', '13px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('font-family', 'DM Sans, sans-serif')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('z-index', '1000');

    // Circles with animation
    svg.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => x(d.price))
      .attr('cy', d => y(d.burden))
      .attr('r', 0)
      .attr('fill', d => colorScale(d.income))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.85)
      .transition()
      .duration(800)
      .delay((d, i) => i * 20)
      .attr('r', d => size(d.customers));

    // Interactions
    svg.selectAll('circle')
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`
            <strong style="font-size: 15px;">${d.state}</strong><br/>
            <span style="color: #22c55e;">Burden: ${d.burden.toFixed(2)}%</span><br/>
            <span style="color: #60a5fa;">Price: ${d.price.toFixed(1)}¢/kWh</span><br/>
            <span style="color: #9ca3af;">Income: $${d.income.toLocaleString()}</span><br/>
            <span style="color: #9ca3af;">Annual Bill: $${d.bill.toLocaleString()}</span>
          `);
        d3.select(event.target)
          .attr('stroke', '#1a1a1a')
          .attr('stroke-width', 2.5)
          .attr('opacity', 1);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        d3.select(event.target)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.85);
      });

    // State labels for outliers
    const outliers = data.filter(d => 
      d.burden > 2.8 || d.price > 35 || d.burden < 1.3
    );

    svg.selectAll('.label')
      .data(outliers)
      .join('text')
      .attr('class', 'label')
      .attr('x', d => x(d.price) + size(d.customers) + 4)
      .attr('y', d => y(d.burden) + 4)
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .attr('font-family', 'Space Mono, monospace')
      .text(d => d.state);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => d + '¢'))
      .selectAll('text')
      .attr('fill', '#6b7280')
      .attr('font-size', '11px');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '12px')
      .text('Average Electricity Price (¢/kWh)');

    // Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + '%'))
      .selectAll('text')
      .attr('fill', '#6b7280')
      .attr('font-size', '11px');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(height / 2))
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '12px')
      .text('Energy Burden (% of Income)');

    svg.selectAll('.domain').attr('stroke', '#e5e7eb');
    svg.selectAll('.tick line').attr('stroke', '#e5e7eb');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1a1a1a')
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .attr('font-family', 'DM Sans, sans-serif')
      .text('Electricity Price vs. Energy Burden (2024)');

    // Color Legend
    const legendWidth = 15;
    const legendHeight = 150;
    const legendX = width - 100;
    const legendY = margin.top + 30;

    // Gradient definition
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'income-gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', d3.interpolateRdYlGn(1));

    gradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', d3.interpolateRdYlGn(0.5));

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', d3.interpolateRdYlGn(0));

    svg.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('rx', 3)
      .style('fill', 'url(#income-gradient)');

    svg.append('text')
      .attr('x', legendX + legendWidth + 8)
      .attr('y', legendY + 10)
      .attr('fill', '#6b7280')
      .attr('font-size', '10px')
      .text('High Income');

    svg.append('text')
      .attr('x', legendX + legendWidth + 8)
      .attr('y', legendY + legendHeight)
      .attr('fill', '#6b7280')
      .attr('font-size', '10px')
      .text('Low Income');

    svg.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', legendY - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text('Income');

    // Size legend
    svg.append('text')
      .attr('x', legendX)
      .attr('y', legendY + legendHeight + 35)
      .attr('fill', '#6b7280')
      .attr('font-size', '10px')
      .text('Size = Customers');

    // Cleanup
    return () => tooltip.remove();
  }, [data]);

  return (
    <svg 
      ref={svgRef} 
      width={900} 
      height={550}
      style={{ width: '100%', maxWidth: '900px', height: 'auto' }}
    />
  );
}