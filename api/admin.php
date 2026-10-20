<?php
// Für Sie als Betreiber: Zugänge von Hand anlegen (Tests, Geschenke) oder sperren.
//  Anlegen:  admin.php?key=ADMIN_KEY&grant=TEST1&email=ich@mail.de&credits=5&days=30
//  Sperren:  admin.php?key=ADMIN_KEY&revoke=TEST1
//  Liste:    admin.php?key=ADMIN_KEY
require __DIR__ . '/_lib.php';
rate('admin', 30, 900);
$k = (string)($_GET['key'] ?? '');
if (strlen((string)$CFG['admin_key']) < 24 || !hash_equals((string)$CFG['admin_key'], $k)) fail('forbidden', 'Kein Zugriff.', 403);
if (isset($_GET['grant'])) {
    $oid = norm_oid((string)$_GET['grant']); $mail = strtolower(trim((string)($_GET['email'] ?? '')));
    $cr = max(1, (int)($_GET['credits'] ?? 1)); $days = max(1, (int)($_GET['days'] ?? 30));
    if ($oid === '' || $mail === '') fail('missing', 'grant und email angeben.');
    store(function (array &$d) use ($oid, $mail, $cr, $days) {
        $d[$oid] = ['email' => $mail, 'product' => 'manuell', 'credits_total' => $cr, 'credits_used' => 0, 'created' => time(), 'expires' => time() + $days * 86400, 'revoked' => false, 'sessions' => []];
    });
    out(['ok' => true, 'angelegt' => $oid, 'email' => $mail, 'pruefungen' => $cr, 'tage' => $days]);
}
if (isset($_GET['revoke'])) {
    $oid = norm_oid((string)$_GET['revoke']);
    store(function (array &$d) use ($oid) { if (isset($d[$oid])) $d[$oid]['revoked'] = true; });
    out(['ok' => true, 'gesperrt' => $oid]);
}
$list = store(function (array &$d) {
    $o = [];
    foreach ($d as $id => $x) $o[] = ['bestell_id' => $id, 'email' => $x['email'] ?? '', 'pruefungen_gesamt' => $x['credits_total'] ?? 0, 'verbraucht' => $x['credits_used'] ?? 0, 'gueltig_bis' => date('Y-m-d H:i', (int)($x['expires'] ?? 0)), 'gesperrt' => !empty($x['revoked'])];
    return $o;
});
out(['ok' => true, 'bestellungen' => $list]);
