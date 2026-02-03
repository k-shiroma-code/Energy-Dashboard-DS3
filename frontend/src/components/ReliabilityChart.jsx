// src/components/ReliabilityChart.jsx
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function ReliabilityChart() {
  const svgRef = useRef();
  const [data, setData] = useState([]);

  // Load CSV data
  useEffect(() => {
    d3.csv('/data/energy_access_with_burden.csv').then(rawData => {
      const parsed = rawData
        .filter(d => d.year === '2024' && d.state && d.state.length === 2 && d.saidi && d.saidi !== '')
        .map(d => ({
          state: d.state,
          saidi: +d.saidi,
          saifi: +d.saifi,
          burden: +d.energy_burden_pct
        }))
        .filter(d => !isNaN(d.saidi))
        .sort((a, b) => b.saidi - a.saidi);
      
      setData(parsed);
    });
  }, []);

  // Draw chart
  useEffect(() => {
    if (data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 900;
    const height = 600;
    const margin = { top: 40, right: 40, bottom: 40, left: 60 };

    // Scales
    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.saidi) * 1.05])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.state))
      .range([margin.top, height - margin.bottom])
      .padding(0.2);

    // Color scale
    const colorScale = d => {
      if (d.saidi >= 200) return '#dc2626'; // red - poor
      if (d.saidi >= 100) return '#ea580c'; // orange - fair
      return '#22c55e'; // green - good
    };

    // Bars with animation
    svg.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('y', d => y(d.state))
      .attr('height', y.bandwidth())
      .attr('x', margin.left)
      .attr('width', 0)
      .attr('fill', d => colorScale(d))
      .attr('rx', 3)
      .transition()
      .duration(800)
      .delay((d, i) => i * 15)
      .attr('width', d => x(d.saidi) - margin.left);

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

    svg.selectAll('rect')
      .on('mouseover', (event, d) => {
        const rating = d.saidi >= 200 ? 'Poor' : d.saidi >= 100 ? 'Fair' : 'Good';
        tooltip
          .style('opacity', 1)
          .html(`
            <strong style="font-size: 14px;">${d.state}</strong><br/>
            <span style="color: #22c55e;">SAIDI: ${d.saidi.toFixed(1)} min/yr</span><br/>
            <span style="color: #9ca3af;">SAIFI: ${d.saifi.toFixed(2)} interruptions/yr</span><br/>
            <span style="color: #9ca3af;">Rating: ${rating}</span>
          `);
        d3.select(event.target).attr('opacity', 0.8);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        d3.select(event.target).attr('opacity', 1);
      });

    // Y Axis (States)
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .selectAll('text')
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .attr('font-family', 'Space Mono, monospace');

    svg.selectAll('.domain').attr('stroke', '#e5e7eb');
    svg.selectAll('.tick line').attr('stroke', '#e5e7eb');

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => d + ' min'))
      .selectAll('text')
      .attr('fill', '#6b7280')
      .attr('font-size', '11px');

    // Reference lines
    [100, 200].forEach(val => {
      if (val < d3.max(data, d => d.saidi)) {
        svg.append('line')
          .attr('x1', x(val))
          .attr('x2', x(val))
          .attr('y1', margin.top)
          .attr('y2', height - margin.bottom)
          .attr('stroke', '#9ca3af')
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.5);

        svg.append('text')
          .attr('x', x(val) + 5)
          .attr('y', margin.top + 15)
          .attr('fill', '#9ca3af')
          .attr('font-size', '10px')
          .text(val === 100 ? 'Fair' : 'Poor');
      }
    });

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${margin.top})`)
      .call(d3.axisTop(x)
        .ticks(6)
        .tickSize(-(height - margin.top - margin.bottom))
        .tickFormat('')
      )
      .selectAll('line')
      .attr('stroke', '#f1f5f3')
      .attr('stroke-dasharray', '2,2');

    svg.selectAll('.grid .domain').remove();

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1a1a1a')
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .attr('font-family', 'DM Sans, sans-serif')
      .text('Grid Reliability by State — SAIDI (2024)');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 180}, ${margin.top + 10})`);

    const legendData = [
      { color: '#dc2626', label: '≥ 200 min (Poor)' },
      { color: '#ea580c', label: '100-200 min (Fair)' },
      { color: '#22c55e', label: '< 100 min (Good)' }
    ];

    legendData.forEach((item, i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', i * 22)
        .attr('width', 14)
        .attr('height', 14)
        .attr('rx', 2)
        .attr('fill', item.color);

      legend.append('text')
        .attr('x', 22)
        .attr('y', i * 22 + 11)
        .attr('fill', '#6b7280')
        .attr('font-size', '11px')
        .attr('font-family', 'DM Sans, sans-serif')
        .text(item.label);
    });

    // Cleanup
    return () => tooltip.remove();
  }, [data]);

  return (
    <svg 
      ref={svgRef} 
      width={900} 
      height={600}
      style={{ width: '100%', maxWidth: '900px', height: 'auto' }}
    />
  );
}