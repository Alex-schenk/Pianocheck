<?php
// Prüft Ihre Vergleichsdaten (api/daten/vergleiche.csv) auf Fehler und Widersprüche.
// Aufruf: daten-pruefen.php?key=IHR_ADMIN_KEY
require __DIR__ . '/_lib.php';
require __DIR__ . '/_preis.php';
rate('daten', 30, 900);
if (strlen((string)$CFG['admin_key']) < 24 || !hash_equals((string)$CFG['admin_key'], (string)($_GET['key'] ?? ''))) fail('forbidden', 'Kein Zugriff.', 403);
$f = __DIR__ . '/daten/vergleiche.csv';
if (!is_file($f)) fail('missing', 'Die Datei api/daten/vergleiche.csv fehlt.');
$h = fopen($f, 'r'); $head = fgetcsv($h, 0, ';');
$head = array_map(function ($x) { return strtolower(trim((string)preg_replace('/^\xEF\xBB\xBF/', '', (string)$x))); }, $head ?: []);
$need = ['quelle', 'nutzungsrecht', 'datum', 'region', 'waehrung', 'preisart', 'gebuehren_eur', 'bauform', 'marke', 'modellfamilie', 'groesse_cm', 'baujahr', 'zustandsklasse', 'arbeiten', 'preis_eur'];
$fehlt = array_values(array_diff($need, $head));
$issues = []; $n = 0; $seen = []; $zeile = 1; $reg = [];
$add = function ($z, $t) use (&$issues) { if (count($issues) < 80) $issues[] = "Zeile $z: $t"; };
if (!$fehlt) while (($r = fgetcsv($h, 0, ';')) !== false) {
    $zeile++; if (count($r) === 1 && trim($r[0]) === '') continue;
    if (count($r) !== count($head)) { $add($zeile, 'Spaltenzahl stimmt nicht (Semikolon im Text?)'); continue; }
    $x = array_combine($head, array_map('trim', $r)); $n++;
    $p = (float)str_replace(',', '.', $x['preis_eur']);
    if ($p < 50 || $p > 2000000) $add($zeile, 'Preis unplausibel: ' . $x['preis_eur']);
    if (!isset(PREISARTEN[$x['preisart']])) $add($zeile, 'Unbekannte Preisart: ' . $x['preisart']);
    if (!in_array($x['bauform'], ['klavier', 'fluegel'], true)) $add($zeile, 'Bauform muss klavier oder fluegel sein');
    if (!strtotime($x['datum'])) $add($zeile, 'Datum ungültig (Format JJJJ-MM-TT)'); elseif (strtotime($x['datum']) > time()) $add($zeile, 'Datum liegt in der Zukunft');
    if ($x['baujahr'] !== '' && ((int)$x['baujahr'] < 1800 || (int)$x['baujahr'] > (int)date('Y'))) $add($zeile, 'Baujahr unplausibel');
    if ($x['nutzungsrecht'] === '') $add($zeile, 'Nutzungsrecht fehlt: ohne geklärtes Recht darf der Datensatz nicht verwendet werden');
    if ($x['quelle'] === '') $add($zeile, 'Quelle fehlt');
    if ($x['marke'] === '') $add($zeile, 'Marke fehlt');
    if ($x['groesse_cm'] !== '' && $x['bauform'] === 'klavier' && (float)$x['groesse_cm'] > 160) $add($zeile, 'Größe für Klavier ungewöhnlich hoch: mögliche Verwechslung der Bauform');
    if ($x['groesse_cm'] !== '' && $x['bauform'] === 'fluegel' && (float)$x['groesse_cm'] < 140) $add($zeile, 'Größe für Flügel ungewöhnlich klein: mögliche Verwechslung der Bauform');
    $k = md5(implode('|', [$x['quelle'], $x['datum'], $x['region'], $x['marke'], $x['modellfamilie'], $x['baujahr'], $x['preis_eur']]));
    if (isset($seen[$k])) $add($zeile, 'Mögliche Dublette von Zeile ' . $seen[$k]); else $seen[$k] = $zeile;
    $reg[strtoupper($x['region'])][$x['preisart']] = ($reg[strtoupper($x['region'])][$x['preisart']] ?? 0) + 1;
}
fclose($h);
out(['ok' => true, 'fehlende_spalten' => $fehlt, 'datensaetze' => $n, 'je_region_und_preisart' => $reg, 'probleme' => $issues, 'hinweis' => $issues || $fehlt ? 'Bitte Probleme beheben und erneut prüfen.' : 'Keine Auffälligkeiten gefunden.']);
