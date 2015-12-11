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

var sliders = [];

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

  getData();

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

  $.each(countryData, function(indexA, country){

     country.disastersW = country.disasters * weightings.disasters;
     country.vulnW = country.vuln * weightings.vuln;
     country.copingW = country.coping * weightings.coping;
     country.popW = country.pop * weightings.pop;
     country.need= (country.disastersW + country.vulnW + country.copingW + country.popW) / (weightings.disasters + weightings.vuln + weightings.coping + weightings.pop);
     country.needW = weightings.need * country.need;

     country.odaW = country.oda * weightings.oda;
     country.recipW = country.recip * weightings.recip;
     country.funding = (country.odaW + country.recipW) / (weightings.oda + weightings.recip);
     country.fundingW = weightings.funding * country.funding;

     country.ifrcW = country.ifrc * weightings.ifrc;
     country.isdW = country.isd * weightings.isd;
     country.deployW = country.deploy * weightings.deploy;
     country.conflictW = country.conflict * weightings.conflict;
     country.entry = (country.ifrcW + country.isdW + country.deployW + country.conflictW) / (weightings.ifrc + weightings.isd + weightings.deploy + weightings.conflict);
     country.entryW = weightings.entry * country.entry;

     country.score = (country.needW + country.fundingW + country.entryW) / (weightings.need + weightings.funding + weightings.entry);

  });

  updateTable();

}

function updateTable(){

    // DATA JOIN
    var entry = d3.select("#tableBody").selectAll('tr')
      .data(countryData, function(d){ return d.iso3; });

    // UPDATE
    entry.html(function(d){
      return "<td>" + d.score + "</td><td>" + d.country + "</td>";
    });

    // ENTER
    entry.enter().append('tr')
      .html(function(d){
        return "<td>" + d.score + "</td><td>" + d.country + "</td>";
      });

    // EXIT
    entry.exit().remove();

    entry.sort(function(a,b){
        return d3.descending(a.score, b.score);
      })

}


setupSliders();
