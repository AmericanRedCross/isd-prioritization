d3.select(window).on("resize", throttle);

var svg, g, world, fy16sectors, places, countryData, programSectors;
var scoreLookup = {};
var sliders = [];
var groupToggles = document.getElementsByClassName('toggle-group');

var defaultFill = '#d7d7d8';
var zeroFill = '#000000';

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
  countries = svg.append("g").classed("map-countries", true);
  cities = svg.append("g").classed("map-cities", true);
  labels = svg.append("g").classed("map-labels", true);
  programs = svg.append("g").classed("program-markers", true);
}

setup(width,height);

var quantize = d3.scale.quantize()
    .domain([0, 10])
    .range(colorbrewer.Reds[9]);
    // Every ColorBrewer Scale
    // http://bl.ocks.org/mbostock/raw/5577023/

var defaults = {
  need: { weight: 1 }, // ## category (0 or 1)
  disasters: { weight: 8, title: "Disaster exposure", color:"#c6dbef" },
  emdat: { weight: 5, title: "People affected by disasters", color:"#9ecae1" },
  vuln: { weight: 9, title: "Vulnerability", color:"#6baed6" },
  coping: { weight: 9, title: "Lack of coping capacity", color:"#3182bd" },
  urban: { weight: 3, title: "Urban population", color:"#08519c" },
  funding: { weight: 1 }, // ## category (0 or 1)
  usaid: { weight: 4, title: "USAID funding", color:"#a1d99b" },
  oda: { weight: 4, title: "ODA", color:"#74c476" },
  usmigr: { weight: 2, title: "Migrants to USA", color:"#31a354" },
  top25: { weight: 1, title: "Presence of top 25 companies", color:"#006d2c" },
  entry: { weight: 1 }, // ## category (0 or 1)
  ifrcoffice: { weight: 7, title: "IFRC office", color:"#f7fcfd" },
  isdstaff: { weight: 3, title: "ISD staff presence", color:"#e0ecf4" },
  conflict: { weight: 8, title: "Security", color:"#bfd3e6" },
  irocpeople: { weight: 5, title: "ARC disaster deployments", color:"#9ebcda" },
  iroccash: { weight: 2, title: "ARC disaster money", color:"#8c96c6" },
  irocsupp: { weight: 2, title: "ARC disaster supplies", color:"#8c6bb1" },
  ctpall: { weight: 4, title: "CTP response (all appeals)", color:"#88419d" },
  ctparc: { weight: 0, title: "CTP response (ARC)", color:"#810f7c" },
  fy16: { weight: 0, title: "ISD FY16 programs", color:"#4d004b"}
};
// copy the object so we can store new weightings but also keep track of the defaults
// for reset witout page refresh
var weightings={}
for(key in defaults){
  weightings[key] = defaults[key].weight
}

var graphSegments = ["disasters", "emdat", "vuln", "coping", "urban", "usaid", "oda", "usmigr", "top25", "ifrcoffice", "isdstaff", "conflict", "irocpeople", "iroccash", "irocsupp", "ctpall", "ctparc", "fy16"];

$.each(graphSegments, function(i, segment){
  sliderSearch = "#" + segment + ".sliders";
  $(sliderSearch).css("background", defaults[segment].color)
});

function quickSetSliders(option){
  $(sliders).each(function(index, item){
    if(option === 'default'){
      var category = $(item).attr("id");
      item.noUiSlider.set(defaults[category].weight);
      d3.selectAll('.toggle-group').classed({'fa-toggle-on':true, 'fa-toggle-off':false});
    }
    if(option === 'zero'){
      item.noUiSlider.set(0);
    }
  });
  setWeighting();
}

var noDecimal = d3.format(",d");
var oneDecimal = d3.format("00.1f");
var twoDecimal = d3.format("00.2f");

function setupSliders(){
  // only the subcategories have elements on the page classed sliders
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
  		range: { 'min':0, 'max':10 }
  	});

  	// Bind the color changing function to the slide event.
  	sliders[i].noUiSlider.on('slide', setWeighting);
  }

  grabData();
}

function getNumber(str){
  return (isNaN(parseFloat(str))) ? 0 : parseFloat(str);
}

function grabData(){
  d3.csv("data/prioritizin-data.csv", function(d){
    var rowObject = {
      iso3: d.iso3,
      country: d.country,
      fy16cbh: getNumber(d.fy16cbh), //
      fy16dr: getNumber(d.fy16dr), //
      fy16measles: getNumber(d.fy16measles), //
      fy16resilience: getNumber(d.fy16resilience), //
      fy16od: getNumber(d.fy16od), //
      fy16urbandp: getNumber(d.fy16urbandp) //
    }
    var defaultsExclude = ["need", "funding", "entry", "fy16"];
    var missingData = [];
    for(key in defaults){
      if($.inArray(key, defaultsExclude) === -1){
        rowObject[key] = getNumber(d[key])
        if(d[key] === "#N/A"){
          missingData.push(defaults[key].title)
        }
      }
    }
    rowObject.missing = missingData;
    return rowObject;
  }, function(error, rows) {
    countryData = rows;

    buildTable();
  });
}

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
          var thisSegmentHtml = '<div class="graph-segment ' + graphSegments[i] + "W" +
          '" style="background-color:' + defaults[graphSegments[i]].color + '; width:0%;" data-label="' + defaults[graphSegments[i]].title + '" data-score=""></div>';
          graphSegmentsHtml += thisSegmentHtml;
        }
        html = '<div class="col-sm-4 graph-text-col">' + d.country + ' <small>';
        html += (d.missing.length > 0) ? ' <i class="fa fa-exclamation-circle data-missing-icon" data-missing="' + d.missing.join(", ") + '"></i>' : '';
        html += ' - <span class="score-text"></span></small></div>' +
        '<div class="col-sm-8 graph-bar-col">' + graphSegmentsHtml  + "</div></div>";
        return html;
      })

      d3.selectAll(".graph-segment").on("mouseover", function(d){
        var tooltipText = "<small><b>" + $(this).attr("data-label") + "</b> - " + $(this).attr("data-score") + "</small>";
        $('#tooltip').html(tooltipText);
      }).on("mouseout", function(){
        $('#tooltip').empty();
      });

      d3.selectAll(".data-missing-icon").on("mouseover", function(d){
        var tooltipText = "<small><b>No data available:</b> " + $(this).attr("data-missing") + "</small>";
        $('#tooltip').html(tooltipText);
      }).on("mouseout", function(){
        $('#tooltip').empty();
      });

  grabCities();
}

function grabCities(){
  d3.csv("data/ne_110m_cities.csv", function(error, data) {
    if (error) throw error;
      places = data;
      grabGeoData()
  })
}

function grabGeoData(){
  d3.json("data/ne_50m-simple-topo.json", function(error, data) {
    if (error) throw error;
    world = topojson.feature(data, data.objects.ne_50m).features;

    // to the properties of each country shape add {'fy16': {'fy16cbh':10, 'fy16dr':0, ...}}
    fy16sectors = [];
    checkboxes = $("#program-sectors input[type=checkbox]");
    for (i=0; i<checkboxes.length; i++) {
        var prgObj = {}
        prgObj.key = checkboxes[i].value;
        prgObj.label = $(checkboxes[i]).parent().text();
        fy16sectors.push(prgObj)
    }
    $(countryData).each(function(a, country){
      $(world).each(function(b, geo){
        if(geo.properties.iso === country.iso3){
          geo.properties.fy16 = {};
          fy16sectors.forEach(function(sector){
            geo.properties.fy16[sector.key] = country[sector.key]
          })
        }
      })
    })


    drawFy16();
  });
}

function drawFy16(){
  var program = programs.selectAll(".programs")
    .data(world.filter(function(geo){
      var include = false;
      fy16sectors.forEach(function(sector){
        if(geo.properties.fy16 !== undefined){
          if(geo.properties.fy16[sector.key] > 0){ include = true; }
        }
      })
      return include;
    }))
  program.enter().append('circle')
      .attr("cx", function(d){ return (path.centroid(d))[0]; })
      .attr("cy", function(d){ return (path.centroid(d))[1]; })
      .attr("class", "fy16-locator hide")
      .on("mouseover", function(d){
        var tooltipText = "<strong>" + d.properties.name + " - <small>";
        var score = d3.select(this).attr('data-score');
        tooltipText += score ? oneDecimal(d3.select(this).attr('data-score')) : 'n/a';
        tooltipText += "</small></strong>";
        var thisSectorArray = [];
        $.each(fy16sectors, function(i, sector){
          if(d.properties.fy16[sector.key] > 0){ thisSectorArray.push(sector.label); }
        });
        tooltipText += (thisSectorArray.length > 0) ? '<br><small>' + thisSectorArray.sort(d3.ascending).join("<br> ") + '<small>' : '';
        $('#tooltip').append(tooltipText);
      })
      .on("mouseout", function(d){
        $('#tooltip').empty();
      });

    drawGeoData();
}

function drawGeoData(){
  var country = countries.selectAll(".country").data(world)
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


  $(groupToggles).each(function(index, item){
    var category = $(item).attr("id");
    var weight = ($(item).hasClass("fa-toggle-on")) ? 1 : 0;
    weightings[category] = weight;
  });

  $(sliders).each(function(index, item){
    var category = $(item).attr("id");
    var weight = item.noUiSlider.get();
    var spanSelector = ".weight." + category;
    d3.select(spanSelector).html(noDecimal(weight));
    weightings[category] = parseFloat(weight);
  });

  programSectors = [];
  checkboxes = $("#program-sectors input[type=checkbox]");
  for (i=0; i<checkboxes.length; i++) {
    if(checkboxes[i].checked === true) {
      programSectors.push(checkboxes[i].value);
    }
  }

  d3.selectAll('.sliders').classed('null-slider', false);
  if(weightings.need === 0){
    d3.selectAll('.sliders.need').classed('null-slider', true);
  }
  if(weightings.funding === 0){
    d3.selectAll('.sliders.funding').classed('null-slider', true);
  }
  if(weightings.entry === 0){
    d3.selectAll('.sliders.entry').classed('null-slider', true);
  }

  adjustScores();
}

function adjustScores(){

  $.each(countryData, function(countryIndex, country){
    var weightingsSum = (weightings.need * (weightings.urban + weightings.disasters + weightings.vuln + weightings.coping + weightings.emdat)) +
      (weightings.funding * (weightings.usaid + weightings.oda + weightings.top25 + weightings.usmigr)) +
      (weightings.entry * (weightings.ctpall + weightings.ctparc + weightings.iroccash + weightings.irocpeople + weightings.irocsupp + weightings.ifrcoffice + weightings.isdstaff + weightings.conflict + weightings.fy16));
    // weightings need/funding/entry will all be 1-0 for on-off
    country.urbanW = weightings.need * (weightings.urban * country.urban / weightingsSum);
    country.disastersW =  weightings.need * (weightings.disasters * country.disasters / weightingsSum);
    country.vulnW = weightings.need * (weightings.vuln * country.vuln / weightingsSum);
    country.copingW = weightings.need * (weightings.coping * country.coping / weightingsSum);
    country.emdatW = weightings.need * (weightings.emdat * country.emdat / weightingsSum);
    country.usaidW = weightings.funding * (weightings.usaid * country.usaid / weightingsSum);
    country.odaW = weightings.funding * (weightings.oda * country.oda / weightingsSum);
    country.top25W = weightings.funding * (weightings.top25 * country.top25 / weightingsSum);
    country.usmigrW = weightings.funding * (weightings.usmigr * country.usmigr / weightingsSum);
    country.ctpallW = weightings.entry * (weightings.ctpall * country.ctpall / weightingsSum);
    country.ctparcW = weightings.entry * (weightings.ctparc * country.ctparc / weightingsSum);
    country.iroccashW = weightings.entry * (weightings.iroccash * country.iroccash / weightingsSum);
    country.irocpeopleW = weightings.entry * (weightings.irocpeople * country.irocpeople / weightingsSum);
    country.irocsuppW = weightings.entry * (weightings.irocsupp * country.irocsupp / weightingsSum);
    country.ifrcofficeW = weightings.entry * (weightings.ifrcoffice * country.ifrcoffice / weightingsSum);
    country.isdstaffW = weightings.entry * (weightings.isdstaff * country.isdstaff / weightingsSum);
    country.conflictW = weightings.entry * (weightings.conflict * country.conflict / weightingsSum);
    var programs = false;
    // programSectors is an array built from checked program sectors
    $(programSectors).each(function(sectorIndex, sector){
      if(country[sector] != 0){ programs = true; }
    });
    country.fy16 = (programs === true) ? 10 : 0;
    country.fy16W = weightings.entry * (weightings.fy16 * country.fy16 / weightingsSum);

    for(var i=0; i<graphSegments.length; i++){
      subCat = graphSegments[i] + "W";
      if(isNaN(country[subCat])){ country[subCat] = 0;};
    }
    country.score = country.urbanW + country.disastersW + country.vulnW + country.copingW + country.emdatW + country.usaidW + country.odaW + country.top25W + country.usmigrW + country.ctpallW + country.ctparcW + country.iroccashW + country.irocpeopleW + country.irocsuppW + country.ifrcofficeW + country.isdstaffW + country.conflictW + country.fy16W;
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
      selector = ".graph-segment." + graphSegments[i] + "W";
      segmentWidth = d[graphSegments[i] + "W"] * 10 + "%"
      d3.select(this).select(selector)
        .style('width',segmentWidth)
        .attr('data-score', twoDecimal(d[graphSegments[i] + "W"]))
    }

  })

  rows.sort(function(a,b){
    return d3.descending(a.score, b.score);
  })

    updateMapColors();
    updateMapLabels();
}

function updateMapColors(){

  quantize.domain([
      d3.min(d3.values(countryData), function(d) { return d.score; }),
      d3.max(d3.values(countryData), function(d) { return d.score; })
    ]);
  if(quantize.domain()[0] === 0 && quantize.domain()[1] === 0) {quantize.domain([0,1])}
  countries.selectAll('.country').each(function(d,i){
    if(scoreLookup[d.properties.iso] || scoreLookup[d.properties.iso] === 0){
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

  programs.selectAll('.fy16-locator').each(function(d,i){
    if(scoreLookup[d.properties.iso] || scoreLookup[d.properties.iso] === 0){
      d3.select(this).attr('data-score', scoreLookup[d.properties.iso])
    } else {
      d3.select(this).attr('data-score', '');
    }
  });

}

function updateMapLabels(){

  cities.selectAll(".city").remove();
  labels.selectAll('.city-label').remove();

  countryData.sort(function(a,b){
    return d3.descending(a.score, b.score);
  })
  var topTwenty = [];
  for(var i=0;i<15;i++){
    topTwenty.push(countryData[i].iso3)
  }

  var city = cities.selectAll(".city").data(places)
  city.enter().append('circle')
    .filter(function(d){ return $.inArray(d.adm0_a3, topTwenty) !== -1; })
    .attr("class", "city city-shadow")
    .attr("cx", function(d){ return projection([d.lng, d.lat])[0] + 0.5; })
    .attr("cy", function(d){ return projection([d.lng, d.lat])[1] + 0.5; })
    .attr("r", 2)
  city.enter().append('circle')
    .filter(function(d){ return $.inArray(d.adm0_a3, topTwenty) !== -1; })
    .attr("class", "city")
    .attr("cx", function(d){ return projection([d.lng, d.lat])[0]; })
    .attr("cy", function(d){ return projection([d.lng, d.lat])[1]; })
    .attr("r", 2)

  var label = labels.selectAll(".city-label").data(places)
  label.enter().append('text')
      .filter(function(d){ return $.inArray(d.adm0_a3, topTwenty) !== -1; })
      .attr("class", "city-label label-shadow")
      .attr("transform", function(d) { return "translate(" + projection([d.lng, d.lat]) + ")"; })
      .attr("dy", ".35em")
      .text(function(d){ return d.name; });
  label.enter().append('text')
      .filter(function(d){ return $.inArray(d.adm0_a3, topTwenty) !== -1; })
      .attr("class", "city-label")
      .attr("transform", function(d) { return "translate(" + projection([d.lng, d.lat]) + ")"; })
      .attr("dy", ".35em")
      .text(function(d){ return d.name; });
  labels.selectAll('.city-label')
    .attr("x", function(d) { return d.lng > -1 ? 6 : -6; })
    .style("text-anchor", function(d) { return d.lng > -1 ? "start" : "end"; });
}

function redraw() {
  setDimensions();
  d3.select('svg').remove();
  setup(width,height);
  drawGeoData(world);
}

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

var showPrograms = false;
function togglePrograms(el){
  var toggle = d3.select(el).select('i');
    if(toggle.classed('fa-eye')){
      toggle.classed({'fa-eye':false, 'fa-eye-slash':true});
      d3.select('#toggle-prgs-label').text('hide FY16 programs');
      d3.selectAll('.fy16-locator').classed('hide',false);
      showPrograms = true;
    } else {
      toggle.classed({'fa-eye':true, 'fa-eye-slash':false});
      d3.select('#toggle-prgs-label').text('show FY16 programs');
      d3.selectAll('.fy16-locator').classed('hide',true);
      showPrograms = false;
    }
}

// toggle grouping on or off
function toggleGroup(el){
  var toggle = d3.select(el);
  if(toggle.classed('fa-toggle-on')){
    toggle.classed({'fa-toggle-on':false, 'fa-toggle-off':true});
  } else { toggle.classed({'fa-toggle-on':true, 'fa-toggle-off':false}); }

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
