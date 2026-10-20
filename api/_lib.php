<?php
declare(strict_types=1);
$CFG = require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

class ApiError extends Exception {
    public string $ecode;
    public function __construct(string $e, string $m, int $c = 400) { parent::__construct($m, $c); $this->ecode = $e; }
}
function fail(string $e, string $m, int $c = 400): void { throw new ApiError($e, $m, $c); }
function out(array $d, int $code = 200): void {
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
set_exception_handler(function (Throwable $t) {
    if ($t instanceof ApiError) out(['ok' => false, 'error' => $t->ecode, 'message' => $t->getMessage()], $t->getCode() ?: 400);
    error_log((string)$t);
    out(['ok' => false, 'error' => 'server', 'message' => 'Serverfehler. Bitte später erneut versuchen.'], 500);
});
function body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 9000000) fail('too_large', 'Die Datenmenge ist zu groß.', 413);
    $j = json_decode($raw, true);
    return is_array($j) ? $j : [];
}
function norm_oid(string $s): string { return strtoupper((string)preg_replace('/[^A-Za-z0-9]/', '', $s)); }
function txt($v, int $max = 300): string {
    $s = is_scalar($v) ? (string)$v : '';
    $s = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max);
}
function zugang(): string { global $CFG; return ($CFG['zugang'] ?? 'offen') === 'digistore' ? 'digistore' : 'offen'; }

/* ---------- Speicher (JSON-Datei mit Sperre) ---------- */
function store(callable $fn) {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $fh = fopen($dir . '/orders.json', 'c+');
    if (!$fh) fail('server', 'Speicher nicht verfügbar.', 500);
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $d = $raw ? json_decode($raw, true) : [];
    if (!is_array($d)) $d = [];
    try {
        $res = $fn($d);
    } finally {
        ftruncate($fh, 0); rewind($fh);
        fwrite($fh, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($fh); flock($fh, LOCK_UN); fclose($fh);
    }
    return $res;
}
function order_state(?array $o): string {
    if (!$o) return 'unknown';
    if (!empty($o['revoked'])) return 'revoked';
    if ((int)($o['expires'] ?? 0) < time()) return 'expired';
    return 'ok';
}

/* ---------- Anmelde-Token ---------- */
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64ud(string $s): string { return (string)base64_decode(strtr($s, '-_', '+/')); }
function make_token(string $oid, int $exp): string {
    global $CFG;
    $p = b64u(json_encode(['o' => $oid, 'e' => $exp]));
    return $p . '.' . hash_hmac('sha256', $p, (string)$CFG['token_secret']);
}
function read_token($t): ?array {
    global $CFG;
    if (!is_string($t) || strpos($t, '.') === false) return null;
    [$p, $sig] = explode('.', $t, 2);
    if (!hash_equals(hash_hmac('sha256', $p, (string)$CFG['token_secret']), $sig)) return null;
    $d = json_decode(b64ud($p), true);
    if (!is_array($d) || (int)($d['e'] ?? 0) < time()) return null;
    return $d;
}
function auth(array $b): string {
    $t = read_token($b['token'] ?? null);
    if (!$t) fail('unauthorized', 'Bitte melden Sie sich an.', 401);
    return (string)$t['o'];
}
/* Im Modus 'offen' gibt es keine Anmeldung: leere Kennung. */
function auth_optional(array $b): string { return zugang() === 'digistore' ? auth($b) : ''; }
function sid_ok($s): string {
    $s = is_string($s) ? $s : '';
    if (!preg_match('/^[a-f0-9]{16,32}$/', $s)) fail('bad_request', 'Ungültige Anfrage.', 400);
    return $s;
}
function img_ok($s): string {
    if (!is_string($s) || strlen($s) < 200 || strlen($s) > 2800000 || !preg_match('~^[A-Za-z0-9+/=]+$~', $s)) fail('bad_image', 'Das Bild konnte nicht verarbeitet werden.', 400);
    return $s;
}
function rate(string $name, int $max, int $win): void {
    $dir = __DIR__ . '/data'; if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $f = $dir . '/rl-' . md5($name . ($_SERVER['REMOTE_ADDR'] ?? 'x')) . '.json';
    $now = time();
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    if (!is_array($d) || $now - (int)($d['t'] ?? 0) > $win) $d = ['t' => $now, 'n' => 0];
    $d['n']++;
    @file_put_contents($f, json_encode($d), LOCK_EX);
    if ($d['n'] > $max) fail('rate', 'Zu viele Anfragen. Bitte kurz warten.', 429);
}

/* ---------- Prüfungen: Sitzung starten, KI-Bilder zählen, Bericht abschließen (Guthaben) ---------- */
function sess_start(string $oid, string $sid): int {
    return store(function (array &$d) use ($oid, $sid) {
        if (!isset($d[$oid]) || !is_array($d[$oid])) fail('unauthorized', 'Bitte melden Sie sich an.', 401);
        $o = &$d[$oid];
        $s = order_state($o);
        if ($s !== 'ok') fail($s === 'expired' ? 'expired' : 'revoked', 'Der Zugang ist nicht mehr gültig.', 403);
        if (!isset($o['sessions']) || !is_array($o['sessions'])) $o['sessions'] = [];
        foreach ($o['sessions'] as $k => $x) if (time() - (int)$x['t'] > 3 * 86400) unset($o['sessions'][$k]);
        $left = (int)$o['credits_total'] - (int)$o['credits_used'];
        if (!isset($o['sessions'][$sid])) {
            $open = 0;
            foreach ($o['sessions'] as $x) if (empty($x['done']) && time() - (int)$x['t'] <= 6 * 3600) $open++;
            if ($left <= 0 || $open >= $left) fail('no_credits', 'Keine Prüfung verfügbar. Bitte schließen Sie eine laufende Prüfung ab oder erwerben Sie weitere Prüfungen.', 402);
            $o['sessions'][$sid] = ['t' => time(), 'ai' => 0, 'done' => false];
        }
        return $left;
    });
}
function sess_ai(string $oid, string $sid, int $max): void {
    store(function (array &$d) use ($oid, $sid, $max) {
        if (!isset($d[$oid]['sessions'][$sid]) || order_state($d[$oid]) !== 'ok') fail('unauthorized', 'Bitte starten Sie die Prüfung neu.', 401);
        $x = &$d[$oid]['sessions'][$sid];
        if (!empty($x['done']) || time() - (int)$x['t'] > 6 * 3600) fail('session_expired', 'Diese Prüfung ist abgeschlossen oder abgelaufen.', 410);
        if ((int)$x['ai'] >= $max) fail('limit', 'Für diese Prüfung wurde das Limit an KI-Bildern erreicht.', 429);
        $x['ai']++;
    });
}
function sess_ai_refund(string $oid, string $sid): void {
    store(function (array &$d) use ($oid, $sid) { if (isset($d[$oid]['sessions'][$sid]['ai']) && $d[$oid]['sessions'][$sid]['ai'] > 0) $d[$oid]['sessions'][$sid]['ai']--; });
}
/* Verbraucht genau einmal ein Guthaben; wiederholte Anfragen buchen nicht doppelt. */
function sess_finish(string $oid, string $sid): int {
    return store(function (array &$d) use ($oid, $sid) {
        if (!isset($d[$oid]['sessions'][$sid]) || order_state($d[$oid]) !== 'ok') fail('unauthorized', 'Bitte starten Sie die Prüfung neu.', 401);
        $o = &$d[$oid];
        if (empty($o['sessions'][$sid]['done'])) {
            if ((int)$o['credits_used'] >= (int)$o['credits_total']) fail('no_credits', 'Kein Guthaben mehr verfügbar.', 402);
            $o['credits_used']++;
            $o['sessions'][$sid]['done'] = true;
        }
        return (int)$o['credits_total'] - (int)$o['credits_used'];
    });
}

/* ---------- KI-Anbieter (optional) ---------- */
function http_json(string $url, array $headers, array $payload, int $timeout = 90): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_HTTPHEADER => array_merge(['content-type: application/json'], $headers), CURLOPT_POSTFIELDS => json_encode($payload)]);
    $r = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($r === false || $code < 200 || $code >= 300) { error_log('ki http ' . $code . ' ' . substr((string)$r, 0, 300)); throw new RuntimeException('ki'); }
    $j = json_decode($r, true);
    return is_array($j) ? $j : [];
}
function ki_call(array $imgs, string $prompt): string {
    global $CFG;
    $k = $CFG['ki'] ?? []; $p = $k['provider'] ?? 'none';
    if ($p === 'anthropic') {
        $c = []; foreach ($imgs as $i) $c[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => 'image/jpeg', 'data' => $i]];
        $c[] = ['type' => 'text', 'text' => $prompt];
        $j = http_json('https://api.anthropic.com/v1/messages', ['x-api-key: ' . $k['api_key'], 'anthropic-version: 2023-06-01'], ['model' => $k['model'], 'max_tokens' => 900, 'messages' => [['role' => 'user', 'content' => $c]]]);
        $t = ''; foreach (($j['content'] ?? []) as $b) $t .= $b['text'] ?? ''; return $t;
    }
    if ($p === 'gemini') {
        $parts = []; foreach ($imgs as $i) $parts[] = ['inline_data' => ['mime_type' => 'image/jpeg', 'data' => $i]];
        $parts[] = ['text' => $prompt];
        $j = http_json('https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode((string)$k['model']) . ':generateContent', ['x-goog-api-key: ' . $k['api_key']], ['contents' => [['parts' => $parts]], 'generationConfig' => ['temperature' => 0, 'responseMimeType' => 'application/json']]);
        return (string)($j['candidates'][0]['content']['parts'][0]['text'] ?? '');
    }
    if ($p === 'openai') {
        $c = []; foreach ($imgs as $i) $c[] = ['type' => 'image_url', 'image_url' => ['url' => 'data:image/jpeg;base64,' . $i]];
        $c[] = ['type' => 'text', 'text' => $prompt];
        $j = http_json(rtrim((string)$k['base_url'], '/') . '/chat/completions', ['authorization: Bearer ' . $k['api_key']], ['model' => $k['model'], 'temperature' => 0, 'max_tokens' => 900, 'messages' => [['role' => 'user', 'content' => $c]]]);
        $m = $j['choices'][0]['message']['content'] ?? '';
        return is_array($m) ? json_encode($m) : (string)$m;
    }
    throw new RuntimeException('ki_off');
}
function json_from(string $t): ?array {
    $a = strpos($t, '{'); $b = strrpos($t, '}');
    if ($a === false || $b === false) return null;
    $d = json_decode(substr($t, $a, $b - $a + 1), true);
    return is_array($d) ? $d : null;
}
