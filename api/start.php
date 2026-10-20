<?php
// Startet eine Prüfung. Im Modus 'digistore' wird geprüft, ob Guthaben vorhanden ist (verbraucht wird erst beim Bericht).
require __DIR__ . '/_lib.php';
rate('start', 80, 3600);
$b = body();
$oid = auth_optional($b);
$sid = sid_ok($b['sid'] ?? '');
out(['ok' => true, 'credits_left' => $oid !== '' ? sess_start($oid, $sid) : null]);
