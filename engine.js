/* Klavierprüfung: Regelwerk. Entscheidet unabhängig von jeder KI, welche Aussagen in den Bericht kommen.
   Reine Funktionen ohne Netz und ohne Kosten, laufen auf dem Handy des Kunden. */
(function (root) {
  var KP = typeof module !== "undefined" ? require("./texte.js") : root.KP;
  var E = {};
  var ORD = { u: -1, n: 0, l: 1, d: 2, k: 3 };
  var PEN = { n: 0, l: 0.35, d: 0.75, k: 1 };

  /* Bildqualität aus einem Graustufenbild (Werte 0-255). */
  E.qualitaet = function (gray, w, h) {
    var n = w * h, sum = 0, over = 0, i;
    for (i = 0; i < n; i++) { var g = gray[i]; sum += g; if (g >= 250) over++; }
    var mean = sum / n, ls = 0, lq = 0, c = 0;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var p = y * w + x, l = 4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - w] - gray[p + w];
      ls += l; lq += l * l; c++;
    }
    var m = ls / c, sharp = lq / c - m * m, glanz = over / n, Q = KP.q, hint = [];
    if (sharp < Q.schaerfeOk) hint.push("zu unscharf: Handy ruhig halten oder etwas Abstand lassen");
    if (mean < Q.hellMin) hint.push("zu dunkel: mehr Licht oder eine Lampe von der Seite");
    if (mean > Q.hellMax) hint.push("zu hell: Gegenlicht oder Blitz vermeiden");
    if (glanz > Q.glanzMax) hint.push("Reflexionen: Winkel leicht ändern");
    var urteil = "schlecht";
    if (sharp >= Q.schaerfeGut && mean >= Q.hellMin && mean <= Q.hellMax && glanz <= Q.glanzMax) urteil = "gut";
    else if (sharp >= Q.schaerfeOk && mean >= 45 && mean <= 225 && glanz <= 0.12) urteil = "mittel";
    return { schaerfe: Math.round(sharp), hell: Math.round(mean), glanz: Math.round(glanz * 1000) / 1000, urteil: urteil, hinweise: hint };
  };

  function bewertbar(v) {
    if (!v || v.status !== "erfasst") return false;
    if (v.qualitaet && v.qualitaet.urteil === "schlecht") return false;
    var a = v.antworten || {}, any = false;
    Object.keys(a).forEach(function (k) { if (a[k] && a[k] !== "u") any = true; });
    return any;
  }
  E.bewertbar = bewertbar;

  /* state: {bauform, region, ansichten:{id:{status,qualitaet,antworten}}, identitaet:{...}, dauerSek} */
  E.bewerte = function (state) {
    var views = KP.ansichten, bt = KP.bauteile, comps = {}, risiken = [], id;
    Object.keys(bt).forEach(function (c) { comps[c] = { id: c, name: bt[c].name, w: bt[c].w, grenze: bt[c].grenze, ansichten: [], gut: [], sev: "u", belege: [] }; });
    views.forEach(function (v) {
      var cs = {};
      v.fragen.forEach(function (f) { cs[KP.fragen[f].bauteil] = 1; });
      Object.keys(cs).forEach(function (c) { comps[c].ansichten.push(v.id); });
    });
    views.forEach(function (v) {
      var s = state.ansichten[v.id], ok = bewertbar(s);
      v.fragen.forEach(function (f) {
        var q = KP.fragen[f], c = comps[q.bauteil];
        if (s && s.status === "erfasst" && !c.belege.some(function (b) { return b === v.id; })) c.belege.push(v.id);
        if (!ok) return;
        var a = s.antworten[f]; if (!a || a === "u") return;
        if (a === "d" && q.kritisch) a = "k";
        if (c.gut.indexOf(v.id) < 0) c.gut.push(v.id);
        if (ORD[a] > ORD[c.sev]) c.sev = a;
        if (a === "l" || a === "d" || a === "k") risiken.push({ frage: f, bauteil: q.bauteil, grad: a, ansicht: v.id });
      });
    });
    var wsum = 0, cov = 0, pen = 0, pw = 0, list = [];
    Object.keys(comps).forEach(function (c) {
      var k = comps[c], tot = k.ansichten.length, ok = k.ansichten.filter(function (a) { return bewertbar(state.ansichten[a]); }).length;
      k.anteil = tot ? ok / tot : 0;
      k.sicht = k.anteil === 1 ? "ausreichend sichtbar" : k.anteil > 0 ? "teilweise sichtbar" : "nicht sichtbar";
      if (k.anteil === 0) k.sev = "u";
      k.umfang = ok + " von " + tot + " Ansicht" + (tot === 1 ? "" : "en") + " bewertbar";
      k.schwereText = KP.schwere[k.sev];
      if (k.w > 0) { wsum += k.w; cov += k.w * k.anteil; if (k.sev !== "u") { pen += k.w * PEN[k.sev]; pw += k.w; } }
      list.push(k);
    });
    var abdeckung = wsum ? cov / wsum : 0, gesamt;
    var krit = list.some(function (k) { return k.sev === "k"; });
    if (krit) gesamt = { status: "gesperrt", titel: "Gesamtklasse nicht vergeben", text: "Es besteht ein kritischer Strukturverdacht. Eine positive Zusammenfassung ist ausgeschlossen. Lassen Sie das Instrument vor einem Kauf von einem Fachmann prüfen." };
    else if (abdeckung < KP.minBewertbar) gesamt = { status: "teilbericht", titel: "Teilbericht", text: "Weniger als " + Math.round(KP.minBewertbar * 100) + " Prozent der gewichteten Ansichten waren bewertbar. Ein unbekannter Zustand bleibt unbekannt, deshalb gibt es keine Gesamtklasse." };
    else {
      var P = pw ? pen / pw : 0, kl = P < 0.1 ? "A" : P < 0.3 ? "B" : P < 0.55 ? "C" : "D";
      var t = { A: "Visuell weitgehend unauffällig", B: "Leichte visuelle Hinweise", C: "Deutliche visuelle Hinweise", D: "Erheblicher sichtbarer Verschleiß oder Mängel" }[kl];
      gesamt = { status: "klasse", klasse: kl, index: Math.round(P * 100) / 100, titel: "Visuelle Klasse " + kl + ": " + t, text: "Die Klasse beschreibt ausschließlich den sichtbaren Zustand der erfassten Bereiche. Gewichtung und Grenzen sind experimentell und noch nicht an Referenzfällen geprüft." };
    }
    risiken.sort(function (a, b) { return ORD[b.grad] - ORD[a.grad] || bt[b.bauteil].w - bt[a.bauteil].w; });
    var texte = risiken.map(function (r) {
      var q = KP.fragen[r.frage], c = comps[r.bauteil];
      return { grad: r.grad, bauteil: c.name, hinweis: (r.grad === "k" ? "Kritischer Verdacht: " : r.grad === "d" ? "Deutlicher Hinweis: " : "Leichter Hinweis: ") + q.beob + ". Erfasst: " + c.umfang + ". Ob Reparatur oder Austausch nötig ist, wurde nicht festgestellt.", frage: q.verk, belege: c.belege };
    });
    var offen = list.filter(function (k) { return k.anteil < 1 && k.w > 0; }).map(function (k) { return k.name + ": " + k.sicht + " (" + k.umfang + ")"; });
    return { bauform: state.bauform, region: state.region, identitaet: state.identitaet || {}, dauerSek: state.dauerSek || 0,
      bauteile: list, abdeckung: Math.round(abdeckung * 100) / 100, gesamt: gesamt, risiken: texte, offen: offen, nichtGeprueft: KP.nichtGeprueft, version: KP.version };
  };

  if (typeof module !== "undefined") module.exports = E; else root.KPEngine = E;
})(typeof self !== "undefined" ? self : this);
