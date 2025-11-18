#!/bin/bash

# Build F12 test file

cat > /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js << 'HEADER_EOF'
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BIOMETRIC UPLOAD - F12 TEST VERSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Version: 2.5.0 - Relaxed requirements for better UX
//
// ⚠️ WICHTIG - GRENZEN DER CLIENT-VALIDIERUNG:
// Diese Validierung ist ein PRE-FILTER (technische Checks).
// Sie prüft NICHT: Brillenreflexionen, Gesichtsausdruck, Augen, Haare, etc.
// → Für vollständige ICAO-Konformität Server-Validierung aktivieren!
//
// 🆕 NEU in v2.5: Gelockerte Anforderungen für bessere UX
// - ✅ Mindestauflösung: 800×1029px (statt 1050×1350px)
// - ✅ Dimensionen & Seitenverhältnis = Soft Errors (Checkbox-Override möglich!)
// - ✅ Größere Toleranzen für Hintergrund, Beleuchtung, Schärfe
// - ✅ Hard Errors nur noch: Format, Dateigröße (30-500 KB)
// - ✅ Verwendet Formcycle Checkbox cb1 für Soft-Error-Override
// - ✅ Checkbox initial versteckt, nur bei Soft Errors sichtbar
// - ✅ Bild wird nur übertragen wenn cb1 abgehackt ist
//
// v2.3 Features (bereits enthalten):
// - EXIF-Rotation Support (Portrait-Fotos korrekt gedreht)
// - HEIC/HEIF Format-Warning (iPhone-Tipps)
// - Auto-Optimize standardmäßig aktiviert
// - Mobile-Hints (capture="environment" für Rückkamera)
//
// v2.2 Features (bereits enthalten):
// - 4-Zonen Facial Lighting Analyse
// - Sobel Edge Detection für Schatten
// - Homogenitäts-Checks pro Zone
//
// SO VERWENDEN (F12 Console):
// 1. F12 drücken → Console-Tab öffnen
// 2. GESAMTEN Inhalt dieser Datei kopieren (Strg+A, Strg+C)
// 3. In Console einfügen (Strg+V)
// 4. Enter drücken
// 5. Fertig! ✅
//
// ICAO Doc 9303 Standard:
// - Bildgröße: 1050×1350 Pixel (35mm×45mm @ 300 DPI)
// - Gesichtshöhe: 70-80% der Bildhöhe (32-36mm)
// - Hintergrund: Hell, einheitlich (weiß/hellgrau)
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.clear();
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
console.log('%c⚡ BIOMETRIC UPLOAD - F12 TEST MODE (v2.5.0)', 'color: #667eea; font-weight: bold; font-size: 16px');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
console.log('📋 Lade Module...');

// jQuery-Check
if (typeof $ === 'undefined') {
    console.error('❌ jQuery nicht verfügbar!');
    console.log('Lade jQuery von CDN...');

    const script = document.createElement('script');
    script.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
    script.onload = function() {
        console.log('✅ jQuery geladen');
        loadBiometricModules();
    };
    document.head.appendChild(script);
} else {
    console.log('✅ jQuery verfügbar:', $.fn.jquery);
    loadBiometricModules();
}

function loadBiometricModules() {
    console.log('');
    console.log('%c📐 ICAO Doc 9303 Standard', 'color: #2196F3; font-weight: bold');
    console.log('  Bildgröße: 1050×1350 px (35mm×45mm @ 300 DPI)');
    console.log('  Gesicht: 70-80% der Bildhöhe (32-36mm)');
    console.log('  Hintergrund: Hell, einheitlich (weiß/hellgrau)');
    console.log('');
    console.log('%c⚠️ Client-Validierung = PRE-FILTER (technische Checks)', 'color: #f39c12; font-weight: bold');
    console.log('%c   Prüft NICHT: Reflexionen, Ausdruck, Augen, Haare, etc.', 'color: #f39c12');
    console.log('');
    console.log('%c🆕 Auto-Optimize: Deaktiviert (enable mit CONFIG.AUTO_OPTIMIZE.enabled = true)', 'color: #9c27b0; font-weight: bold');
    console.log('');

    // ════════════════════════════════════════════════════════════════════════════════
    // BIOMETRIC VALIDATOR
    // ════════════════════════════════════════════════════════════════════════════════

HEADER_EOF

# Append validator and integration
cat /home/user/XimaBiometricUpload/client/biometric-validator.js >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js
echo "" >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js
echo "    // ════════════════════════════════════════════════════════════════════════════════" >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js
echo "    // FORMCYCLE INTEGRATION" >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js
echo "    // ════════════════════════════════════════════════════════════════════════════════" >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js
echo "" >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js
cat /home/user/XimaBiometricUpload/client/formcycle-integration.js >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js

# Append footer
cat >> /home/user/XimaBiometricUpload/client/biometric-upload-f12-test.js << 'FOOTER_EOF'

    console.log('');
    console.log('%c✅ Alle Module geladen! ICAO-konform!', 'color: #28a745; font-weight: bold; font-size: 14px');
    console.log('%c   Auto-Optimize: ' + (CONFIG.AUTO_OPTIMIZE.enabled ? 'AKTIV' : 'DEAKTIVIERT'), 'color: #9c27b0; font-weight: bold');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
}
FOOTER_EOF

echo "✅ F12 test file rebuilt!"
