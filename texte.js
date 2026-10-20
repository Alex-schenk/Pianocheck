/* Klavierprüfung: Inhalte (Bauteile, Aufnahmeschritte, Fragen, Texte).
   Hier können Sie Texte, Fragen und Gewichte ändern, ohne Programmierkenntnisse. */
(function (root) {
  var KP = {};
  KP.version = { schema: "1.0", regeln: "0.1-experimentell" };
  KP.bauformen = { klavier: "Klavier (aufrecht)", fluegel: "Flügel" };
  KP.regionen = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", NL: "Niederlande", BE: "Belgien", FR: "Frankreich", IT: "Italien", ES: "Spanien", GB: "Vereinigtes Königreich", US: "USA", XX: "Andere Region" };

  /* Gewichte w (Prozent) für den visuellen Verschleißindex. Annahme aus dem Konzept, noch nicht validiert. */
  KP.bauteile = {
    haemmer:       { name: "Hammerköpfe und Filz", w: 30, grenze: "Keine Restlebensdauer und keine Beurteilung von Klang oder Filzhärte." },
    mechanik:      { name: "Sichtbare Mechanik", w: 25, grenze: "Ursache, Regulierung, Achsreibung und Repetition bleiben teilweise ungeklärt." },
    tasten:        { name: "Tastatur", w: 20, grenze: "Kein verlässlicher Nachweis von Anschlagsgewicht, Reibung oder Funktion aller Tasten." },
    saiten:        { name: "Saiten und Wirbelbereich", w: 10, grenze: "Wirbelfestigkeit und Stimmhaltung sind aus dem Bild nicht nachgewiesen." },
    pedale:        { name: "Pedale und Gestänge", w: 10, grenze: "Keine vollständige Funktionsbestätigung der Klangwirkung." },
    gehaeuse:      { name: "Gehäuse", w: 5, grenze: "Äußerer Eindruck; keine Aussage zur inneren Substanz." },
    daempfer:      { name: "Dämpfer", w: 0, grenze: "Dämpfwirkung und Nachklang können ohne Ton nicht geprüft werden." },
    resonanzboden: { name: "Resonanzboden und Stege", w: 0, grenze: "Nicht jeder Riss ist ein Funktionsschaden; Tragweite und verdeckte Bereiche bleiben offen." },
    rahmen:        { name: "Gussrahmen", w: 0, grenze: "Keine Bestätigung der gesamten strukturellen Integrität." }
  };

  /* Fragen: kritisch = ein deutlicher Hinweis gilt als kritischer Verdacht und sperrt eine positive Gesamtklasse. */
  KP.fragen = {
    c1: { bauteil: "gehaeuse", text: "Beschädigungen, Risse oder abgeplatzte Oberfläche am Gehäuse", beob: "Beschädigungen oder Risse am Gehäuse", verk: "Gab es Schäden oder Reparaturen am Gehäuse?" },
    c2: { bauteil: "gehaeuse", text: "Wasserflecken, Aufquellungen oder Verfärbungen", beob: "Wasserflecken oder Aufquellungen", verk: "War das Instrument Feuchtigkeit ausgesetzt?" },
    r1: { bauteil: "resonanzboden", kritisch: true, text: "Risse, Ablösungen oder verdächtige Linien am Resonanzboden oder an den Stegen (nur soweit sichtbar)", beob: "Linien oder Risse am Resonanzboden bzw. an den Stegen", verk: "Sind Risse am Resonanzboden bekannt oder wurde er repariert?" },
    g1: { bauteil: "rahmen", kritisch: true, text: "Risse oder Brüche im Gussrahmen", beob: "Rissverdacht im Gussrahmen", verk: "Gab es einen Transportschaden oder Sturz?" },
    g2: { bauteil: "rahmen", text: "Feuchtigkeitsspuren, Rostflecken oder Schimmel im Innenraum", beob: "Feuchtigkeitsspuren im Innenraum", verk: "Wurde das Instrument feucht gelagert?" },
    h1: { bauteil: "haemmer", text: "Tiefe Rillen im Filz der Hammerköpfe", beob: "Rillen im Filz der Hammerköpfe", verk: "Wann wurden die Hämmer zuletzt abgezogen oder erneuert?" },
    h2: { bauteil: "haemmer", text: "Fehlende, lose oder stark verformte Hammerköpfe", beob: "fehlende oder verformte Hammerköpfe", verk: "Wurden Hammerköpfe ersetzt oder repariert?" },
    h3: { bauteil: "haemmer", text: "Auffällig ungleichmäßige Abnutzung benachbarter Hämmer", beob: "ungleichmäßige Abnutzung der Hämmer", verk: "Wurde die Mechanik zuletzt reguliert und intoniert?" },
    m1: { bauteil: "mechanik", text: "Fehlende Teile oder Fehlstellungen (schief stehende oder hängende Teile)", beob: "Fehlteile oder Fehlstellungen in der Mechanik", verk: "Wurde die Mechanik zuletzt gewartet oder reguliert?" },
    m2: { bauteil: "mechanik", text: "Gebrochene oder lose wirkende Teile", beob: "gebrochene oder lose Teile in der Mechanik", verk: "Gab es Reparaturen an der Mechanik?" },
    d1: { bauteil: "daempfer", text: "Dämpfer sichtbar schief oder nicht anliegend", beob: "schief stehende Dämpfer", verk: "Funktionieren alle Dämpfer?" },
    t1: { bauteil: "tasten", text: "Beschädigte oder fehlende Tastenbeläge", beob: "beschädigte Tastenbeläge", verk: "Wurden Tastenbeläge ersetzt?" },
    t2: { bauteil: "tasten", text: "Auffällige Höhenunterschiede oder unregelmäßige Abstände zwischen Tasten", beob: "Höhen- oder Abstandsunterschiede an Tasten", verk: "Wurde die Klaviatur zuletzt reguliert?" },
    s1: { bauteil: "saiten", text: "Sichtbarer Rost oder Korrosion an Saiten oder Wirbeln", beob: "Rost an Saiten oder Wirbeln", verk: "Hält das Instrument die Stimmung, und wann wurde zuletzt gestimmt?" },
    s2: { bauteil: "saiten", text: "Fehlende oder gerissene Saiten", beob: "fehlende oder gerissene Saiten", verk: "Wurden Saiten ersetzt?" },
    p1: { bauteil: "pedale", text: "Fehlende Teile oder sichtbar lose Verbindungen an Pedalen und Gestänge", beob: "Fehlteile oder lose Verbindungen an den Pedalen", verk: "Funktionieren alle Pedale einwandfrei?" }
  };

  /* Aufnahmeschritte (Reihenfolge = Ablauf in etwa fünf Minuten) */
  KP.ansichten = [
    { id: "aussen", titel: "Instrument außen", fragen: ["c1", "c2"],
      text: { klavier: "Treten Sie 2 bis 3 Meter zurück. Front, Seiten und Gehäuse sollen im Bild sein.", fluegel: "Gesamtansicht bei geschlossenem Deckel von der Spielerseite, etwa 3 bis 4 Meter Abstand." } },
    { id: "schild", titel: "Marke, Modell und Seriennummer", identitaet: true, fragen: [],
      text: { klavier: "Zeigen Sie Markenschriftzug, Typenschild oder Seriennummer groß und lesbar. Die Nummer steht oft auf dem Gussrahmen im Inneren oder an der Rückseite.", fluegel: "Zeigen Sie Markenschriftzug oder Seriennummer groß und lesbar. Bei Flügeln steht die Nummer meist auf dem Gussrahmen im Inneren." } },
    { id: "innen", titel: "Innenübersicht", fragen: ["r1", "g1", "g2"],
      text: { klavier: "Öffnen Sie den oberen Deckel und, wenn es einfach geht, die Vorderwand. Zeigen Sie den gesamten Innenraum von oben.", fluegel: "Öffnen Sie den Deckel und sichern Sie ihn mit der Stütze. Zeigen Sie den Innenraum schräg von der Seite." } },
    { id: "haemmer", titel: "Hammerbereich", fragen: ["h1", "h2", "h3"],
      text: { klavier: "Schräg von vorn auf die Hammerköpfe im mittleren Register, scharf und gut beleuchtet. Eine Lampe von der Seite hilft.", fluegel: "Soweit einsehbar: von der Seite auf die Hammerköpfe. Ist der Bereich verdeckt, wählen Sie „Nicht zugänglich“. Bauen Sie nichts aus." } },
    { id: "mechanik", titel: "Zugängliche Mechanik und Dämpfer", fragen: ["m1", "m2", "d1"],
      text: { klavier: "Zugängliche Mechanik und Dämpfer leicht von der Seite und von oben zeigen. Nichts ausbauen.", fluegel: "Soweit einsehbar: Mechanik und Dämpfer von der Seite. Ist die Mechanik verdeckt, wählen Sie „Nicht zugänglich“." } },
    { id: "tasten", titel: "Tastatur", fragen: ["t1", "t2"],
      text: { klavier: "Tastatur von vorn, leicht von oben, alle Tasten im Bild.", fluegel: "Tastatur von vorn, leicht von oben, alle Tasten im Bild." } },
    { id: "taste_bass", titel: "Tastatur: Bassbereich (Stichprobe)", fragen: ["t1", "t2"], stichprobe: true,
      text: { klavier: "Nahaufnahme der linken Tasten (Bass), möglichst scharf.", fluegel: "Nahaufnahme der linken Tasten (Bass), möglichst scharf." } },
    { id: "taste_mitte", titel: "Tastatur: Mittelbereich (Stichprobe)", fragen: ["t1", "t2"], stichprobe: true,
      text: { klavier: "Nahaufnahme der mittleren Tasten, möglichst scharf.", fluegel: "Nahaufnahme der mittleren Tasten, möglichst scharf." } },
    { id: "taste_diskant", titel: "Tastatur: Diskantbereich (Stichprobe)", fragen: ["t1", "t2"], stichprobe: true,
      text: { klavier: "Nahaufnahme der rechten Tasten (Diskant), möglichst scharf.", fluegel: "Nahaufnahme der rechten Tasten (Diskant), möglichst scharf." } },
    { id: "saiten", titel: "Saiten und Wirbelbereich", fragen: ["s1", "s2"],
      text: { klavier: "Saitenbereich und Stimmwirbel von oben zeigen, auf Rost und fehlende Saiten achten.", fluegel: "Saiten und Wirbelbereich von oben zeigen, auf Rost und fehlende Saiten achten." } },
    { id: "pedale", titel: "Pedale und Gestänge", fragen: ["p1"],
      text: { klavier: "Die Pedale von vorn zeigen, möglichst mit sichtbarer Verbindung nach oben.", fluegel: "Pedale und Pedallyra von vorn zeigen." } }
  ];

  KP.antworten = { u: "Kann ich nicht beurteilen", n: "Nichts auffällig", l: "Leicht", d: "Deutlich" };
  KP.schwere = { u: "Nicht bewertbar", n: "Kein auffälliger Befund im sichtbaren Bereich", l: "Leichter Hinweis", d: "Deutlicher Hinweis", k: "Kritischer Verdacht" };
  KP.nichtGeprueft = [
    "Klang, Stimmhaltung und Spielgefühl (rein visuelle Prüfung, kein Ton)",
    "Anschlagsgewicht, Reibung und Funktion aller 88 Tasten",
    "Verdeckte Schäden und nicht einsehbare Bauteile",
    "Wirbelfestigkeit, Dämpfwirkung und Nachklang"
  ];
  KP.q = { schaerfeOk: 45, schaerfeGut: 100, hellMin: 60, hellMax: 210, glanzMax: 0.05 };
  KP.zielSekunden = 300;
  KP.minBewertbar = 0.8;

  if (typeof module !== "undefined") module.exports = KP; else root.KP = KP;
})(typeof self !== "undefined" ? self : this);
