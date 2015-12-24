d3.select(window).on("resize", throttle);

var svg, g, world, countryData, programSectors;
var scoreLookup = {};
var sliders = [];

// var zoom = d3.behavior.zoom()
//     .scaleExtent([1, 8])
//     .on("zoom", move);

var defaultFill = '#d7d7d8';

var width, height;

function setDimensions(){
  width = document.getElementById('map').offsetWidth-100;
  if(width / 2 <= window.innerHeight - 60) {
    height = width / 2;
  } else {
    height = window.innerHeight - 60;
    width = height * 2;
  }

}

setDimensions();

function setup(width,height){

  projection = d3.geo.kavrayskiy7()
    .translate([0, 0])
    .scale(width / 2 / Math.PI);

  path = d3.geo.path()
      .projection(projection);
  svg = d3.select("#map").append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
      // .call(zoom);
  g = svg.append("g");
}

setup(width,height);

var quantize = d3.scale.quantize()
    .domain([0, 10])
    .range(colorbrewer.Reds[9]);
    // Every ColorBrewer Scale
    // http://bl.ocks.org/mbostock/raw/5577023/

var weightings = {
  "need": 5, // ## category
  "disasters": 3, // sub
  "vuln": 1, // sub
  "coping": 1, // sub
  "pop": 2, // sub
  "funding": 2, // ## category
  "oda": 4, // sub
  "recip": 1, // sub
  "entry": 2, // ## category
  "ifrc": 3, // sub
  "isd": 1, // sub
  "deploy": 1, // sub
  "conflict": 1, // sub
  "fy16": 0 // sub
};

var oneDecimal = d3.format(".2n");

function setupSliders(){
  sliders = document.getElementsByClassName('sliders');
  for ( var i = 0; i < sliders.length; i++ ) {
    var category = $(sliders[i]).attr("id");
    var defaultWeighting = weightings[category];
  	noUiSlider.create(sliders[i], {
  		start: defaultWeighting,
  		connect: "lower",
      step: 1,
      tooltip: true,
  		orientation: "horizontal",
  		range: {
  			'min': 0,
  			'max': 5
  		}
  	});

  	// Bind the color changing function to the slide event.
  	sliders[i].noUiSlider.on('slide', setWeighting);
  }

  grabData();
}

function grabData(){
  d3.csv("data/prioritization-data.csv", function(d){
    return {
      iso3: d.iso3,
      country: d.country,
      need: 0,
      disasters: parseFloat(d.disasters),
      vuln: parseFloat(d.vuln),
      coping: parseFloat(d.coping),
      pop: parseFloat(d.pop),
      funding: 0,
      oda: parseFloat(d.oda),
      recip: parseFloat(d.recip),
      entry: 0,
      ifrc: parseFloat(d.ifrc),
      isd: parseFloat(d.isd),
      deploy: parseFloat(d.deploy),
      conflict: 10 - parseFloat(d.conflict),
      cbh: parseFloat(d.cbh),
      drr: parseFloat(d.drr),
      measles: parseFloat(d.measles),
      resilience: parseFloat(d.resilience),
      od: parseFloat(d.od),
      urbandp: parseFloat(d.urbandp)
    };
  }, function(error, rows) {
    countryData = rows;

    buildTable();
  });
}

var graphSegments = [
  {id:"disastersW",details:{label:"Disasters",color:"#6baed6"}},
  {id:"vulnW",details:{label:"Vulnerability",color:"#4292c6"}},
  {id:"copingW",details:{label:"Lack of coping capacity",color:"#2171b5"}},
  {id:"popW",details:{label:"Population",color:"#08519c"}},
  {id:"odaW",details:{label:"ODA",color:"#41ab5d"}},
  {id:"recipW",details:{label:"Top 21",color:"#238b45"}},
  {id:"ifrcW",details:{label:"IFRC office",color:"#dadaeb"}},
  {id:"isdW",details:{label:"ISD staff",color:"#bcbddc"}},
  {id:"deployW",details:{label:"ARC deployments",color:"#9e9ac8"}},
  {id:"conflictW",details:{label:"Conflict (lack of)",color:"#807dba"}},
  {id:"fy16W",details:{label:"ISD FY16 programs",color:"#6a51a3"}}
];
var rows;

function buildTable(){

    rows = d3.select('#graph').selectAll('div')
      .data(countryData, function(d){ return d.iso3; }).enter()
      .append('div')
      .attr('id', function(d){ return "row-" + d.iso3; })
      .classed({"row":true,"graph-row":true})
      .attr('data-score',0)
      .html(function(d){
        graphSegmentsHtml = "";
        for(var i=0; i<graphSegments.length; i++){
          var thisSegmentHtml = '<div class="graph-segment ' + graphSegments[i].id +
          '" style="background-color:' + graphSegments[i].details.color + '; width:0%;" data-label="' + graphSegments[i].details.label + '" data-score=""></div>';
          graphSegmentsHtml += thisSegmentHtml;
        }
        html = '<div class="col-sm-4 graph-text-col">' + d.country + ' <small> - <span class="score-text"></span></small></div>' + '<div class="col-sm-8 graph-bar-col">' + graphSegmentsHtml  + "</div></div>";
        return html;
      })

      d3.selectAll(".graph-segment").on("mouseover", function(d){
        var tooltipText = "<small><b>" + $(this).attr("data-label") + "</b> - " + $(this).attr("data-score") + "</small>";
        $('#tooltip').html(tooltipText);
      }).on("mouseout", function(){
        $('#tooltip').empty();
      });

  grabGeoData()
}


function grabGeoData(){
  d3.json("data/ne_50m-simple-topo.json", function(error, data) {
    if (error) throw error;
    world = topojson.feature(data, data.objects.ne_50m).features;
    drawGeoData(world);
  });
}

function drawGeoData(world){
  var country = g.selectAll(".country").data(world)
  country.enter().insert("path")
      .attr("class", "country")
      .attr("d", path)
      .style("fill", defaultFill)
      .on("mouseover", function(d){
        var tooltipText = "<strong>" + d.properties.name + " - <small>";
        var score = d3.select(this).attr('data-score');
        tooltipText += score ? oneDecimal(d3.select(this).attr('data-score')) : 'n/a';
        tooltipText += "</small></strong>";
        $('#tooltip').append(tooltipText);
      })
      .on("mouseout", function(d){
        $('#tooltip').empty();
      });

    setWeighting();
}

function setWeighting(){
  $(sliders).each(function(index, item){
    var category = $(item).attr("id");
    var weight = item.noUiSlider.get();
    var spanSelector = ".weight." + category;
    d3.select(spanSelector).html(weight);
    weightings[category] = parseFloat(weight);
  })

  programSectors = [];
  checkboxes = $("#program-sectors input[type=checkbox]");
  for (i=0; i<checkboxes.length; i++) {
    if(checkboxes[i].checked === true) {
      programSectors.push(checkboxes[i].value);
    }
  }

  adjustScores();
}

function adjustScores(){

  $.each(countryData, function(countryIndex, country){
    var needWeightingsSum = weightings.disasters + weightings.vuln + weightings.coping + weightings.pop;
    var fundingWeightingsSum = weightings.oda + weightings.recip;
    var entryWeightingsSum = weightings.ifrc + weightings.isd + weightings.deploy + weightings.conflict + weightings.fy16;
    var categoryWeightingsSum = weightings.need + weightings.funding + weightings.entry;

    country.disastersW =  weightings.need * (weightings.disasters * country.disasters / needWeightingsSum) / categoryWeightingsSum;
    country.vulnW = weightings.need * (weightings.vuln * country.vuln / needWeightingsSum) / categoryWeightingsSum;
    country.copingW = weightings.need * (weightings.coping * country.coping / needWeightingsSum) / categoryWeightingsSum;
    country.popW = weightings.need * (weightings.pop * country.pop / needWeightingsSum) / categoryWeightingsSum;
    country.odaW = weightings.funding * (weightings.oda * country.oda / fundingWeightingsSum) / categoryWeightingsSum;
    country.recipW = weightings.funding * (weightings.recip * country.recip / fundingWeightingsSum) / categoryWeightingsSum;
    country.ifrcW = weightings.entry * (weightings.ifrc * country.ifrc / entryWeightingsSum) / categoryWeightingsSum;
    country.isdW = weightings.entry * (weightings.isd * country.isd / entryWeightingsSum) / categoryWeightingsSum;
    country.deployW = weightings.entry * (weightings.deploy * country.deploy / entryWeightingsSum) / categoryWeightingsSum;
    country.conflictW = weightings.entry * (weightings.conflict * country.conflict / entryWeightingsSum) / categoryWeightingsSum;
    var programs = false;
    $(programSectors).each(function(sectorIndex, sector){
      if(country[sector] != 0){ programs = true; } else {console.log("false")}
    });
    country.fy16 = (programs === true) ? 10 : 0;
    country.fy16W = weightings.entry * (weightings.fy16 * country.fy16 / entryWeightingsSum) / categoryWeightingsSum;

    for(var i=0; i<graphSegments.length; i++){
      subCat = graphSegments[i].id
      if(isNaN(country[subCat])){ country[subCat] = 0;};
    }

    country.score = country.disastersW + country.vulnW + country.copingW + country.popW + country.odaW + country.recipW + country.ifrcW + country.isdW + country.deployW  + country.conflictW + country.fy16W;
    scoreLookup[country.iso3] = country.score;
  });

  updateTable();
}


function updateTable(){

  // UPDATED DATA JOIN
  rows.data(countryData, function(d){ return d.iso3; });

  rows.each(function(d){
    d3.select(this).select('.score-text').text(oneDecimal(d.score));
    for(var i=0; i<graphSegments.length; i++){
      selector = ".graph-segment." + graphSegments[i].id
      segmentWidth = d[graphSegments[i].id] * 10 + "%"
      d3.select(this).select(selector)
        .style('width',segmentWidth)
        .attr('data-score', oneDecimal(d[graphSegments[i].id]))
    }

  })

  rows.sort(function(a,b){
    return d3.descending(a.score, b.score);
  })

    updateMapColors();
}

function updateMapColors(){

  quantize.domain([
      d3.min(d3.values(countryData), function(d) { return d.score; }),
      d3.max(d3.values(countryData), function(d) { return d.score; })
    ]);
  g.selectAll('.country').each(function(d,i){
    if(scoreLookup[d.properties.iso]){
      d3.select(this).style("fill", function(d){
          return quantize(scoreLookup[d.properties.iso]);
        })
        .attr('data-score', scoreLookup[d.properties.iso])
    } else {
      d3.select(this).style("fill", function(d){
        return defaultFill;
      })
      .attr('data-score', '');
    }
  })

}

function redraw() {
  setDimensions();
  d3.select('svg').remove();
  setup(width,height);
  drawGeoData(world);
}

// function move() {
//
//   var t = d3.event.translate;
//   var s = d3.event.scale;
//   var h = height / 3;
//
//   t[0] = Math.min(width / 2 * (s - 1), Math.max(width / 2 * (1 - s), t[0]));
//   t[1] = Math.min(height / 2 * (s - 1) + h * s, Math.max(height / 2 * (1 - s) - h * s, t[1]));
//
//   zoom.translate(t);
//   g.style("stroke-width", 1 / s).attr("transform", "translate(" + t + ")scale(" + s + ")");
//
// }

function checkedPrograms(change){
  checkboxes = $("#program-sectors input[type=checkbox]");
  if(change === 'all'){
    for (i=0; i<checkboxes.length; i++) { checkboxes[i].checked = true; }
  }
  if(change === 'none'){
    for (i=0; i<checkboxes.length; i++) { checkboxes[i].checked = false; }
  }
  setWeighting();
}

// tooltip follows cursor
$(document).ready(function() {
    $('body').mouseover(function(e) {
        //Set the X and Y axis of the tooltip
        $('#tooltip').css('top', e.pageY + 10 );
        $('#tooltip').css('left', e.pageX + 20 );
    }).mousemove(function(e) {
        //Keep changing the X and Y axis for the tooltip, thus, the tooltip move along with the mouse
        $("#tooltip").css({top:(e.pageY+15)+"px",left:(e.pageX+20)+"px"});
    });
});



var throttleTimer;
function throttle() {
  window.clearTimeout(throttleTimer);
    throttleTimer = window.setTimeout(function() {
      redraw();
    }, 200);
}

setupSliders();
