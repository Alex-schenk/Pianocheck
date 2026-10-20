<?php
// Öffentliche Basisinfos für die Oberfläche (keine Geheimnisse).
require __DIR__ . '/_lib.php';
require __DIR__ . '/_preis.php';
rate('info', 300, 3600);
out(['ok' => true, 'zugang' => zugang(), 'ki' => zugang() === 'digistore' && (($CFG['ki']['provider'] ?? 'none') !== 'none'),
     'abdeckung' => preis_abdeckung(), 'demo' => !empty($CFG['demo_daten'])]);
