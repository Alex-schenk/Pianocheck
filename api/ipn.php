<?php
// Digistore24-IPN: wird von Digistore24 nach Kauf, Rückerstattung usw. aufgerufen.
require __DIR__ . '/_lib.php';
header('Content-Type: text/plain; charset=utf-8');

function ds_sign(string $pass, array $p): string {
    unset($p['sha_sign']);
    ksort($p, SORT_STRING);
    $s = '';
    foreach ($p as $k => $v) {
        if (is_array($v) || $v === '' || $v === null) continue;
        $s .= $k . '=' . $v . $pass;
    }
    return strtoupper(hash('sha512', $s));
}
$p = $_POST;
if (!empty($CFG['ipn_check_signature'])) {
    $pass = (string)$CFG['ipn_passphrase'];
    if ($pass === '' || !hash_equals(ds_sign($pass, $p), strtoupper((string)($p['sha_sign'] ?? '')))) {
        @file_put_contents(__DIR__ . '/data/ipn.log', date('c') . " SIGNATUR UNGUELTIG event=" . ($p['event'] ?? '?') . "\n", FILE_APPEND | LOCK_EX);
        http_response_code(403); echo 'invalid signature'; exit;
    }
}
$ev = (string)($p['event'] ?? '');
$oid = norm_oid((string)($p['order_id'] ?? ''));
$pid = (string)($p['product_id'] ?? '');
$mail = strtolower(trim((string)($p['email'] ?? ($p['buyer_email'] ?? ($p['address_email'] ?? '')))));
@file_put_contents(__DIR__ . '/data/ipn.log', date('c') . " $ev $oid $pid\n", FILE_APPEND | LOCK_EX);
if ($oid === '') { echo 'OK'; exit; }

store(function (array &$d) use ($ev, $oid, $pid, $mail, $CFG) {
    if ($ev === 'on_payment') {
        $prod = $CFG['products'][$pid] ?? null;
        if (!$prod || $mail === '' || isset($d[$oid])) return;       // fremdes Produkt oder schon erfasst
        $d[$oid] = ['email' => $mail, 'product' => $pid, 'credits_total' => (int)$prod['credits'], 'credits_used' => 0,
                    'created' => time(), 'expires' => time() + (int)$prod['days'] * 86400, 'revoked' => false, 'sessions' => []];
    } elseif (in_array($ev, ['on_refund', 'on_chargeback'], true) && isset($d[$oid])) {
        $d[$oid]['revoked'] = true;
    }
});
echo 'OK';
