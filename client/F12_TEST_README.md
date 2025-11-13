# 🧪 F12 Test-Datei - Biometrische Bildprüfung

## 📁 Datei

**`biometric-upload-f12-test.js`** - Kombinierte Version mit Validator + Integration

## ⚡ So testen Sie über F12 (Developer Tools):

### 1️⃣ Formcycle-Seite öffnen
Öffnen Sie Ihre Formcycle-Seite mit einem oder mehreren Upload-Feldern.

### 2️⃣ F12 drücken
Öffnen Sie die Developer Tools (F12 oder Rechtsklick → "Untersuchen").

### 3️⃣ Console-Tab auswählen
Wechseln Sie zum "Console"-Tab.

### 4️⃣ Datei kopieren & einfügen
- Öffnen Sie `biometric-upload-f12-test.js`
- Kopieren Sie den **GESAMTEN Inhalt** (Strg+A, Strg+C)
- Fügen Sie ihn in die Console ein (Strg+V)
- Drücken Sie Enter

### 5️⃣ Fertig! 🎉
Die biometrische Validierung ist jetzt aktiv für **ALLE** Upload-Felder auf der Seite!

## 🔍 Was Sie sehen sollten:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ BIOMETRIC UPLOAD - F12 TEST MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Lade Module...
✅ jQuery verfügbar: 3.x.x

🔐 BIOMETRIC UPLOAD INTEGRATION (STANDALONE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️  Konfiguration
Validierungs-Strategie: all
📋 3 Feld(er) für biometrische Validierung gefunden
  → xi-upl-1
  → xi-upl-2
  → xi-upl-passport
✅ Biometrische Validierung setup abgeschlossen
✅ Initialisierung abgeschlossen!
```

## 📊 Was passiert automatisch:

1. **Alle Upload-Felder werden gefunden** (`input[type="file"]`)
2. **Banner wird hinzugefügt**: "🔐 Biometrische Bildprüfung aktiv"
3. **Bei Datei-Auswahl**: Automatische Validierung
4. **Visuelles Feedback**:
   - ✅ Grün = Bild OK
   - ❌ Rot = Bild ungültig (wird automatisch entfernt)

## 🎯 Geprüfte Kriterien:

✅ Format (JPEG/PNG)
✅ Dateigröße (50 KB - 500 KB)
✅ Auflösung (mind. 1200x900px)
✅ Seitenverhältnis (3:4 Portrait)
✅ Bildqualität (Schärfe, Kontrast)
✅ Gesichtserkennung (wenn face-api.js verfügbar)

## ⚙️ Konfiguration anpassen:

Wenn Sie die Einstellungen ändern möchten, bearbeiten Sie in der Datei:

```javascript
const CONFIG = {
    VALIDATION_STRATEGY: 'all',  // 'all', 'biometric-upload', 'specific'

    BIOMETRIC_REQUIREMENTS: {
        minWidth: 1200,              // Mindestbreite in Pixel
        minHeight: 900,              // Mindesthöhe in Pixel
        maxFileSize: 500 * 1024,     // Max Dateigröße (500 KB)
        enableFaceDetection: true,   // Gesichtserkennung an/aus
        enableServerValidation: false // Server-API an/aus
    },

    AUTO_REMOVE_INVALID: true       // Ungültige Bilder automatisch entfernen
};
```

## 🐛 Troubleshooting:

### "jQuery nicht verfügbar"
**Problem:** `❌ jQuery nicht verfügbar!`
**Lösung:** Formcycle sollte jQuery haben. Falls nicht:
```javascript
// Zuerst jQuery laden (in Console):
var script = document.createElement('script');
script.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
document.head.appendChild(script);

// Dann nach 2 Sekunden den Test-Code einfügen
```

### "Keine Felder gefunden"
**Problem:** `⚠️ Keine Felder für biometrische Validierung gefunden`
**Lösung:**
- Prüfen Sie, ob Upload-Felder auf der Seite vorhanden sind
- Öffnen Sie die Seite neu und laden Sie den Code erneut

### "Gesichtserkennung übersprungen"
**Problem:** `⊘ Übersprungen (face-api.js nicht verfügbar)`
**Lösung:** Das ist normal! Gesichtserkennung ist optional. Die anderen Checks (Format, Größe, Qualität) funktionieren trotzdem.

## 📝 Notizen:

- **Keine Installation nötig** - läuft direkt im Browser
- **Keine Formcycle-APIs** - funktioniert mit Standard HTML5
- **Keine Server-API** - läuft komplett client-seitig
- **DSGVO-konform** - keine Daten werden gesendet

## 🔄 Neue Änderungen testen:

Wenn Sie den Code ändern:
1. Seite neu laden (F5)
2. F12 öffnen
3. Neuen Code in Console einfügen

## ✅ Quick-Check:

Nach dem Einfügen des Codes sollten Sie sehen:
- [ ] Keine roten Fehlermeldungen in Console
- [ ] "✅ Initialisierung abgeschlossen!"
- [ ] "📋 X Feld(er) für biometrische Validierung gefunden"
- [ ] Bei jedem Upload-Feld: Banner "🔐 Biometrische Bildprüfung aktiv"

---

**Viel Erfolg beim Testen!** 🚀
