# Testbilder für Biometrische Validierung

## test-soft-errors-only.jpg

**Zweck:** Testet die Checkbox cb1 für Soft-Error-Override

**Eigenschaften:**
- ✅ Dimensionen: 1050×1350 px (ICAO-konform)
- ✅ Format: JPEG
- ✅ Dateigröße: ~30 KB (< 500 KB)
- ✅ Seitenverhältnis: 0.778 (≈ 35:45)
- ✅ Heller Hintergrund
- ✅ Gesicht in korrekter Größe (75% der Bildhöhe)

**Soft Errors (absichtlich):**
- ❌ Schatten auf linker Gesichtshälfte
- ❌ Dunkler Fleck im oberen Bereich
- ❌ Ungleichmäßiger Hintergrund (rechts dunkler)

**Erwartetes Verhalten:**
1. Keine Hard Errors → Bild wird NICHT automatisch entfernt
2. Soft Errors erkannt → Checkbox cb1 wird ANGEZEIGT
3. Checkbox initial NICHT abgehackt → Bild aus Upload entfernt
4. User hackt cb1 ab → Bild wird wieder zum Upload hinzugefügt
5. User kann Bild mit Qualitätsmängeln trotzdem übertragen

## Generierung

Das Testbild wurde mit Python/Pillow generiert:

```bash
cd /home/user/XimaBiometricUpload/test
python3 generate-soft-error-test-image.py
```

## Test-Workflow

### 1. Testbild hochladen
- Öffne Formcycle-Formular mit Biometric Upload
- Wähle `test-soft-errors-only.jpg`

### 2. Erwartete Console-Ausgabe
```
[BiometricIntegration] ❌ Datei ungültig: test-soft-errors-only.jpg
[BiometricIntegration]   → Hard Errors: 0
[BiometricIntegration]   → Soft Errors: 2-3
[BiometricIntegration] ⚠️ Qualitätsmängel erkannt, Checkbox nicht abgehackt → Bild wird entfernt
```

### 3. Visuelles Feedback
- ⚠️ Orange Checkbox erscheint: "Trotz Qualitätsmängeln verwenden"
- Status zeigt Soft Errors (Schatten, Beleuchtung, etc.)
- Datei ist NICHT im Upload (bis cb1 abgehackt wird)

### 4. Checkbox-Test
**Checkbox abhaken:**
```javascript
$('[data-name="cb1"]').prop('checked', true).trigger('change');
```
→ Bild sollte wieder zum Upload hinzugefügt werden

**Checkbox entfernen:**
```javascript
$('[data-name="cb1"]').prop('checked', false).trigger('change');
```
→ Bild sollte wieder aus Upload entfernt werden

### 5. Upload-Test
- cb1 abhaken
- Formular absenden
- Server sollte Bild erhalten

## Weitere Testbilder

Für Hard-Error-Tests (Bild wird immer entfernt):
- Zu kleine Dimensionen: 800×1000 px
- Falsches Format: .bmp, .gif, .webp
- Zu groß: > 500 KB
- Falsches Seitenverhältnis: 1:1 (quadratisch)

Diese können mit dem Generator-Skript angepasst werden.
