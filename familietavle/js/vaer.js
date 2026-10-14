/*
 * Været – trekker ut det tavla viser fra MET Norways Locationforecast.
 *
 * Varselet er det samme som Yr bruker, og ikonene i `vaer/` er Yrs egne
 * (MIT-lisens, se `vaer/LISENS.txt`). Filnavnet er symbolkoden, så et ikon er
 * bare `vaer/<symbol_code>.svg`. To av kodene er stavet feil hos MET
 * («lightssleetshowersandthunder»), og ikonfilene er stavet likt – ikke rett
 * dem.
 *
 * Tavla henter varselet selv, rett fra api.met.no. Synk-jobben legger i
 * tillegg en kopi i datafila, som brukes når direkteoppslaget feiler.
 */
'use strict';

var Vaer = (function () {

  var STED = { navn: 'Bekkestua', lat: 59.918, lon: 10.588 };
  var URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' +
    STED.lat + '&lon=' + STED.lon;

  var NAVN = {
    clearsky: 'Klarvær', fair: 'Lettskyet', partlycloudy: 'Delvis skyet', cloudy: 'Skyet',
    lightrainshowers: 'Lette regnbyger', rainshowers: 'Regnbyger', heavyrainshowers: 'Kraftige regnbyger',
    lightrainshowersandthunder: 'Lette regnbyger og torden', rainshowersandthunder: 'Regnbyger og torden',
    heavyrainshowersandthunder: 'Kraftige regnbyger og torden', lightsleetshowers: 'Lette sluddbyger',
    sleetshowers: 'Sluddbyger', heavysleetshowers: 'Kraftige sluddbyger',
    lightssleetshowersandthunder: 'Lette sluddbyger og torden', sleetshowersandthunder: 'Sluddbyger og torden',
    heavysleetshowersandthunder: 'Kraftige sluddbyger og torden', lightsnowshowers: 'Lette snøbyger',
    snowshowers: 'Snøbyger', heavysnowshowers: 'Kraftige snøbyger',
    lightssnowshowersandthunder: 'Lette snøbyger og torden', snowshowersandthunder: 'Snøbyger og torden',
    heavysnowshowersandthunder: 'Kraftige snøbyger og torden', lightrain: 'Lett regn', rain: 'Regn',
    heavyrain: 'Kraftig regn', lightrainandthunder: 'Lett regn og torden', rainandthunder: 'Regn og torden',
    heavyrainandthunder: 'Kraftig regn og torden', lightsleet: 'Lett sludd', sleet: 'Sludd',
    heavysleet: 'Kraftig sludd', lightsleetandthunder: 'Lett sludd og torden',
    sleetandthunder: 'Sludd og torden', heavysleetandthunder: 'Kraftig sludd og torden',
    lightsnow: 'Lett snø', snow: 'Snø', heavysnow: 'Kraftig snø', lightsnowandthunder: 'Lett snø og torden',
    snowandthunder: 'Snø og torden', heavysnowandthunder: 'Kraftig snø og torden', fog: 'Tåke'
  };

  function tekst(symbol) {
    return NAVN[String(symbol || '').replace(/_(day|night|polartwilight)$/, '')] || '';
  }

  function serie(vaer) {
    return (vaer && vaer.properties && vaer.properties.timeseries) || [];
  }

  function symbolFra(p, felt) {
    for (var i = 0; i < felt.length; i++) {
      var f = p.data[felt[i]];
      if (f && f.summary && f.summary.symbol_code) return f.summary.symbol_code;
    }
    return '';
  }

  // Været nå: siste punkt som ikke ligger fram i tid.
  function naa(vaer, tid) {
    var s = serie(vaer), valgt = null;
    for (var i = 0; i < s.length; i++) {
      if (new Date(s[i].time) <= tid) valgt = s[i]; else break;
    }
    valgt = valgt || s[0];
    if (!valgt) return null;
    var d = valgt.data;
    return {
      temp: d.instant.details.air_temperature,
      vind: d.instant.details.wind_speed,
      symbol: symbolFra(valgt, ['next_1_hours', 'next_6_hours', 'next_12_hours']),
      nedbor: d.next_1_hours && d.next_1_hours.details ? d.next_1_hours.details.precipitation_amount : null
    };
  }

  // Noen klokkeslett utover dagen, med `steg` timers mellomrom.
  function timer(vaer, tid, antall, steg) {
    var s = serie(vaer), ut = [];
    var neste = new Date(tid.getFullYear(), tid.getMonth(), tid.getDate(), tid.getHours() + steg);
    for (var i = 0; i < s.length && ut.length < antall; i++) {
      var t = new Date(s[i].time);
      if (t < neste) continue;
      ut.push({
        tid: t,
        temp: s[i].data.instant.details.air_temperature,
        symbol: symbolFra(s[i], ['next_1_hours', 'next_6_hours'])
      });
      neste = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours() + steg);
    }
    return ut;
  }

  function dagnokkel(t) { return t.getFullYear() * 400 + t.getMonth() * 32 + t.getDate(); }

  // Dagene etter i dag: laveste og høyeste temperatur, og symbolet midt på dagen.
  function dager(vaer, tid, antall) {
    var s = serie(vaer), per = {}, rekke = [];
    var idag = dagnokkel(tid);
    s.forEach(function (p) {
      var t = new Date(p.time), k = dagnokkel(t);
      if (k <= idag) return;
      if (!per[k]) { per[k] = { dato: new Date(t.getFullYear(), t.getMonth(), t.getDate()), min: Infinity, maks: -Infinity, symbol: '', nedbor: 0, timeSymbol: -1 }; rekke.push(per[k]); }
      var d = per[k], temp = p.data.instant.details.air_temperature;
      d.min = Math.min(d.min, temp);
      d.maks = Math.max(d.maks, temp);
      var seks = p.data.next_6_hours;
      if (seks && t.getHours() % 6 === 0 && seks.details) d.nedbor += seks.details.precipitation_amount || 0;
      // Symbolet for perioden som starter nærmest kl. 12.
      var sym = symbolFra(p, ['next_6_hours', 'next_12_hours']);
      if (sym && (d.timeSymbol < 0 || Math.abs(t.getHours() - 12) < Math.abs(d.timeSymbol - 12))) {
        d.symbol = sym; d.timeSymbol = t.getHours();
      }
    });
    return rekke.slice(0, antall).filter(function (d) { return isFinite(d.min); });
  }

  // Det synk-jobben tar med i datafila: fem døgn er nok, resten er vekt.
  function beskjaer(vaer, tid) {
    if (!vaer || !vaer.properties) return null;
    var grense = tid.getTime() + 5 * 86400000;
    return {
      properties: {
        timeseries: serie(vaer).filter(function (p) {
          var t = new Date(p.time).getTime();
          return t >= tid.getTime() - 3600000 && t <= grense;
        })
      }
    };
  }

  return {
    STED: STED, URL: URL,
    tekst: tekst, naa: naa, timer: timer, dager: dager, beskjaer: beskjaer
  };
})();

if (typeof module !== 'undefined') module.exports = Vaer;
