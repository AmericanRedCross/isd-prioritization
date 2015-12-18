// map
var defaultFill = '#d7d7d8';
var width = 960,
    height = 580;

// projection and path setup
var projection = d3.geo.kavrayskiy7()
    .scale(170)
    .translate([width / 2, height / 2])
    .precision(.1);

var path = d3.geo.path()
    .projection(projection);


var quantize = d3.scale.quantize()
    .domain([0, 10])
    .range(colorbrewer.Purples[5]);
    // Every ColorBrewer Scale
    // http://bl.ocks.org/mbostock/raw/5577023/


// make a map
var map = d3.select('#map').append('svg')
    .style('height', height + 'px')
    .style('width', width + 'px');


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
  "conflict": 1 // sub
};

var countryData = [];
var scoreLookup = {};
var sliders = [];
var scores = [];

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

  	// Bind the color changing function
  	// to the slide event.
  	sliders[i].noUiSlider.on('slide', setWeighting);
  }

  setupMap();

}

function setupMap(){
  d3.json("data/ne_50m-simple-topo.json", function(error, world) {
    if (error) throw error;
    var countries = topojson.feature(world, world.objects.ne_50m).features;
    map.selectAll(".country")
        .data(countries)
      .enter().append("path")
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

    getData();
  });
}

function getData(){
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
      conflict: 10 - parseFloat(d.conflict)
    };
  }, function(error, rows) {
    countryData = rows;
    setWeighting();
  });
}

function setWeighting(){
  $(sliders).each(function(index, item){
    var category = $(item).attr("id");
    var weight = item.noUiSlider.get();
    var spanSelector = ".weight." + category;
    d3.select(spanSelector).html(weight);
    weightings[category] = parseFloat(weight);
  })
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
     country.entry = (country.ifrcW + country.isdW + country.deployW + country.conflictW) / (weightings.ifrc + weightings.isd + weightings.deploy + weightings.conflict);
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

    updateMap();

}

function updateMap(){

  quantize.domain([
      d3.min(d3.values(countryData), function(d) { return d.score; }),
      d3.max(d3.values(countryData), function(d) { return d.score; })
    ]);
  d3.selectAll('.country').each(function(d,i){
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

function showDisclaimer() {
  window.alert("The maps used do not imply the expression of any opinion concerning the legal status of a territory or of its authorities.");
}

setupSliders();
