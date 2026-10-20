<?php
// Schließt die Prüfung ab: ermittelt die Preisorientierung aus Ihren Daten und verbucht im Modus 'digistore' genau einmal ein Guthaben.
require __DIR__ . '/_lib.php';
require __DIR__ . '/_preis.php';
rate('bericht', 60, 3600);
$b = body();
$oid = auth_optional($b);
$sid = sid_ok($b['sid'] ?? '');
$bj = 0; if (preg_match('/(18|19|20)\d{2}/', (string)($b['baujahr'] ?? ''), $m)) $bj = (int)$m[0];
$form = ($b['bauform'] ?? '') === 'fluegel' ? 'fluegel' : 'klavier';
$preis = preis_berechnen(['bauform' => $form, 'region' => txt($b['region'] ?? '', 3), 'marke' => txt($b['marke'] ?? '', 60), 'modell' => txt($b['modell'] ?? '', 60), 'baujahr' => $bj, 'klasse' => txt($b['klasse'] ?? '', 1)]);
$left = $oid !== '' ? sess_finish($oid, $sid) : null;      // zuerst rechnen, dann buchen: ein Fehler davor verbraucht nichts
out(['ok' => true, 'erfasst_am' => date('c'), 'credits_left' => $left, 'preis' => $preis]);
