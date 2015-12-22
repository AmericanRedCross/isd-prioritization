d3.select(window).on("resize", throttle);

var svg, g, world, countryData, programSectors;
var scoreLookup = {};
var sliders = [];
var scores = [];


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
  // projection = d3.geo.mercator()
  //   .translate([0, 0])
  //   .scale(width / 2 / Math.PI);
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

// projection and path setup
// var projection = d3.geo.kavrayskiy7()
//     .scale(170)
//     .translate([width / 2, height / 2])
//     .precision(.1);

var quantize = d3.scale.quantize()
    .domain([0, 10])
    .range(colorbrewer.OrRd[9]);
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

    grabGeoData()
  });
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
  scores = [];
  $.each(countryData, function(indexA, country){

     country.disastersW = country.disasters * weightings.disasters;
     country.vulnW = country.vuln * weightings.vuln;
     country.copingW = country.coping * weightings.coping;
     country.popW = country.pop * weightings.pop;
     country.need= (country.disastersW + country.vulnW + country.copingW + country.popW) / (weightings.disasters + weightings.vuln + weightings.coping + weightings.pop);
     if(isNaN(country.need)){ weightings.need = 0; country.need = 0 };
     country.needW = weightings.need * country.need;

     country.odaW = country.oda * weightings.oda;
     country.recipW = country.recip * weightings.recip;
     country.funding = (country.odaW + country.recipW) / (weightings.oda + weightings.recip);
     if(isNaN(country.funding)){ weightings.funding = 0; country.funding = 0 };
     country.fundingW = weightings.funding * country.funding;

     country.ifrcW = country.ifrc * weightings.ifrc;
     country.isdW = country.isd * weightings.isd;
     country.deployW = country.deploy * weightings.deploy;
     country.conflictW = country.conflict * weightings.conflict;
    //  country.entry = (country.ifrcW + country.isdW + country.deployW + country.conflictW) / (weightings.ifrc + weightings.isd + weightings.deploy + weightings.conflict);
    //  if(isNaN(country.entry)){ weightings.entry = 0; country.entry = 0; };
    //  country.entryW = weightings.entry * country.entry;
    var programs = false;
    $(programSectors).each(function(index, sector){
      if(country[sector] > 0){ programs = true; }
    });
    country.fy16 = (programs === true) ? 10 : 0;
    country.fy16W = country.fy16 * weightings.fy16;
    country.entry = (country.ifrcW + country.isdW + country.deployW + country.conflictW + country.fy16W) / (weightings.ifrc + weightings.isd + weightings.deploy + weightings.conflict + weightings.fy16);
    if(isNaN(country.entry)){ weightings.entry = 0; country.entry = 0; };
    country.entryW = weightings.entry * country.entry;



     $(sliders).each(function(index, item){
       var category = $(item).attr("id");
       var spanSelector = ".weight." + category;
       if(weightings.need == 0){
         if(category == "need"){
           item.noUiSlider.set(0);
           d3.select(spanSelector).html('0.00');
         }
       }
       if(weightings.funding == 0){
         if(category == "funding"){
           item.noUiSlider.set(0);
           d3.select(spanSelector).html('0.00');
         }
       }
       if(weightings.entry == 0){
         if(category == "entry"){
           item.noUiSlider.set(0);
           d3.select(spanSelector).html('0.00');
         }
       }

     })

     country.score = (country.needW + country.fundingW + country.entryW) / (weightings.need + weightings.funding + weightings.entry);
     if(isNaN(country.score)){ country.score = 0; };
     scores.push(country.score);
     scoreLookup[country.iso3] = country.score;
  });

  updateTable();
}

function updateTable(){

    // DATA JOIN
    var entry = d3.select("#tableBody").selectAll('tr')
      .data(countryData, function(d){ return d.iso3; });

    // UPDATE
    entry.html(function(d){
      return "<td>" + oneDecimal(d.score) + "</td><td>" + d.country + "</td>";
    });

    // ENTER
    entry.enter().append('tr')
      .html(function(d){
        return "<td>" + oneDecimal(d.score) + "</td><td>" + d.country + "</td>";
      });

    // EXIT
    entry.exit().remove();

    entry.sort(function(a,b){
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
    $('#map').mouseover(function(e) {
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
