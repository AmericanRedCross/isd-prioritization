d3.select(window).on("resize", throttle);

var svg, g, world, fy16sectors, places, countryData, programSectors;
var rankingArrays = {
  world: [],
  lac: [],
  africa: [],
  amee: []
};
var scoreLookup = {};
var sliders = [];
var groupToggles = document.getElementsByClassName('group-toggle');
var regionToggles =  document.getElementsByClassName('region-toggle');

var fy16sectors = [];
var checkboxes = $("#program-sectors input[type=checkbox]");
for (i=0; i<checkboxes.length; i++) {
    var prgObj = {}
    prgObj.key = checkboxes[i].value;
    prgObj.label = $(checkboxes[i]).parent().text();
    fy16sectors.push(prgObj)
}


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
  staffs = svg.append("g").classed("staff-markers", true);
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
  disasters: { weight: 9, title: "Natural disaster exposure", color:"#08519c" },
  conflict: { weight: 4, title: "Conflict", color:"#2171b5" },
  coping: { weight: 5, title: "Insti/infra weakness", color:"#4292c6" },
  emdat: { weight: 5, title: "People affected by disasters", color:"#6baed6" },
  vuln: { weight: 9, title: "Socio-eco/demo vulnerability", color:"#9ecae1" },
  popurban: { weight: 2, title: "Urban population", color:"#c6dbef" },
  poptotal: { weight: 0, title: "Total population", color:"#deebf7" },
  funding: { weight: 1 }, // ## category (0 or 1)
  usaid: { weight: 4, title: "USAID", color:"#006d2c" },
  usmigr: { weight: 0, title: "High migration to USA", color:"#238b45" },
  top25: { weight: 0, title: "Presence of top 25 companies", color:"#41ab5d" },
  entry: { weight: 1 }, // ## category (0 or 1)
  security: { weight: 8, title: "Security", color:"#4d004b" },
  ifrcoffice: { weight: 5, title: "IFRC office", color:"#810f7c" },
  isdstaff: { weight: 3, title: "ISD staff presence", color:"#88419d" },
  fy16: { weight: 5, title: "ISD FY16 programs", color:"#8c6bb1"}
};
// copy the object so we can store new weightings but also keep track of the defaults
// for reset witout page refresh
var weightings={}
for(key in defaults){
  weightings[key] = defaults[key].weight
}

var regionFilter = "world";

var graphSegments = ["disasters","conflict","coping","emdat","vuln","popurban","poptotal","usaid","usmigr","top25","security","ifrcoffice","isdstaff","fy16"];

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
      region: d.region,
      iso3: d.iso3,
      country: d.country,
      staffcount: getNumber(d.staffcount),
      staffcity: d.staffcity,
      ofac: d.ofac,
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
        html = '<div class="col-sm-4 graph-text-col">' + d.country + ' ';
        var thisSectorArray = [];
        $.each(fy16sectors, function(i, sector){
          if(d[sector.key] > 0){ thisSectorArray.push(sector.label); }
        });
        if(thisSectorArray.length > 0){
          html += '<i class="fa fa-cog fa-fw fy16-icon" data-fy16="' + thisSectorArray.sort(d3.ascending).join("<br> ") + '"></i>';
        }
        if(d.staffcount > 0){
          html += (d.staffcount === 1) ? '<i class="fa fa-user fa-fw staff-icon" data-staffcount="' + d.staffcount + '" data-staffcity="' + d.staffcity + '"></i>' :
            '<i class="fa fa-users fa-fw staff-icon" data-staffcount="' + d.staffcount + '" data-staffcity="' + d.staffcity + '"></i>';
        }
        html += (d.ofac === "comprehensive") ? '<i class="fa fa-exclamation-triangle ofac-sanctions-icon fa-fw" style="color:#941c20;" data-ofac="' + d.ofac + '"></i>' : '';
        html += (d.ofac === "targeted") ? '<i class="fa fa-exclamation-triangle ofac-sanctions-icon fa-fw" style="color:#94551c;" data-ofac="' + d.ofac + '"></i>' : '';
        html += (d.missing.length > 0) ? '<i class="fa fa-info fa-fw data-missing-icon" data-missing="' + d.missing.join(", ") + '"></i>' : '';
        html += ' - <span class="score-text"></span></div>' +
        '<div class="col-sm-8 graph-bar-col">' + graphSegmentsHtml  + "</div></div>";
        return html;
      })

      d3.selectAll(".graph-segment").on("mouseover", function(d){
        var tooltipText = "<small><b>" + $(this).attr("data-label") + "</b> - " + $(this).attr("data-score") + "</small>";
        $('#tooltip').html(tooltipText);
      }).on("mouseout", function(){
        $('#tooltip').empty();
      });

      d3.selectAll(".fy16-icon").on("mouseover", function(d){
        var tooltipText = "<small><b>FY16 programs:</b><br>" + $(this).attr("data-fy16") + "</small>";
        $('#tooltip').html(tooltipText);
      }).on("mouseout", function(){
        $('#tooltip').empty();
      });

      d3.selectAll(".staff-icon").on("mouseover", function(d){
        var tooltipText = "<small><b>ISD staff:</b> " + $(this).attr("data-staffcount") + ' / ' + $(this).attr("data-staffcity") + "</small>";
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

      d3.selectAll(".ofac-sanctions-icon").on("mouseover", function(d){
        var tooltipText = "<small>" + $(this).attr("data-ofac") + " OFAC sanctions</small>";
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
    // # to the properties of each country shape add data on programs {'fy16': {'fy16cbh':10, 'fy16dr':0, ...}}
    // # and also on staff numbers/city
    $(countryData).each(function(a, country){
      $(world).each(function(b, geo){
        if(geo.properties.iso === country.iso3){
          geo.properties.region = country.region;
          geo.properties.staffcount = country.staffcount;
          geo.properties.staffcity = country.staffcity;
          geo.properties.fy16 = {};
          fy16sectors.forEach(function(sector){
            geo.properties.fy16[sector.key] = country[sector.key]
          })
        }
      })
    })

    drawLayers();
  });
}

function drawLayers(){
  programs.selectAll(".programs")
    .data(world.filter(function(geo){
      var include = false;
      fy16sectors.forEach(function(sector){
        if(geo.properties.fy16 !== undefined){
          if(geo.properties.fy16[sector.key] > 0){ include = true; }
        }
      })
      return include;
    })).enter().append('circle')
      .attr("cx", function(d){ return (path.centroid(d))[0]; })
      .attr("cy", function(d){ return (path.centroid(d))[1]; })
      .attr("class", "locator fy16-locator")
      .attr("r", 4)
      .on("mouseover", function(d){
        populateMapTooltip(d, this);
      })
      .on("mouseout", function(d){
        $('#tooltip').empty();
      });
    if(showPrograms === false){ d3.selectAll(".fy16-locator").classed('hide',true)}

  staffs.selectAll(".staffs")
    .data(world.filter(function(geo){
      return geo.properties.staffcount > 0;
    })).enter().append('circle')
      .attr("cx", function(d){ return (path.centroid(d))[0]; })
      .attr("cy", function(d){ return (path.centroid(d))[1]; })
      .attr("class", "locator staff-locator")
      .attr("r", 6)
      .on("mouseover", function(d){
        populateMapTooltip(d, this);
      })
      .on("mouseout", function(d){
        $('#tooltip').empty();
      });
    if(showStaff === false){ d3.selectAll(".staff-locator").classed('hide',true)}

    drawGeoData();
}

function drawGeoData(){
  var country = countries.selectAll(".country").data(world)
  country.enter().insert("path")
      .attr("class", "country")
      .attr("d", path)
      .style("fill", defaultFill)
      .on("mouseover", function(d){
        populateMapTooltip(d, this);
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

  regionFilter = $(".region-toggle.fa-toggle-on").attr("id");

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

  rankingArrays.world = [];
  rankingArrays.lac = [];
  rankingArrays.africa = [];
  rankingArrays.amee = [];

  $.each(countryData, function(countryIndex, country){
    var weightingsSum = (weightings.need * (weightings.disasters + weightings.conflict + weightings.coping + weightings.emdat + weightings.vuln + weightings.popurban + weightings.poptotal)) +
      (weightings.funding * (weightings.usaid + weightings.top25 + weightings.usmigr)) +
      (weightings.entry * (weightings.ifrcoffice + weightings.isdstaff + weightings.security + weightings.fy16));
    // weightings need/funding/entry will all be 1-0 for on-off
    country.disastersW =  weightings.need * (weightings.disasters * country.disasters / weightingsSum);
    country.conflictW =  weightings.need * (weightings.conflict * country.conflict / weightingsSum);
    country.copingW = weightings.need * (weightings.coping * country.coping / weightingsSum);
    country.emdatW = weightings.need * (weightings.emdat * country.emdat / weightingsSum);
    country.vulnW = weightings.need * (weightings.vuln * country.vuln / weightingsSum);
    country.popurbanW = weightings.need * (weightings.popurban * country.popurban / weightingsSum);
    country.poptotalW = weightings.need * (weightings.poptotal * country.poptotal / weightingsSum);
    country.usaidW = weightings.funding * (weightings.usaid * country.usaid / weightingsSum);
    country.top25W = weightings.funding * (weightings.top25 * country.top25 / weightingsSum);
    country.usmigrW = weightings.funding * (weightings.usmigr * country.usmigr / weightingsSum);
    country.securityW = weightings.entry * (weightings.security * country.security / weightingsSum);
    country.ifrcofficeW = weightings.entry * (weightings.ifrcoffice * country.ifrcoffice / weightingsSum);
    country.isdstaffW = weightings.entry * (weightings.isdstaff * country.isdstaff / weightingsSum);
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
    country.score = country.disastersW + country.conflictW + country.copingW + country.emdatW + country.vulnW + country.popurbanW + country.poptotalW +  country.usaidW + country.top25W + country.usmigrW + country.securityW + country.ifrcofficeW + country.isdstaffW + country.fy16W;
    scoreLookup[country.iso3] = country.score;
    if($.inArray(country.score, rankingArrays.world) === -1){rankingArrays.world.push(country.score)}
    var regions = ["lac","africa","amee"];
    $.each(regions, function(i,d){
      if(country.region === d){
        if($.inArray(country.score, rankingArrays[d]) === -1){ rankingArrays[d].push(country.score) }
      }
    });

  });

  rankingArrays.world.sort(function(a, b) { return b - a; })
  rankingArrays.lac.sort(function(a, b) { return b - a; })
  rankingArrays.africa.sort(function(a, b) { return b - a; })
  rankingArrays.amee.sort(function(a, b) { return b - a; })

  updateTable();
}



function updateTable(){

  // UPDATED DATA JOIN
  rows.data(countryData, function(d){ return d.iso3; });

  rows.each(function(d){
    if (regionFilter === "world"){
      d3.select(this).classed('hidden', false);
    } else if (d.region === regionFilter) {
      d3.select(this).classed('hidden', false);
    } else {
      d3.select(this).classed('hidden', true);
    }
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
    return b.score - a.score;
  })

    updateMapColors();
    updateMapLabels();
}

function updateMapColors(){

  quantize.domain([
      // d3.min(d3.values(countryData), function(d) { return d.score; }),
      // d3.max(d3.values(countryData), function(d) { return d.score; })
      d3.min(rankingArrays[regionFilter]),
      d3.max(rankingArrays[regionFilter])
    ]);
  if(quantize.domain()[0] === 0 && quantize.domain()[1] === 0) {quantize.domain([0,1])}
  countries.selectAll('.country').each(function(d,i){
    if(scoreLookup[d.properties.iso] || scoreLookup[d.properties.iso] === 0){
      // index starts at 0, ranking starts at 1, so add 1
      var rank = $.inArray(scoreLookup[d.properties.iso], rankingArrays.world) + 1;
      var regionRank = null;
      if(d.properties.region !== "null"){
        regionRank = $.inArray(scoreLookup[d.properties.iso], rankingArrays[d.properties.region ]) + 1;
      }
      d3.select(this).attr('data-score', scoreLookup[d.properties.iso])
        .attr('data-rank', rank)
        .attr('data-region-rank', regionRank)
        .style("fill", function(d){
          if(regionFilter === "world" || d.properties.region === regionFilter){
            return quantize(scoreLookup[d.properties.iso]);
          } else { return defaultFill }
        })
    } else {
      d3.select(this).style("fill", function(d){
        return defaultFill;
      })
      .attr('data-score', '');
    }
  })

  svg.selectAll('.locator').each(function(d,i){
    if(scoreLookup[d.properties.iso] || scoreLookup[d.properties.iso] === 0){
      // index starts at 0, ranking starts at 1, so add 1
      var rank = $.inArray(scoreLookup[d.properties.iso], rankingArrays.world) + 1;
      var regionRank = null;
      if(d.properties.region !== "null"){
        regionRank = $.inArray(scoreLookup[d.properties.iso], rankingArrays[d.properties.region ]) + 1;
      }
      d3.select(this).attr('data-score', scoreLookup[d.properties.iso])
        .attr('data-rank', rank)
        .attr('data-region-rank', regionRank);
    } else {
      d3.select(this).attr('data-score', '');
    }
  });

}

function updateMapLabels(){

  cities.selectAll(".city").remove();
  labels.selectAll('.city-label').remove();

  countryData.sort(function(a,b){
    return b.score - a.score;
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
  drawLayers();
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

function populateMapTooltip(d, el){
  var tooltipText = "<strong>" + d.properties.name + " - <small>";
  var score = d3.select(el).attr('data-score');
  tooltipText += score ? oneDecimal(score) + ' | <i class="fa fa-globe"></i> #' + d3.select(el).attr('data-rank') : '';
  tooltipText += (d.properties.region !== "null") ? ' | ' + d.properties.region.toUpperCase() + ' #' + d3.select(el).attr('data-region-rank') : '';
  tooltipText += score ? '' : 'n/a';
  tooltipText += "</small></strong>";
  if(showStaff === true && d.properties.staffcount > 0){
    tooltipText += '<br><small>';
    tooltipText += (d.properties.staffcount === 1) ? '<i class="fa fa-user fa-fw"></i> ' : '<i class="fa fa-users fa-fw"></i> ';
    tooltipText += d.properties.staffcount + ' / ' + d.properties.staffcity + '</small>';
  }
  if(showPrograms === true){
    var thisSectorArray = [];
    $.each(fy16sectors, function(i, sector){
      if(d.properties.fy16[sector.key] > 0){ thisSectorArray.push(sector.label); }
    });
    tooltipText += (thisSectorArray.length > 0) ? '<br><small>' + thisSectorArray.sort(d3.ascending).join("<br> ") + '<small>' : '';
  }
  $('#tooltip').append(tooltipText);
}

var showStaff = false;
function toggleStaff(el){
  var toggle = d3.select(el).select('i');
    if(toggle.classed('fa-eye')){
      toggle.classed({'fa-eye':false, 'fa-eye-slash':true});
      d3.select('#toggle-staff-label').text('hide staff');
      d3.selectAll('.staff-locator').classed('hide',false);
      showStaff = true;
    } else {
      toggle.classed({'fa-eye':true, 'fa-eye-slash':false});
      d3.select('#toggle-staff-label').text('show staff');
      d3.selectAll('.staff-locator').classed('hide',true);
      showStaff = false;
    }
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

// toggle region on or off
function toggleRegion(el){
  d3.selectAll(".region-toggle-wrapper").classed("inactive-region",true);
  d3.selectAll(".region-toggle").classed({'fa-toggle-on':false, 'fa-toggle-off':true});
  d3.select(el.parentNode).classed("inactive-region",false);
  d3.select(el).classed({'fa-toggle-on':true, 'fa-toggle-off':false});
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
