<?php
// ============================================================================
// EINSTELLUNGEN DER KLAVIERPRÜFUNG. Diese Datei niemals weitergeben oder veröffentlichen.
// ============================================================================
return [
    // 'offen'     = jeder darf die App kostenlos nutzen (zum Testen oder als Gratis-Angebot).
    // 'digistore' = Bezahlschranke: Zugang nur mit Bestell-ID und E-Mail aus einem Digistore24-Kauf.
    'zugang' => 'offen',

    // Nur für 'digistore': zwei lange, zufällige, selbst ausgedachte Texte (je mindestens 32 Zeichen)
    'token_secret' => 'HIER-LANGEN-ZUFALLSTEXT-EINTRAGEN-1',
    'admin_key'    => 'HIER-ANDEREN-LANGEN-ZUFALLSTEXT-EINTRAGEN-2',

    // Digistore24: IPN-Passphrase und Ihre Produkte (Produkt-ID = Zahl am Ende des Bezahllinks)
    'ipn_passphrase'      => '',
    'ipn_check_signature' => true,
    'products' => [
        'PRODUKT-ID-EINZEL' => ['credits' => 1, 'days' => 14],
        'PRODUKT-ID-PAKET'  => ['credits' => 3, 'days' => 45],
    ],

    // OPTIONALE KI-Unterstützung (macht Vorschläge für die Antworten, kostet Geld pro Bild).
    // Nur im Modus 'digistore' aktiv. Voreinstellung: aus.
    //   'provider' => 'none'       KI aus (kostenlos, Standard)
    //   'provider' => 'anthropic'  Claude, Modell z. B. 'claude-haiku-5-5'
    //   'provider' => 'openai'     OpenAI-kompatible Anbieter (Mistral, OpenRouter, Groq, OpenAI):
    //                              'base_url' z. B. 'https://api.mistral.ai/v1', 'model' laut Anbieter
    //   'provider' => 'gemini'     Google Gemini (nur mit bezahltem Tarif für Kunden in EU/EWR/CH/UK, siehe Anleitung)
    'ki' => ['provider' => 'none', 'api_key' => '', 'model' => '', 'base_url' => '', 'max_bilder_pro_pruefung' => 15],

    // Preisorientierung aus Ihren hochgeladenen Vergleichsdaten (Ordner api/daten)
    'preis' => [
        'min_vergleiche'      => 8,    // so viele passende private Verkäufe sind für ein Intervall nötig
        'min_orientierung'    => 3,    // Mindestzahl für andere Quellen (Händler, Auktion, Inserate, Richtwerte)
        'max_alter_monate'    => 36,   // ältere Verkäufe werden ignoriert
        'alter_toleranz_jahre'=> 10,   // Baujahr-Spanne beim Vergleich
        'abdeckung_gut'       => 40,   // ab so vielen Datensätzen gilt eine Region als gut abgedeckt
    ],
    'demo_daten' => false,   // true = erfundene Demodaten zum Testen einbeziehen (nur zum Ausprobieren!)
];
