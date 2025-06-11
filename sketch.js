// sketch.js
const svg = d3.select("#chart");
let allData = [];

// Tooltip div for hover
const tooltip = d3.select("body")
  .append("div")
  .attr("id", "tooltip")
  .style("position", "absolute")
  .style("background", "white")
  .style("padding", "5px")
  .style("border", "1px solid #333")
  .style("border-radius", "4px")
  .style("pointer-events", "none")
  .style("display", "none");

// Country list (15 countries)
const countriesList = [
  "Korea","Japan","United States","Canada","Finland",
  "Norway","Sweden","United Kingdom","France","Spain",
  "Czech","Hungary","Maxico","Chile","Australia"
];

// Load CSV (using only Korea data for debugging)
d3.csv("./superstition_idx_korea.csv", d3.autoType).then(data => {
  allData = data;
  initYearSelect();
  draw();
  window.addEventListener("resize", draw);
});

// Initialize year selection control
function initYearSelect() {
  const years = Array.from(new Set(allData.map(d => d.Year))).sort((a, b) => a - b);
  const container = d3.select("body")
    .insert("div", "svg#chart")
    .attr("id", "controls")
    .style("padding", "10px");

  container.append("label")
    .attr("for", "year-select")
    .text("Year: ");

  const select = container.append("select")
    .attr("id", "year-select")
    .on("change", draw);

  select.selectAll("option")
    .data(years)
    .join("option")
      .attr("value", d => d)
      .text(d => d);
}

// Main draw function: arranges circles in triangular layout
function draw() {
  const width = window.innerWidth;
  const controlsHeight = d3.select("#controls").node().getBoundingClientRect().height;
  const height = window.innerHeight - controlsHeight;

  svg.attr("width", width)
     .attr("height", height)
     .style("display", "block");

  const selectedYear = +d3.select("#year-select").property("value");
  const koreaEntry = allData.find(d => d.Year === selectedYear);
  const value = koreaEntry ? koreaEntry['Superstition Index'] : 0;

  // Build data: each country with the same index value
  let yearData = countriesList.map(country => ({
    Year: selectedYear,
    Country: country,
    'Superstition Index': value
  }));

  // Sort by index ascending, then country name
  yearData.sort((a, b) =>
    a['Superstition Index'] - b['Superstition Index'] ||
    a.Country.localeCompare(b.Country)
  );

  // Triangular layout: 1,2,3,4,5 rows (total 15)
  const maxRows = 5;
  const spacing = Math.min(width, height) / (maxRows + 1);
  const radius = spacing * 0.4;

  let idx = 0;
  const layoutData = [];
  for (let row = 1; row <= maxRows; row++) {
    const y = spacing * row;
    for (let i = 0; i < row; i++) {
      const d = yearData[idx++];
      d.x = width / 2 + (i - (row - 1) / 2) * spacing;
      d.y = y;
      layoutData.push(d);
    }
  }

  // Draw circles with tooltip on hover
  const circles = svg.selectAll(".country-circle").data(layoutData, d => d.Country);
  circles.join(
    enter => enter.append("circle")
      .attr("class", "country-circle")
      .attr("fill", "steelblue")
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("fill", "darkblue");
        tooltip.html(`Country: ${d.Country}<br/>Index: ${d['Superstition Index']}`)
               .style("left", (event.pageX + 10) + "px")
               .style("top",  (event.pageY + 10) + "px")
               .style("display", "block");
      })
      .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top",  (event.pageY + 10) + "px");
      })
      .on("mouseout", function() {
        d3.select(this).attr("fill", "steelblue");
        tooltip.style("display", "none");
      })
      .on("click", (event, d) => showPopup(d, width, height)),
    update => update,
    exit => exit.remove()
  )
  .attr("cx", d => d.x)
  .attr("cy", d => d.y)
  .attr("r",  radius);
}

// Popup: show time-series chart for Korea (debug data)
function showPopup(d, width, height) {
  svg.selectAll("#popup").remove();
  const popup = svg.append("g").attr("id", "popup").style("pointer-events", "all");

  // Overlay
  popup.append("rect")
    .attr("width",  width)
    .attr("height", height)
    .attr("fill",   "black")
    .attr("opacity",0.3)
    .on("click", () => popup.remove());

  // Panel dimensions (5/7 of view)
  const pw = width  * 5 / 7;
  const ph = height * 5 / 7;
  const px = (width  - pw) / 2;
  const py = (height - ph) / 2;

  // Panel background
  popup.append("rect")
    .attr("x", px)
    .attr("y", py)
    .attr("width",  pw)
    .attr("height", ph)
    .attr("fill",   "white")
    .attr("stroke", "#333")
    .attr("rx",     10)
    .attr("ry",     10);

  // Close button
  const closeSize = 24;
  popup.append("rect")
    .attr("x", px + pw - closeSize - 10)
    .attr("y", py + 10)
    .attr("width",  closeSize)
    .attr("height", closeSize)
    .attr("fill",   "#eee")
    .attr("stroke", "#333")
    .style("cursor", "pointer")
    .on("click", e => { e.stopPropagation(); popup.remove(); });

  popup.append("text")
    .attr("x", px + pw - closeSize/2 - 10)
    .attr("y", py + 10 + closeSize/2)
    .attr("text-anchor",       "middle")
    .attr("dominant-baseline","middle")
    .attr("font-size",        closeSize * 0.8)
    .attr("fill",             "#333")
    .style("cursor",          "pointer")
    .text('×')
    .on("click", e => { e.stopPropagation(); popup.remove(); });

  // Chart area
  const margin = { top: 40, right: 20, bottom: 40, left: 50 };
  const chartW = pw - margin.left - margin.right;
  const chartH = ph - margin.top - margin.bottom;
  const chartG = popup.append("g").attr("transform", `translate(${px + margin.left},${py + margin.top})`);

  // Use allData as series (Korea data)
  const series = allData;

  const xScale = d3.scaleLinear()
    .domain(d3.extent(series, e => e.Year))
    .range([0, chartW]);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(series, e => e['Superstition Index'])])
    .nice()
    .range([chartH, 0]);

  chartG.append("g")
    .attr("transform", `translate(0,${chartH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format("d")));

  chartG.append("g")
    .call(d3.axisLeft(yScale));

  const line = d3.line()
    .x(e => xScale(e.Year))
    .y(e => yScale(e['Superstition Index']));

  chartG.append("path")
    .datum(series)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line);
}

// Note: draw() is called after CSV load and on resize
