<?php
// Preisermittlung aus den hochgeladenen Vergleichsdaten (api/daten/vergleiche.csv). Läuft komplett auf Ihrem Webspace.
const PREISARTEN = [
    'verkauf_privat'        => ['Dokumentierte private Verkäufe', 'Begrenzte Aussagekraft: Klang, Stimmhaltung und verdeckte Schäden sind in den Vergleichen unbekannt.'],
    'verkauf_haendler'      => ['Händlerverkäufe', 'Händlerpreise enthalten Aufbereitung, Gewährleistung und Marge und sind kein Maßstab für private Verkäufe.'],
    'auktion_zuschlag'      => ['Auktionszuschläge', 'Zuschlagspreise ohne Käufergebühren; Auswahlverzerrung möglich, kein privater Verkaufspreis.'],
    'inserat'               => ['Angebotspreise aus Inseraten', 'Das sind Wunschpreise, keine erzielten Verkaufspreise.'],
    'richtwert_fachbetrieb' => ['Richtwerte des Fachbetriebs', 'Erfahrungswerte des Fachbetriebs, keine dokumentierten Verkäufe.'],
];
function nrm(string $s): string { return mb_strtolower(trim($s)); }
function vergleiche(): array {
    global $CFG; static $cache = null;
    if ($cache !== null) return $cache;
    $files = [__DIR__ . '/daten/vergleiche.csv'];
    if (!empty($CFG['demo_daten'])) $files[] = __DIR__ . '/daten/vergleiche-demo.csv';
    $rows = [];
    foreach ($files as $f) {
        if (!is_file($f)) continue;
        $h = fopen($f, 'r'); if (!$h) continue;
        $head = fgetcsv($h, 0, ';');
        if (!$head) { fclose($h); continue; }
        $head = array_map(function ($x) { return strtolower(trim((string)preg_replace('/^\xEF\xBB\xBF/', '', (string)$x))); }, $head);
        while (($r = fgetcsv($h, 0, ';')) !== false) {
            if (count($r) !== count($head)) continue;
            $row = array_combine($head, array_map('trim', $r));
            $row['_demo'] = (stripos($f, 'demo') !== false) || strtoupper($row['quelle'] ?? '') === 'DEMO';
            $row['_preis'] = (float)str_replace(',', '.', $row['preis_eur'] ?? '0');
            $row['_ts'] = strtotime($row['datum'] ?? '') ?: 0;
            $rows[] = $row;
        }
        fclose($h);
    }
    return $cache = $rows;
}
function pct(array $v, float $p): float {
    sort($v); $n = count($v);
    if ($n === 1) return (float)$v[0];
    $i = ($n - 1) * $p; $lo = (int)floor($i); $hi = (int)ceil($i);
    return $v[$lo] + ($v[$hi] - $v[$lo]) * ($i - $lo);
}
/* Grobe Abdeckung je Region und Bauform für die Anzeige vor dem Start. */
function preis_abdeckung(): array {
    global $CFG;
    $gut = (int)($CFG['preis']['abdeckung_gut'] ?? 40); $min = (int)($CFG['preis']['min_vergleiche'] ?? 8); $cnt = [];
    foreach (vergleiche() as $r) {
        if (($r['preisart'] ?? '') === 'inserat' || $r['_preis'] <= 0) continue;
        $reg = strtoupper($r['region'] ?? ''); $bf = $r['bauform'] ?? '';
        if ($reg === '' || ($bf !== 'klavier' && $bf !== 'fluegel')) continue;
        $cnt[$reg][$bf] = ($cnt[$reg][$bf] ?? 0) + 1;
    }
    $out = [];
    foreach ($cnt as $reg => $b) foreach ($b as $bf => $n) $out[$reg][$bf] = ['n' => $n, 'status' => $n >= $gut ? 'gut' : ($n >= $min ? 'teilweise' : 'keine')];
    return $out;
}
function preis_berechnen(array $q): array {
    global $CFG;
    $c = $CFG['preis'] ?? [];
    $min = (int)($c['min_vergleiche'] ?? 8); $minO = (int)($c['min_orientierung'] ?? 3); $maxM = (int)($c['max_alter_monate'] ?? 36); $tol = (int)($c['alter_toleranz_jahre'] ?? 10);
    $keine = function (string $g, bool $demo = false) { return ['status' => 'keine', 'grund' => $g, 'gruppen' => [], 'notizen' => [], 'demo' => $demo]; };
    $bf = (string)($q['bauform'] ?? ''); $rg = strtoupper((string)($q['region'] ?? '')); $marke = nrm((string)($q['marke'] ?? ''));
    if ($marke === '') return $keine('Die Marke wurde nicht bestätigt. Ohne gesicherte Identität ist kein belastbarer Vergleich möglich.');
    if ($rg === 'XX' || $rg === '') return $keine('Für „Andere Region“ liegen keine Vergleichsdaten vor.');
    $grenze = strtotime('-' . $maxM . ' months');
    $rows = array_values(array_filter(vergleiche(), function ($r) use ($bf, $rg, $marke, $grenze) {
        return ($r['bauform'] ?? '') === $bf && strtoupper($r['region'] ?? '') === $rg && nrm($r['marke'] ?? '') === $marke && $r['_preis'] > 0 && $r['_ts'] >= $grenze && isset(PREISARTEN[$r['preisart'] ?? '']);
    }));
    $gr = []; foreach ($rows as $r) $gr[$r['preisart']][] = $r;
    $notizen = []; $res = []; $demo = false;
    foreach (PREISARTEN as $art => $meta) {
        if (empty($gr[$art])) continue;
        $g = $gr[$art];
        $mod = nrm((string)($q['modell'] ?? ''));
        if ($mod !== '') { $s = array_values(array_filter($g, function ($r) use ($mod) { return nrm($r['modellfamilie'] ?? '') === $mod; })); if (count($s) >= ($art === 'verkauf_privat' ? $min : $minO)) $g = $s; else $notizen['m'] = 'Die Modellfamilie konnte nicht berücksichtigt werden (zu wenige Vergleiche).'; }
        $bj = (int)($q['baujahr'] ?? 0);
        if ($bj >= 1800 && $bj <= (int)date('Y')) { $s = array_values(array_filter($g, function ($r) use ($bj, $tol) { $b = (int)($r['baujahr'] ?? 0); return $b > 0 && abs($b - $bj) <= $tol; })); if (count($s) >= ($art === 'verkauf_privat' ? $min : $minO)) $g = $s; else $notizen['b'] = 'Das Alter konnte nicht berücksichtigt werden (zu wenige Vergleiche).'; }
        $kl = strtoupper((string)($q['klasse'] ?? ''));
        if ($kl !== '') { $s = array_values(array_filter($g, function ($r) use ($kl) { return strtoupper($r['zustandsklasse'] ?? '') === $kl; })); if (count($s) >= ($art === 'verkauf_privat' ? $min : $minO)) $g = $s; else $notizen['k'] = 'Die Zustandsgruppe konnte nicht berücksichtigt werden (zu wenige Vergleiche).'; }
        $need = $art === 'verkauf_privat' ? $min : $minO;
        if (count($g) < $need) continue;
        $p = array_map(function ($r) { return $r['_preis']; }, $g);
        $ts = max(array_map(function ($r) { return $r['_ts']; }, $g));
        $isDemo = (bool)array_filter($g, function ($r) { return $r['_demo']; }); $demo = $demo || $isDemo;
        $res[] = ['preisart' => $art, 'label' => $meta[0], 'hinweis' => $meta[1], 'n' => count($g), 'von' => round(pct($p, 0.1), -1), 'bis' => round(pct($p, 0.9), -1), 'median' => round(pct($p, 0.5), -1), 'stichtag' => date('d.m.Y', $ts), 'hauptgruppe' => $art === 'verkauf_privat', 'demo' => $isDemo];
        if ($art === 'verkauf_privat') break;      // private Verkäufe haben Vorrang, andere Quellen werden dann nicht gezeigt
    }
    if (!$res) return $keine('Zu wenige oder keine passenden Vergleiche gefunden (' . count($rows) . ' Datensätze für diese Marke und Region; erforderlich sind ' . $min . ' private Verkäufe oder ' . $minO . ' Datensätze einer anderen Quelle).');
    return ['status' => $res[0]['hauptgruppe'] ? 'intervall' : 'orientierung', 'gruppen' => $res, 'notizen' => array_values($notizen), 'demo' => $demo];
}
