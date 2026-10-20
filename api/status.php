<?php
require __DIR__ . '/_lib.php';
rate('status', 120, 3600);
$oid = auth(body());
$o = store(function (array &$d) use ($oid) { return $d[$oid] ?? null; });
$s = order_state($o);
if ($s !== 'ok') fail($s === 'expired' ? 'expired' : 'unauthorized', 'Der Zugang ist nicht mehr gültig.', 401);
out(['ok' => true, 'credits_left' => (int)$o['credits_total'] - (int)$o['credits_used'], 'credits_total' => (int)$o['credits_total'], 'expires' => (int)$o['expires']]);
