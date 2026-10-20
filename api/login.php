<?php
require __DIR__ . '/_lib.php';
rate('login', 12, 900);
$b = body();
$oid = norm_oid((string)($b['order_id'] ?? ''));
$mail = strtolower(trim((string)($b['email'] ?? '')));
if ($oid === '' || $mail === '') fail('missing', 'Bitte Bestell-ID und E-Mail-Adresse eingeben.');
$o = store(function (array &$d) use ($oid) { return $d[$oid] ?? null; });
if (!$o || !hash_equals((string)($o['email'] ?? ''), $mail)) {
    fail('not_found', 'Zu dieser Kombination wurde keine Bestellung gefunden. Bitte Bestell-ID und E-Mail-Adresse genau wie im Digistore24-Beleg eingeben. Direkt nach dem Kauf kann es einen Moment dauern.', 404);
}
$s = order_state($o);
if ($s === 'revoked') fail('revoked', 'Dieser Zugang ist nicht mehr gültig.', 403);
if ($s === 'expired') fail('expired', 'Dieser Zugang ist abgelaufen.', 403);
out(['ok' => true, 'token' => make_token($oid, min((int)$o['expires'], time() + 30 * 86400)),
     'credits_left' => (int)$o['credits_total'] - (int)$o['credits_used'], 'credits_total' => (int)$o['credits_total'], 'expires' => (int)$o['expires']]);
