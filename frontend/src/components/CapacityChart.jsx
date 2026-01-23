// src/components/CapacityChart.jsx
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function CapacityChart() {
  const svgRef = useRef();
  const [data, setData] = useState([]);

  // Load CSV data
  useEffect(() => {
    d3.csv('/data/merged_targets_clean.csv').then(rawData => {
      const parsed = rawData
        .filter(d => d.capacity_target_gw && d.capacity_target_gw !== '')
        .map(d => ({
          country_code: d.country_code,
          country_name: d.country_name,
          capacity: +d.capacity_target_gw
        }))
        .sort((a, b) => b.capacity - a.capacity)
        .slice(0, 15); // Top 15 countries
      
      setData(parsed);
    });
  }, []);

  // Draw chart
  useEffect(() => {
    if (data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 450;
    const margin = { top: 30, right: 30, bottom: 80, left: 80 };

    // Scales
    const x = d3.scaleBand()
      .domain(data.map(d => d.country_code))
      .range([margin.left, width - margin.right])
      .padding(0.25);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.capacity) * 1.1])
      .range([height - margin.bottom, margin.top]);

    // Bars with animation
    svg.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => x(d.country_code))
      .attr('width', x.bandwidth())
      .attr('y', height - margin.bottom)
      .attr('height', 0)
      .attr('fill', '#22c55e')
      .attr('rx', 4)
      .transition()
      .duration(800)
      .delay((d, i) => i * 50)
      .attr('y', d => y(d.capacity))
      .attr('height', d => height - margin.bottom - y(d.capacity));

    // Tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('background', '#1e3a2f')
      .style('color', '#f0fdf4')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '13px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('font-family', 'DM Sans, sans-serif');

    svg.selectAll('rect')
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`<strong>${d.country_name}</strong><br/>${d.capacity.toLocaleString()} GW`);
        d3.select(event.target).attr('fill', '#86efac');
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        d3.select(event.target).attr('fill', '#22c55e');
      });

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('fill', '#9ca3af')
      .attr('font-size', '11px')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end');

    svg.selectAll('.domain, .tick line').attr('stroke', '#1e3a2f');

    // Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + ' GW'))
      .selectAll('text')
      .attr('fill', '#9ca3af')
      .attr('font-size', '11px');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f0fdf4')
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .text('Top 15 Countries by 2030 Capacity Target');

    // Cleanup tooltip on unmount
    return () => tooltip.remove();
  }, [data]);

  return (
    <svg 
      ref={svgRef} 
      width={800} 
      height={450}
      style={{ width: '100%', maxWidth: '800px', height: 'auto' }}
    />
  );
}