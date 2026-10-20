/* Klavierprüfung: Oberfläche (Aufnahmeführung, Bildprüfung, Bericht). */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var CFG = window.KPCFG || {}, V = KP.ansichten, LS = "kp-state-v1", TK = "kp-token";
  var INFO = { zugang: "offen", ki: false, abdeckung: {}, demo: false }, S = null, HI = {}, stream = null, loopT = null, good = 0, timerT = null, token = null, credits = null, busy = false;
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  function uid() { var a = new Uint8Array(12); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < 12; i++) a[i] = Math.random() * 256; return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function view(id) { return V.filter(function (v) { return v.id === id; })[0]; }
  function fmtT(s) { return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function eur(n) { return Number(n).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €"; }
  function show(id) { ["start", "capture", "check", "report"].forEach(function (s) { $(s).hidden = s !== id; }); window.scrollTo(0, 0); }

  /* ---------- Server ---------- */
  async function api(file, data, get) {
    var r, j, o = get ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ token: token }, data || {})) };
    try { r = await fetch("api/" + file, o); } catch (e) { var n = new Error("Keine Verbindung zum Server."); n.code = "network"; throw n; }
    try { j = await r.json(); } catch (e) { j = null; }
    if (!j || !j.ok) { var x = new Error((j && j.message) || "Der Server hat nicht wie erwartet geantwortet."); x.code = (j && j.error) || "server"; throw x; }
    return j;
  }
  function save() { if (S) lsSet(LS, JSON.stringify(S)); }
  function newState() {
    var a = {}; V.forEach(function (v) { a[v.id] = { status: "offen", antworten: {} }; });
    return { sid: uid(), bauform: "klavier", region: "DE", t0: 0, idx: 0, mode: "cam", ansichten: a, identitaet: { marke: "", modell: "", seriennummer: "", baujahr: "", baujahrGeschaetzt: false }, fertig: false };
  }

  /* ---------- Startseite ---------- */
  function covText() {
    var r = (INFO.abdeckung[S.region] || {})[S.bauform], st = r ? r.status : "keine";
    var t = { gut: "Für diese Region liegen Vergleichsdaten vor. Ob für Ihr Modell ein Preisintervall möglich ist, wird im Bericht geprüft.", teilweise: "Für diese Region gibt es nur wenige Vergleichsdaten. Ein Preisintervall ist nur für einzelne Modelle möglich.", keine: "Für diese Region ist derzeit keine belastbare Preisorientierung verfügbar. Die visuelle Prüfung funktioniert trotzdem." }[st];
    return '<p class="kp-cov ' + st + '"><b>Preisorientierung:</b> ' + t + (INFO.demo ? " <b>(Demodaten aktiv)</b>" : "") + "</p>";
  }
  function drawStart() {
    var saved = lsGet(LS), sv = null; try { sv = saved ? JSON.parse(saved) : null; } catch (e) {}
    var gate = INFO.zugang === "digistore" && !token;
    var h = '<div class="kp-card"><h2>Klavier oder Flügel prüfen</h2><p>Geführte Sichtprüfung in etwa fünf Minuten: Sie fotografieren die wichtigsten Bereiche, die App prüft die Bildqualität, sammelt Befunde mit Bildbeleg und erstellt einen Bericht. Geprüft wird <b>nur, was sichtbar ist</b>. Klang, Stimmhaltung und Spielgefühl sind nicht Teil der Prüfung.</p>';
    h += '<label class="kp-l">Bauform</label><div class="kp-seg" id="selForm">' + Object.keys(KP.bauformen).map(function (k) { return '<button type="button" data-act="form" data-v="' + k + '" class="' + (S.bauform === k ? "on" : "") + '">' + KP.bauformen[k] + "</button>"; }).join("") + "</div>";
    h += '<label class="kp-l" for="selReg">Verkaufsregion des Instruments</label><select id="selReg" class="kp-f">' + Object.keys(KP.regionen).map(function (k) { return '<option value="' + k + '"' + (S.region === k ? " selected" : "") + ">" + KP.regionen[k] + "</option>"; }).join("") + "</select>";
    h += covText();
    if (gate) {
      h += '<hr><h3>Zugang</h3><p>Melden Sie sich mit der <b>Bestell-ID</b> und der <b>E-Mail-Adresse</b> Ihrer Digistore24-Bestellung an.</p><label class="kp-l" for="oid">Bestell-ID</label><input class="kp-f" id="oid" autocomplete="off"><label class="kp-l" for="mail">E-Mail-Adresse</label><input class="kp-f" id="mail" type="email"><button class="kp-b" data-act="login" type="button">Anmelden</button><div class="kp-err" id="loginMsg"></div>';
      h += '<p class="kp-s">Noch kein Zugang? ' + ["einzel", "paket"].map(function (k) { var l = (CFG.kauf || {})[k]; return l ? '<a class="kp-b alt" href="' + esc(l) + '" target="_blank" rel="noopener">' + (k === "einzel" ? "Einzelprüfung" : "3er-Paket") + " " + esc((CFG.preise || {})[k] || "") + "</a> " : '<span class="kp-s">' + (k === "einzel" ? "Einzelprüfung" : "3er-Paket") + ': bald erhältlich. </span>'; }).join("") + "</p>";
    } else {
      h += '<label class="kp-c"><input type="checkbox" id="cons"> <span>Ich habe verstanden, dass nur sichtbare Bereiche beurteilt werden. ' + (INFO.ki ? "Mit KI-Unterstützung werden einzelne Bilder zur Auswertung an einen KI-Dienst übertragen. " : "") + 'Bitte keine Personen filmen. <a href="../datenschutz.html" target="_blank" rel="noopener">Datenschutz</a></span></label>';
      h += '<button class="kp-b big" data-act="start" type="button">Prüfung starten</button>';
      if (INFO.zugang === "digistore" && credits != null) h += '<p class="kp-s">Verfügbare Prüfungen: <b>' + credits + "</b></p>";
      if (sv && !sv.fertig && sv.t0) h += '<button class="kp-b alt" data-act="resume" type="button">Gespeicherte Prüfung fortsetzen (' + esc(KP.bauformen[sv.bauform]) + ")</button>";
    }
    h += '<div class="kp-err" id="startMsg"></div></div>';
    $("start").innerHTML = h;
    var sr = $("selReg"); if (sr) sr.onchange = function () { S.region = sr.value; drawStart(); };
  }

  /* ---------- Kamera und Bildprüfung ---------- */
  function stopCam() { clearTimeout(loopT); if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  function canvasOf(src, w, h, max) { var s = Math.min(1, max / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s)); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height); return c; }
  function grayOf(c) { var d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, g = new Uint8ClampedArray(n); for (var i = 0; i < n; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; return { d: g, w: c.width, h: c.height }; }
  async function startCam() {
    if (stream || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false }); } catch (e) { var q = $("q"); if (q) { q.textContent = "Kamera nicht verfügbar. Bitte „Foto wählen“ nutzen."; q.className = "kp-q schlecht"; } return; }
    var v = $("vid"); if (!v) { stopCam(); return; } v.srcObject = stream; try { await v.play(); } catch (e) {} good = 0; camLoop();
  }
  function camLoop() {
    if (!stream) return; var v = $("vid"), q = $("q");
    if (v && v.videoWidth && q) {
      var g = grayOf(canvasOf(v, v.videoWidth, v.videoHeight, 240)), r = KPEngine.qualitaet(g.d, g.w, g.h);
      q.textContent = r.urteil === "gut" ? "Scharf und hell genug. Bitte ruhig halten." : (r.hinweise[0] || "Bitte Bildausschnitt anpassen."); q.className = "kp-q " + r.urteil;
      if (r.urteil === "gut") { good++; if (good >= 3 && $("auto") && $("auto").checked) { ingest(v, v.videoWidth, v.videoHeight); return; } } else good = 0;
    }
    loopT = setTimeout(camLoop, 400);
  }
  function ingest(src, w, h) {
    var id = V[S.idx].id, big = canvasOf(src, w, h, 1280), g = grayOf(canvasOf(big, big.width, big.height, 320)), q = KPEngine.qualitaet(g.d, g.w, g.h);
    var a = S.ansichten[id]; a.status = "erfasst"; a.qualitaet = q; a.antworten = {}; a.ki = false;
    a.thumb = canvasOf(big, big.width, big.height, 480).toDataURL("image/jpeg", 0.7);
    HI[id] = canvasOf(big, big.width, big.height, 1024).toDataURL("image/jpeg", 0.75).split(",")[1];
    stopCam(); S.mode = "review"; save(); drawCapture();
    if (INFO.ki && token && q.urteil !== "schlecht") aiAnalyse(id);
  }
  function fromFile(f) { var r = new FileReader(); r.onload = function () { var im = new Image(); im.onload = function () { ingest(im, im.width, im.height); }; im.src = r.result; }; r.readAsDataURL(f); }
  async function aiAnalyse(id) {
    var a = S.ansichten[id]; a.aiPending = true; drawCapture();
    try {
      var j = await api("analyse.php", { sid: S.sid, ansicht: id, bauform: S.bauform, image: HI[id] });
      Object.keys(j.antworten || {}).forEach(function (f) { a.antworten[f] = j.antworten[f]; }); a.ki = true;
      var i = j.identitaet || {}; if (i.marke && !S.identitaet.marke) S.identitaet.marke = i.marke; if (i.modell && !S.identitaet.modell) S.identitaet.modell = i.modell; if (i.seriennummer && !S.identitaet.seriennummer) S.identitaet.seriennummer = i.seriennummer; if (i.baujahr && !S.identitaet.baujahr) { S.identitaet.baujahr = i.baujahr; S.identitaet.baujahrGeschaetzt = true; }
    } catch (e) { a.aiFehler = e.message; }
    a.aiPending = false; save(); if (S.idx !== undefined && V[S.idx] && V[S.idx].id === id) drawCapture();
  }

  /* ---------- Aufnahmeschritte ---------- */
  function tick() { if (!S || !S.t0) return; var s = Math.round((Date.now() - S.t0) / 1000), el = $("timer"); if (el) { el.textContent = fmtT(s) + " / " + fmtT(KP.zielSekunden); el.className = s > KP.zielSekunden ? "over" : ""; } }
  function drawCapture() {
    var v = V[S.idx], a = S.ansichten[v.id], n = V.length;
    var h = '<div class="kp-top"><span id="timer"></span><span>Schritt ' + (S.idx + 1) + " von " + n + "</span></div>";
    h += '<div class="kp-chips">' + V.map(function (x, i) { var st = S.ansichten[x.id], c = st.status === "erfasst" ? (KPEngine.bewertbar(st) ? "done" : "part") : st.status === "unzugaenglich" ? "skip" : ""; return '<button type="button" data-act="go" data-i="' + i + '" class="kp-chip ' + c + (i === S.idx ? " cur" : "") + '">' + (i + 1) + "</button>"; }).join("") + "</div>";
    h += '<div class="kp-card"><h2>' + esc(v.titel) + "</h2><p>" + esc(v.text[S.bauform]) + "</p>";
    if (S.mode === "cam" || a.status === "offen" || a.status === "unzugaenglich") {
      var cam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (a.status === "unzugaenglich") h += '<p class="kp-s"><b>Als nicht zugänglich markiert.</b> Dieser Bereich bleibt im Bericht unbekannt.</p>';
      if (cam) h += '<div class="kp-cam"><video id="vid" playsinline muted autoplay></video><div class="kp-q" id="q">Kamera startet …</div></div><div class="kp-row"><button class="kp-b" type="button" data-act="shot">Aufnehmen</button><label class="kp-c small"><input type="checkbox" id="auto" checked> Automatisch auslösen</label></div>';
      h += '<div class="kp-row"><label class="kp-b alt">Foto wählen<input type="file" accept="image/*" capture="environment" id="fin" hidden></label><button class="kp-b alt" type="button" data-act="skip">Nicht zugänglich</button></div>';
    } else {
      var q = a.qualitaet || {};
      h += '<div class="kp-rev"><img src="' + a.thumb + '" alt="Aufnahme"><div><p class="kp-qv ' + q.urteil + '"><b>Bildqualität: ' + ({ gut: "gut", mittel: "ausreichend", schlecht: "nicht ausreichend" }[q.urteil]) + "</b></p>" + ((q.hinweise || []).length ? "<p class=\"kp-s\">" + esc(q.hinweise.join("; ")) + "</p>" : "") + '<button class="kp-b alt" type="button" data-act="retake">Neu aufnehmen</button></div></div>';
      if (q.urteil === "schlecht") h += '<p class="kp-err">Diese Aufnahme kann nicht bewertet werden. Bitte neu aufnehmen oder den Bereich weiterhin als unbekannt lassen.</p>';
      else if (v.identitaet) {
        var I = S.identitaet;
        h += '<p class="kp-s">Bitte lesen Sie die Angaben vom Instrument ab und bestätigen Sie sie. Unsichere Angaben leer lassen.' + (a.ki ? " Werte aus dem KI-Vorschlag bitte prüfen." : "") + '</p><label class="kp-l" for="i_marke">Marke</label><input class="kp-f" id="i_marke" data-id="marke" value="' + esc(I.marke) + '"><label class="kp-l" for="i_modell">Modell</label><input class="kp-f" id="i_modell" data-id="modell" value="' + esc(I.modell) + '"><label class="kp-l" for="i_sn">Seriennummer</label><input class="kp-f" id="i_sn" data-id="seriennummer" value="' + esc(I.seriennummer) + '"><label class="kp-l" for="i_bj">Baujahr (falls bekannt)</label><input class="kp-f" id="i_bj" data-id="baujahr" inputmode="numeric" value="' + esc(I.baujahr) + '"><label class="kp-c small"><input type="checkbox" data-id="baujahrGeschaetzt"' + (I.baujahrGeschaetzt ? " checked" : "") + "> Baujahr ist nur geschätzt</label>";
      } else {
        if (a.aiPending) h += '<p class="kp-s">KI-Vorschlag wird erstellt …</p>'; else if (a.ki) h += '<p class="kp-s"><b>KI-Vorschlag.</b> Bitte jede Antwort prüfen und bei Bedarf ändern.</p>'; else if (a.aiFehler) h += '<p class="kp-s">KI-Vorschlag nicht verfügbar. Bitte selbst beantworten.</p>';
        h += '<p class="kp-s">Was ist auf dieser Aufnahme zu sehen? Wählen Sie „Kann ich nicht beurteilen“, wenn Sie unsicher sind.</p>' + v.fragen.map(function (f) { var q = KP.fragen[f]; return '<div class="kp-qq"><div>' + esc(q.text) + '</div><div class="kp-seg" data-f="' + f + '">' + ["u", "n", "l", "d"].map(function (k) { return '<button type="button" data-act="ans" data-f="' + f + '" data-a="' + k + '" class="' + ((a.antworten[f] || "u") === k ? "on " : "") + "a" + k + '">' + KP.antworten[k] + "</button>"; }).join("") + "</div></div>"; }).join("");
      }
    }
    h += '<div class="kp-row nav"><button class="kp-b alt" type="button" data-act="prev"' + (S.idx === 0 ? " disabled" : "") + '>Zurück</button><button class="kp-b" type="button" data-act="next">' + (S.idx === n - 1 ? "Zur Kontrolle" : "Weiter") + "</button></div></div>";
    $("capture").innerHTML = h; tick();
    var fi = $("fin"); if (fi) fi.onchange = function () { if (fi.files[0]) fromFile(fi.files[0]); };
    if (S.mode === "cam" && a.status !== "erfasst") startCam();
  }
  function go(i) { stopCam(); S.idx = Math.max(0, Math.min(V.length - 1, i)); var a = S.ansichten[V[S.idx].id]; S.mode = a.status === "erfasst" ? "review" : "cam"; save(); drawCapture(); }
  function drawCheck() {
    var h = '<div class="kp-card"><h2>Kontrolle vor dem Bericht</h2><p>Hier sehen Sie, welche Bereiche bewertbar sind. Fehlende Bereiche bleiben im Bericht „unbekannt“. Sie können jederzeit nachfotografieren.</p><ul class="kp-list">';
    V.forEach(function (v, i) { var a = S.ansichten[v.id], ok = v.identitaet ? (a.status === "erfasst" && a.qualitaet.urteil !== "schlecht") : KPEngine.bewertbar(a), t = (v.identitaet && ok) ? "Angaben erfasst" : a.status === "unzugaenglich" ? "als nicht zugänglich markiert" : a.status !== "erfasst" ? "nicht aufgenommen" : a.qualitaet.urteil === "schlecht" ? "Aufnahme nicht ausreichend" : ok ? "bewertbar" : "keine Aussage beantwortet"; h += '<li class="' + (ok ? "ok" : "no") + '"><span>' + esc(v.titel) + ": " + t + '</span><button class="kp-b alt s" type="button" data-act="go" data-i="' + i + '">' + (ok ? "Ansehen" : "Nachholen") + "</button></li>"; });
    h += '</ul><button class="kp-b big" type="button" data-act="finish">Bericht erstellen</button><div class="kp-err" id="finMsg"></div></div>';
    $("check").innerHTML = h;
  }

  /* ---------- Bericht ---------- */
  var RCSS = "";
  function reportHTML(r, srv, exp) {
    var I = r.identitaet || {}, d = srv && srv.erfasst_am ? new Date(srv.erfasst_am) : new Date(), h = '<div class="kp-rep">';
    h += "<h1>Klavierprüfung – Bericht</h1><p class=\"kp-s\">Erfasst am " + d.toLocaleDateString("de-DE") + " · " + esc(KP.bauformen[r.bauform]) + " · Region " + esc(KP.regionen[r.region]) + " · Prüfdauer " + fmtT(r.dauerSek) + " (Ziel " + fmtT(KP.zielSekunden) + ") · Regeln " + esc(r.version.regeln) + "</p>";
    h += '<div class="kp-card"><h2>Instrument</h2><p>' + (I.marke ? "<b>Marke:</b> " + esc(I.marke) + " " : "<b>Marke:</b> nicht bestätigt ") + (I.modell ? "· <b>Modell:</b> " + esc(I.modell) + " " : "") + (I.seriennummer ? "· <b>Seriennummer:</b> " + esc(I.seriennummer) + " " : "") + (I.baujahr ? "· <b>Baujahr:</b> " + esc(I.baujahr) + (I.baujahrGeschaetzt ? " (geschätzt)" : " (angegeben)") : "· Baujahr nicht belegt") + "</p></div>";
    h += '<div class="kp-card g-' + r.gesamt.status + '"><h2>Kurzeinschätzung</h2><p class="kp-big">' + esc(r.gesamt.titel) + "</p><p>" + esc(r.gesamt.text) + '</p><p class="kp-s">Auswertbare gewichtete Ansichten: <b>' + Math.round(r.abdeckung * 100) + " %</b>. Ein unbekannter Zustand bleibt unbekannt.</p></div>";
    h += '<div class="kp-card"><h2>Bauteilübersicht</h2><div class="kp-tw"><table><thead><tr><th>Bauteil</th><th>Zustand</th><th>Sichtbarkeit</th><th>Beleg</th><th>Grenze der Aussage</th></tr></thead><tbody>' + r.bauteile.map(function (b) { var th = b.belege.map(function (id) { var a = S.ansichten[id]; return a && a.thumb ? '<img src="' + a.thumb + '" alt="Beleg ' + esc(view(id).titel) + '">' : ""; }).join(""); return '<tr><td><b>' + esc(b.name) + '</b></td><td class="s-' + b.sev + '">' + esc(b.schwereText) + "</td><td>" + esc(b.sicht) + "<br><small>" + esc(b.umfang) + "</small></td><td>" + (th || "–") + "</td><td><small>" + esc(b.grenze) + "</small></td></tr>"; }).join("") + "</tbody></table></div></div>";
    h += '<div class="kp-card"><h2>Erkannte Risiken</h2>' + (r.risiken.length ? "<ol>" + r.risiken.map(function (x) { return '<li class="s-' + x.grad + '"><b>' + esc(x.bauteil) + ".</b> " + esc(x.hinweis) + "<br><small><b>Frage an den Verkäufer:</b> " + esc(x.frage) + "</small></li>"; }).join("") + "</ol>" : "<p>Im erfassten Umfang wurden keine Auffälligkeiten angegeben. Das schließt Auffälligkeiten in nicht erfassten Bereichen nicht aus.</p>") + "</div>";
    h += '<div class="kp-card"><h2>Offene Bereiche</h2>' + (r.offen.length ? "<ul>" + r.offen.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>Alle gewichteten Bauteile wurden im vorgesehenen Umfang erfasst.</p>") + "<p><b>Grundsätzlich nicht geprüft:</b></p><ul>" + r.nichtGeprueft.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    h += '<div class="kp-card"><h2>Preisorientierung</h2>' + priceHTML(srv) + "<p class=\"kp-s\">Eine günstige Preisposition hebt einen technischen Verdacht nicht auf. Die Klasse wird nicht als Preisfaktor verwendet.</p></div>";
    h += '<div class="kp-card"><h2>Zusätzliche Kosten</h2><p>Transport und erste Wartung werden nicht pauschal geschätzt. Holen Sie dafür konkrete Angebote ein. Verdeckte Schäden erhalten keine erfundene Reparatursumme.</p></div>';
    h += '<p class="kp-s">Unverbindliche Ersteinschätzung anhand von Aufnahmen und Angaben des Nutzers. Kein Gutachten und keine Begutachtung vor Ort. Erstellt mit der Klavierprüfung von ' + esc(CFG.firma || "") + ".</p>";
    if (!exp) h += '<div class="kp-row noprint"><button class="kp-b" type="button" data-act="print">Drucken / als PDF speichern</button><button class="kp-b alt" type="button" data-act="export">Bericht als Datei speichern</button>' + (CFG.kontakt ? '<a class="kp-b alt" href="' + esc(CFG.kontakt) + '" target="_blank" rel="noopener">Begutachtung vor Ort anfragen</a>' : "") + '<button class="kp-b alt" type="button" data-act="neu">Neue Prüfung</button></div>';
    return h + "</div>";
  }
  function priceHTML(srv) {
    if (!srv) return "<p><b>Preisdienst nicht erreichbar.</b> Der Bericht enthält deshalb keine Preisorientierung.</p>";
    var p = srv.preis; if (!p) return "<p>Preis derzeit nicht belastbar bestimmbar.</p>";
    var hd = p.demo ? '<p class="kp-err"><b>Demodaten:</b> Diese Werte sind erfunden und nur zum Testen.</p>' : "";
    if (p.status === "keine") return hd + "<p><b>Preis derzeit nicht belastbar bestimmbar.</b> " + esc(p.grund || "") + "</p>";
    return hd + (p.gruppen || []).map(function (g) { return '<div class="kp-price"><div class="kp-s">' + esc(g.label) + (g.hauptgruppe ? "" : " (nur Orientierung)") + '</div><div class="kp-big">' + eur(g.von) + " bis " + eur(g.bis) + '</div><div class="kp-s">80-Prozent-Intervall · Mittelwert der Vergleiche (Median) ' + eur(g.median) + " · " + g.n + " Vergleiche · Stand " + esc(g.stichtag) + "</div><p class=\"kp-s\">" + esc(g.hinweis) + "</p></div>"; }).join("") + ((p.notizen || []).length ? '<p class="kp-s">' + p.notizen.map(esc).join(" ") + "</p>" : "");
  }
  async function finish() {
    if (busy) return; busy = true; $("finMsg").textContent = "";
    S.dauerSek = Math.round((Date.now() - S.t0) / 1000);
    var r = KPEngine.bewerte(S), srv = null;
    try { srv = await api("bericht.php", { sid: S.sid, bauform: S.bauform, region: S.region, marke: S.identitaet.marke, modell: S.identitaet.modell, baujahr: S.identitaet.baujahr, klasse: r.gesamt.klasse || "" }); }
    catch (e) {
      if (INFO.zugang === "digistore" || e.code === "no_credits" || e.code === "unauthorized" || e.code === "expired") { $("finMsg").textContent = e.message + (e.code === "unauthorized" ? " Bitte melden Sie sich neu an." : ""); busy = false; return; }
      srv = null;
    }
    if (srv && srv.credits_left != null) credits = srv.credits_left;
    S.fertig = true; save(); clearInterval(timerT); stopCam();
    $("report").innerHTML = reportHTML(r, srv, false); window.__bericht = { r: r, srv: srv }; show("report"); busy = false;
  }
  async function exportHTML() {
    try { RCSS = RCSS || await (await fetch("style.css")).text(); } catch (e) {}
    var b = window.__bericht, html = '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Klavierprüfung Bericht</title><style>' + RCSS + " body{background:#fff}</style></head><body><main class=\"kp-main\">" + reportHTML(b.r, b.srv, true) + "</main></body></html>";
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = "klavierpruefung-bericht.html"; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Aktionen ---------- */
  async function startCapture(resume) {
    var m = $("startMsg"); m.textContent = "";
    if (!resume) {
      if (!$("cons").checked) { m.textContent = "Bitte bestätigen Sie zuerst den Hinweis."; return; }
      var keep = { bauform: S.bauform, region: S.region }; S = newState(); S.bauform = keep.bauform; S.region = keep.region; HI = {};
    }
    try { var j = await api("start.php", { sid: S.sid }); if (j.credits_left != null) credits = j.credits_left; } catch (e) { if (e.code !== "network" || INFO.zugang === "digistore") { m.textContent = e.message; if (e.code === "unauthorized") { token = null; lsSet(TK, null); drawStart(); } return; } }
    if (!S.t0) S.t0 = Date.now(); clearInterval(timerT); timerT = setInterval(tick, 1000);
    S.mode = "cam"; save(); show("capture"); go(S.idx || 0);
  }
  async function login() {
    var m = $("loginMsg"); m.textContent = "";
    try {
      var r = await fetch("api/login.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: $("oid").value, email: $("mail").value }) }), j = await r.json();
      if (!j.ok) throw new Error(j.message || "Anmeldung nicht möglich."); token = j.token; credits = j.credits_left; lsSet(TK, token); drawStart();
    } catch (e) { m.textContent = e.message || "Anmeldung nicht möglich."; }
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return; var a = t.dataset.act;
    if (a === "form") { S.bauform = t.dataset.v; drawStart(); }
    else if (a === "start") startCapture(false); else if (a === "resume") { try { S = JSON.parse(lsGet(LS)); startCapture(true); } catch (x) {} }
    else if (a === "login") login();
    else if (a === "go") { stopCam(); show("capture"); go(+t.dataset.i); }
    else if (a === "shot") { var v = $("vid"); if (v && v.videoWidth) ingest(v, v.videoWidth, v.videoHeight); }
    else if (a === "skip") { stopCam(); S.ansichten[V[S.idx].id] = { status: "unzugaenglich", antworten: {} }; save(); if (S.idx === V.length - 1) { drawCheck(); show("check"); } else go(S.idx + 1); }
    else if (a === "retake") { S.ansichten[V[S.idx].id] = { status: "offen", antworten: {} }; S.mode = "cam"; save(); drawCapture(); }
    else if (a === "ans") { var an = S.ansichten[V[S.idx].id]; an.antworten[t.dataset.f] = t.dataset.a; an.ki = false; save(); drawCapture(); }
    else if (a === "prev") go(S.idx - 1);
    else if (a === "next") { if (S.idx === V.length - 1) { stopCam(); drawCheck(); show("check"); } else go(S.idx + 1); }
    else if (a === "finish") finish(); else if (a === "print") window.print(); else if (a === "export") exportHTML();
    else if (a === "neu") { lsSet(LS, null); S = newState(); HI = {}; drawStart(); show("start"); }
  });
  document.addEventListener("input", function (e) { var t = e.target; if (t.dataset && t.dataset.id && S) { S.identitaet[t.dataset.id] = t.type === "checkbox" ? t.checked : t.value; save(); } });

  /* ---------- Start ---------- */
  (async function init() {
    S = newState(); token = lsGet(TK);
    try { var i = await api("info.php", null, true); INFO = i; } catch (e) {}
    if (token && INFO.zugang === "digistore") { try { var s = await api("status.php"); credits = s.credits_left; } catch (e) { token = null; lsSet(TK, null); } }
    drawStart(); show("start");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  })();
})();
