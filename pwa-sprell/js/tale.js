'use strict';

/* Maskinstemmen. Ett ansvar: si én setning på norsk, og si fra om den i det
   hele tatt kan si noe. */
window.SprellTale = (function () {

  var stemme = null;
  var paaNyeStemmer = null;

  function norsk(lang) {
    var l = (lang || '').toLowerCase();
    return l.indexOf('nb') === 0 || l.indexOf('no') === 0 || l.indexOf('nn') === 0;
  }

  function finnStemme() {
    if (!window.speechSynthesis) return null;
    if (stemme) return stemme;
    var alle = window.speechSynthesis.getVoices() || [];
    for (var i = 0; i < alle.length; i++) {
      if (norsk(alle[i].lang)) { stemme = alle[i]; return stemme; }
    }
    return null;
  }

  if (window.speechSynthesis) {
    /* getVoices() er tom til systemet har lastet lista. Uten denne lytteren
       ville «Les opp»-knappen sett død ut første gang siden åpnes, selv på en
       telefon som har norsk stemme. */
    window.speechSynthesis.addEventListener('voiceschanged', function () {
      stemme = null;
      finnStemme();
      if (paaNyeStemmer) paaNyeStemmer();
    });
  }

  function les(tekst, ferdig) {
    if (!window.speechSynthesis) { if (ferdig) ferdig(); return; }
    /* cancel() fyrer onend på det som allerede spilles. Flagget her gjør at
       den gamle setningens onend ikke får melde «ferdig» for den nye. */
    var avbrutt = false;
    window.speechSynthesis.cancel();
    var y = new window.SpeechSynthesisUtterance(tekst);
    var s = finnStemme();
    if (s) { y.voice = s; y.lang = s.lang || 'nb-NO'; } else { y.lang = 'nb-NO'; }
    /* Litt under normal fart: oppdraget skal kunne følges mens det leses. */
    y.rate = 0.9;
    function slutt() {
      if (avbrutt) return;
      avbrutt = true;
      if (ferdig) ferdig();
    }
    y.onend = slutt;
    y.onerror = slutt;
    window.speechSynthesis.speak(y);
  }

  function stopp() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  return {
    kanLese: function () { return !!window.speechSynthesis; },
    harNorskStemme: function () { return !!finnStemme(); },
    naarStemmerKommer: function (fn) { paaNyeStemmer = fn; },
    les: les,
    stopp: stopp
  };
})();
