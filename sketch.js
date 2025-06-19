// sketch.js
// Requires D3 v7 and SheetJS loaded globally:
// <script src="https://d3js.org/d3.v7.min.js"></script>
// <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>

const svg = d3.select("#chart")
  .style("font-family", "Pretendard");
let excelByCountry = {};
let csvByCountry = {};

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
  .style("font-family", "Pretendard")
  .style("display", "none");

// Country list (15 countries)
const countriesList = [
  "Korea","Japan","US","Canada","Finland",
  "Norway","Sweden","UK","France","Spain",
  "Czech","Hungary","Mexico","Chile","Australia"
];

// Continent mapping for file paths
const continentMap = { Korea:"Asia", Japan:"Asia", US:"NorthAmerica", Canada:"NorthAmerica",
  Finland:"Europe", Norway:"Europe", Sweden:"Europe", UK:"Europe",
  France:"Europe", Spain:"Europe", Czech:"Europe", Hungary:"Europe",
  Mexico:"SouthAmerica", Chile:"SouthAmerica", Australia:"Oceania" };

// Olympic ring colors by continent
const ringColors = {
  Europe: '#0085C7',
  Asia: '#F4C300',
  Africa: '#000000',
  Oceania: '#009F3D',
  NorthAmerica: '#DF0024',
  SouthAmerica: '#DF0024'
};

const flagColors = {
  Korea:     'red',        // 빨강
  Japan:     'orange',     // 주황
  US:        'yellow',     // 노랑
  Canada:    'green',      // 초록
  Finland:   'blue',       // 파랑
  Norway:    'navy',       // 남색
  Sweden:    'purple',     // 보라
  UK:        'brown',      // 갈색
  France:    'lightgreen', // 연두색
  Spain:     'pink',       // 분홍색
  Czech:     'skyblue',    // 하늘색
  Hungary:   '#5CFFD1',  // 민트색
  Mexico:    'magenta',    // 자주색
  Chile:     'gray',       // 회색
  Australia: '#FBCEB1'     // 살구색
};

// Load Excel data for a country
function loadExcel(country) {
  const cont = continentMap[country];
  const path = `./extracted/${encodeURIComponent(country)}/${encodeURIComponent(cont + '_' + country)}.xlsx`;
  return fetch(path)
    .then(res => { if (!res.ok) throw new Error('No XLSX'); return res.arrayBuffer(); })
    .then(ab => {
      const wb = XLSX.read(ab, { type: 'array' });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1 });
      const header = raw[0];
      const data = [];
      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        const seriesName = row[0];
        for (let j = 1; j < header.length; j++) {
          data.push({ Year: +header[j], 'Superstition Index': row[j], Series: seriesName });
        }
      }
      excelByCountry[country] = data;
    })
    .catch(() => { excelByCountry[country] = []; });
}

// Load CSV data for a country
async function loadCSV(country) {
  const path = `./extracted/${encodeURIComponent(country)}/${encodeURIComponent(country + '_Superstition_Index.csv')}`;
  return d3.csv(path, d3.autoType)
    .then(data => { csvByCountry[country] = data.map(d => ({ Year: d.Year, 'Superstition Index': d['Superstition Index'], Series: country })); })
    .catch(() => { csvByCountry[country] = []; });
}

// Load all data then draw
Promise.all(
  countriesList.map(country => Promise.all([ loadExcel(country), loadCSV(country) ]))
)
.then(() => {
  draw();
  window.addEventListener('resize', draw);
})
.catch(err => console.error('Data load error:', err));

function draw() {
  const width = window.innerWidth, height = window.innerHeight;
  svg.attr('width', width).attr('height', height);
  const year = 2022;

  const layoutData = countriesList.map(country => {
    const vals = (csvByCountry[country] || [])
      .filter(d => d.Year === year)
      .map(d => d['Superstition Index']);
    return { country, value: d3.max(vals) || 0 };
  }).sort((a,b) => a.value - b.value || a.country.localeCompare(b.country));

  const rows = 5, spacing = Math.min(width, height)/(rows+1);
  const offset = r => (r-1)*spacing/2;
  layoutData.forEach(d => { delete d.x; delete d.y; });
  let idx = 0;
  for (let r = 1; r <= rows; r++) {
    for (let i = 0; i < r; i++) {
      layoutData[idx].x = width/2 + i*spacing - offset(r);
      layoutData[idx].y = spacing*r;
      idx++;
    }
  }

  const seriesLen = csvByCountry[countriesList[0]]?.length || 0;
  const allMax = d3.max(countriesList, c => d3.max(csvByCountry[c]||[], e=>e['Superstition Index'])) || 1;
  const rScale = d3.scaleLinear().domain([0, allMax]).range([0, spacing*0.4]);
  const aStep = 2*Math.PI/seriesLen;

  svg.selectAll('.radial-line').remove();

  const polys = svg.selectAll('.country-poly').data(layoutData, d=>d.country);
  polys.join(
    enter => enter.append('path').attr('class','country-poly')
      .style('fill', d => flagColors[d.country]).style('fill-opacity',1.0)
      // Outline stroke is the complementary color of the fill
      .style('stroke','none')
      .style('stroke-width', 1)
      .style('cursor','pointer')
      .on('mouseover',function(e,d){
        // On hover, make stroke slightly thicker but keep the complement color
        const base = d3.color(flagColors[d.country]);
        const comp = d3.rgb(255 - base.r, 255 - base.g, 255 - base.b);
        d3.select(this).style('stroke', comp).style('stroke-width', 2);
        const R = svg.node().getBoundingClientRect();
        tooltip.html(`Index(2022): ${d.value}`)
               .style('left',`${R.left+d.x+50}px`).style('top',`${R.top+d.y-10}px`).style('display','block');
      })
      .on('mouseout', function(e,d){ d3.select(this).style('stroke', 'none'); tooltip.style('display','none'); })
      .on('click',(e,d)=>showPopup(d, width, height)),
    update=>update, exit=>exit.remove()
  )
  .attr('d', d => {
    const data = csvByCountry[d.country]||[];
    const pts = data.map((e,i) => {
      const r = rScale(e['Superstition Index']), ang = aStep*i - Math.PI/2;
      return [d.x + r*Math.cos(ang), d.y + r*Math.sin(ang)];
    });
    // Add center point to close the polygon to the center
    pts.push([d.x, d.y]);
    // Use closed curve to draw the polygon including center
    return d3.line().curve(d3.curveLinearClosed)(pts);
  });
  // 버튼 바로 아래에 나라 이름 표시
  svg.selectAll('.country-label')
  .data(layoutData, d => d.country)
  .join('text')
    .attr('class', 'country-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y + rScale(d.value) + 25)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text(d => d.country);

  layoutData.forEach(d => {
    const data = csvByCountry[d.country]||[];
    data.forEach((e,i)=>{
      const r=rScale(e['Superstition Index']), ang=aStep*i - Math.PI/2;
      svg.append('line')
        .attr('class','radial-line')
        .attr('x1',d.x).attr('y1',d.y)
        .attr('x2',d.x + r*Math.cos(ang))
        .attr('y2',d.y + r*Math.sin(ang))
        .attr('stroke', () => {
          if (d.country === 'Chile') return 'black';
          const c = d3.color(flagColors[d.country]);
          return d3.rgb(255 - c.r, 255 - c.g, 255 - c.b);
        });
    });
  });
  // 각 꼭짓점에 해당 연도 표시
  layoutData.forEach(d => {
    const data = csvByCountry[d.country] || [];
    data.forEach((e,i) => {
      const r   = rScale(e['Superstition Index']);
      const ang = aStep * i - Math.PI/2;
      const lx  = d.x + (r + 10) * Math.cos(ang);
      const ly  = d.y + (r + 10) * Math.sin(ang);
      svg.append('text')
        .attr('class', 'year-label')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', 'middle')
        .style('font-size', '8px')
        .text(e.Year);
    });
  });
}

function showPopup(d, width, height) {
  svg.selectAll('#popup').remove();
  const popup = svg.append('g').attr('id','popup').style('pointer-events','all');
  // Overlay
  popup.append('rect').attr('width',width).attr('height',height)
    .attr('fill','black').attr('opacity',.3).on('click',()=>popup.remove());
  // Panel dims: increased width
  const pw = width * 5/6;
  const ph = height * 5/7;
  const px = (width - pw)/2;
  const py = (height - ph)/2;
  const pad = pw * 1/12;
  // Panel background
  popup.append('rect').attr('x',px).attr('y',py).attr('width',pw).attr('height',ph)
    .attr('fill','white').attr('stroke','#333').attr('rx',10).attr('ry',10);
  // Close
  const cs=24;
  popup.append('rect').attr('x',px+pw-cs-10).attr('y',py+10)
    .attr('width',cs).attr('height',cs).attr('fill','#eee').attr('stroke','#333')
    .style('cursor','pointer').on('click',e=>{e.stopPropagation();popup.remove();});
  popup.append('text').attr('x',px+pw-cs/2-10).attr('y',py+10+cs/2)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-size',cs*0.8).attr('fill','#333').style('cursor','pointer').text('×')
    .on('click',e=>{e.stopPropagation();popup.remove();});
  // Split panel
  const m={top:pad,right:pad,bottom:pad,left:pad};
  // Padding for charts
  // pad already defined above
  const leftW = pw/2 - pad*2;
  const rightW = pw/2 - pad*2;
  const cH = ph - pad*2;
  const exG = popup.append('g').attr('transform', `translate(${px + pad},${py + pad})`);
  const ciG = popup.append('g').attr('transform', `translate(${px + pad + leftW + pad},${py + pad})`);
  // Excel side
  const exData=excelByCountry[d.country]||[];
  const yrs=Array.from(new Set(exData.map(e=>e.Year))).sort((a,b)=>a-b);
  const exX=d3.scaleLinear().domain(d3.extent(yrs)).range([0, leftW]);
  const exY = d3.scaleLinear().domain([0,100]).range([cH,0]);
  exG.append('g').attr('transform',`translate(0,${cH})`).call(d3.axisBottom(exX).ticks(5).tickFormat(d3.format('d')));
  exG.append('g').call(d3.axisLeft(exY));
  const groups=d3.group(exData,e=>e.Series);
  const colors=d3.schemeCategory10;
  const exLine=d3.line().curve(d3.curveCatmullRom).x(e=>exX(e.Year)).y(e=>exY(e['Superstition Index']));
  let li=0;
  const legend = exG.append('g')
    .attr('transform', `translate(${-pad}, ${cH / 2})`);
  for(const [key,vals] of groups){
    const color=colors[li % colors.length];
    if (color === '#7f7f7f') {
      li++;
      continue;
    }
    exG.append('path').datum(vals)
      .attr('fill','none').attr('stroke',color).attr('stroke-width',1)
      .attr('d',exLine);
    const ent=legend.append('g').attr('transform',`translate(0,${li*20})`);
    ent.append('line').attr('x1',0).attr('y1',0).attr('x2',20).attr('y2',0)
      .attr('stroke',color).attr('stroke-width',1);
    ent.append('text').attr('x',25).attr('y',0).attr('dominant-baseline','middle').text(key);
    li++;
    // Add Excel point markers with hover
    exG.selectAll(`.dot-${key}`)
      .data(vals)
      .enter().append('circle')
      .attr('class', `dot-${key}`)
      .attr('cx', d => exX(d.Year))
      .attr('cy', d => exY(d['Superstition Index']))
      .attr('r', 4)
      .attr('fill', color)
      .on('mouseover', (event, d) => {
        tooltip.html(`Series: ${d.Series}<br>Year: ${d.Year}<br>Index: ${d['Superstition Index']}`)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY + 10}px`)
          .style('display', 'block');
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      });
  }
  // CSV side
  const ciData=csvByCountry[d.country]||[];
  const ciX=d3.scaleLinear().domain(d3.extent(yrs)).range([0, rightW]);
  const ciY = d3.scaleLinear().domain([0,100]).range([cH,0]);
  ciG.append('g').attr('transform',`translate(0,${cH})`).call(d3.axisBottom(ciX).ticks(5).tickFormat(d3.format('d')));
  ciG.append('g').call(d3.axisLeft(ciY));
  const ciLine=d3.line().curve(d3.curveCatmullRom).x(e=>ciX(e.Year)).y(e=>ciY(e['Superstition Index']));
  ciG.append('path').datum(ciData).attr('fill','none').attr('stroke','red').attr('stroke-width',2).attr('d',ciLine);
  // Add CSV point markers with hover
  ciG.selectAll('.ci-dot')
    .data(ciData)
    .enter().append('circle')
    .attr('class', 'ci-dot')
    .attr('cx', d => ciX(d.Year))
    .attr('cy', d => ciY(d['Superstition Index']))
    .attr('r', 4)
    .attr('fill', 'red')
    .on('mouseover', (event, d) => {
      tooltip.html(`Year: ${d.Year}<br>Index: ${d['Superstition Index']}`)
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY + 10}px`)
        .style('display', 'block');
    })
    .on('mouseout', () => {
      tooltip.style('display', 'none');
    });
}
