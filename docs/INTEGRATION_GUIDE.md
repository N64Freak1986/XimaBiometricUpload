# Integration Guide - Biometrische Bildprüfung in XIMA Formcycle

## 📋 Überblick

Diese Anleitung beschreibt, wie Sie die biometrische Bildprüfung in Ihr bestehendes XIMA Formcycle Multiple-Upload-System integrieren.

## 🎯 Ziel

Hochgeladene Bilder automatisch auf biometrische Anforderungen für Führerscheinfotos prüfen (nach ICAO/ISO 19794-5).

## 🏗️ Architektur

```
┌─────────────────────────────────────────────┐
│ XIMA Formcycle (Browser)                    │
│  ├─ Ihr bestehendes Multiple-Upload System  │
│  ├─ biometric-validator.js (Client)         │
│  └─ formcycle-integration.js                │
└─────────────────────────────────────────────┘
                  │
                  │ HTTP POST /api/validate-biometric
                  ▼
┌─────────────────────────────────────────────┐
│ Backend Server (Node.js oder Python)        │
│  ├─ REST API                                │
│  ├─ Gesichtserkennung                       │
│  ├─ Qualitätsprüfung                        │
│  └─ Hintergrundanalyse                      │
└─────────────────────────────────────────────┘
```

## 📦 Schritt 1: Dateien einbinden

### In Ihrem Formcycle-Formular

```html
<!-- face-api.js für clientseitige Gesichtserkennung (optional) -->
<script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.min.js"></script>

<!-- Biometric Validator -->
<script src="/path/to/biometric-validator.js"></script>

<!-- Formcycle Integration -->
<script src="/path/to/formcycle-integration.js"></script>
```

## 🎨 Schritt 2: Upload-Felder markieren

### Option A: Alle Upload-Felder (empfohlen für Passfotos)

```javascript
// In formcycle-integration.js
const CONFIG = {
    VALIDATION_STRATEGY: 'all',  // Alle Upload-Felder werden validiert
    ...
};
```

### Option B: Nur spezifische Felder

```javascript
// CSS-Klasse "biometric-upload" hinzufügen
const CONFIG = {
    VALIDATION_STRATEGY: 'biometric-upload',
    ...
};
```

Dann in Formcycle im Upload-Feld die CSS-Klasse hinzufügen:
```
biometric-upload
```

### Option C: Bestimmte Feld-IDs

```javascript
const CONFIG = {
    VALIDATION_STRATEGY: 'specific',
    SPECIFIC_FIELDS: ['xi-upl-passport-photo', 'xi-upl-id-photo'],
    ...
};
```

## 🔧 Schritt 3: Server-Endpoint konfigurieren

### In formcycle-integration.js

```javascript
const CONFIG = {
    SERVER_ENDPOINT: 'https://your-api.example.com/api/validate-biometric',
    ...
};
```

## 🖥️ Schritt 4: Backend-Server aufsetzen

### Option A: Node.js Server

```bash
cd server/node
npm install
npm start
```

Server läuft auf: `http://localhost:3000`

### Option B: Python Server

```bash
cd server/python
pip install -r requirements.txt
python app.py
```

Server läuft auf: `http://localhost:3000`

### Face-API Modelle (nur Node.js)

Laden Sie die face-api.js Modelle herunter:

```bash
cd server/node
mkdir models
cd models

# Modelle herunterladen
wget https://github.com/vladmandic/face-api/raw/master/model/ssdMobilenetv1-weights_manifest.json
wget https://github.com/vladmandic/face-api/raw/master/model/ssdMobilenetv1-shard1
# ... weitere Modelle
```

## 🎛️ Schritt 5: Konfiguration anpassen

### Biometrische Anforderungen anpassen

In `formcycle-integration.js`:

```javascript
const CONFIG = {
    BIOMETRIC_REQUIREMENTS: {
        minWidth: 1200,              // Mindestbreite
        minHeight: 900,              // Mindesthöhe
        maxFileSize: 500 * 1024,     // Max Dateigröße (500 KB)
        enableFaceDetection: true,   // Gesichtserkennung aktivieren
        enableServerValidation: true, // Server-Validierung aktivieren
        debug: true                  // Debug-Logs
    },
    ...
};
```

### UI-Einstellungen

```javascript
const CONFIG = {
    SHOW_PREVIEW: true,              // Bild-Vorschau anzeigen
    SHOW_VALIDATION_STEPS: true,     // Validierungs-Schritte anzeigen
    AUTO_REMOVE_INVALID: true,       // Ungültige Bilder automatisch entfernen
    ...
};
```

## ⚙️ Schritt 6: Integration mit Ihrem Multiple-Upload

Die biometrische Validierung integriert sich automatisch mit Ihrem bestehenden Upload-System:

```javascript
// Ihr bestehendes Upload-System bleibt unverändert!

// Die biometrische Validierung läuft automatisch im change-Event:
$uploadField.on('change', async function(e) {
    // 1. Ihre Multiple-Upload-Logik läuft
    // 2. Dann: Biometrische Validierung
    // 3. Ungültige Bilder werden entfernt
    // 4. Nur gültige Bilder werden hochgeladen
});
```

## 📊 Schritt 7: Validierungs-Feedback

### Visuelles Feedback

Die Integration erstellt automatisch ein UI mit:

```
┌──────────────────────────────────────────┐
│ 🔐 Biometrische Bildprüfung aktiv        │
│ Führerscheinfoto • Mind. 1200x900px     │
├──────────────────────────────────────────┤
│                                          │
│  ⏳ Format und Dateigröße...             │
│  ⏳ Bildabmessungen...                   │
│  ⏳ Bildqualität...                      │
│  ⏳ Gesichtserkennung...                 │
│  ⏳ Server-Validierung...                │
│                                          │
└──────────────────────────────────────────┘
```

### Erfolgsmeldung

```
┌──────────────────────────────────────────┐
│           ✅                              │
│  Bild erfüllt alle Anforderungen!        │
│  passport_photo.jpg                      │
└──────────────────────────────────────────┘
```

### Fehlermeldung

```
┌──────────────────────────────────────────┐
│           ❌                              │
│  Bild entspricht nicht den Anforderungen │
│                                          │
│  ❌ Gesicht zu klein: 45% (min: 60%)    │
│  ❌ Hintergrund zu dunkel: 150 (min: 200)│
│                                          │
│  ⚠️ Hinweise:                            │
│  • Bild möglicherweise unscharf          │
└──────────────────────────────────────────┘
```

## 🔒 Schritt 8: Produktiv-Setup

### Sicherheit

1. **HTTPS verwenden** (Let's Encrypt)
2. **CORS konfigurieren** (nur eigene Domain erlauben)
3. **Rate-Limiting** aktivieren
4. **File-Upload-Limits** setzen

### Performance

1. **CDN für Modelle** verwenden
2. **Caching** aktivieren
3. **Load Balancing** für hohe Last

### Monitoring

1. **Logging** aktivieren
2. **Error-Tracking** (z.B. Sentry)
3. **Uptime-Monitoring**

### Beispiel nginx-Config

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/validate-biometric {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Upload-Limits
        client_max_body_size 10M;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## 🐛 Troubleshooting

### Problem: "BiometricValidator nicht geladen"

**Lösung:** Stellen Sie sicher, dass `biometric-validator.js` VOR `formcycle-integration.js` eingebunden ist.

### Problem: "face-api.js Modelle nicht gefunden"

**Lösung:**
1. Laden Sie die Modelle herunter (siehe Schritt 4)
2. Passen Sie den Modell-Pfad an:
   ```javascript
   const MODEL_URL = '/models'; // Pfad anpassen!
   ```

### Problem: Server-Validierung schlägt fehl

**Lösung:**
1. Prüfen Sie, ob der Server läuft: `curl http://localhost:3000/health`
2. Prüfen Sie CORS-Einstellungen
3. Prüfen Sie die Server-Logs

### Problem: Gesichtserkennung zu langsam

**Lösung:**
1. Deaktivieren Sie clientseitige Gesichtserkennung:
   ```javascript
   enableFaceDetection: false
   ```
2. Nur Server-Validierung nutzen

### Problem: Zu viele False-Positives

**Lösung:** Passen Sie die Anforderungen an:
```javascript
const BIOMETRIC_REQUIREMENTS = {
    face: {
        minSizeRatio: 0.50,  // Reduzieren auf 50%
        centerToleranceX: 0.20,  // Mehr Toleranz
    }
};
```

## 📞 Support

Bei Fragen oder Problemen:

1. Prüfen Sie die Logs (Browser-Console + Server-Logs)
2. Aktivieren Sie Debug-Modus: `debug: true`
3. Kontaktieren Sie den Support

## 🔄 Updates

Die Lösung wird kontinuierlich verbessert. Prüfen Sie regelmäßig auf Updates:

```bash
git pull origin main
npm install  # oder: pip install -r requirements.txt
```

## ✅ Checkliste

- [ ] Dateien eingebunden (biometric-validator.js, formcycle-integration.js)
- [ ] Upload-Felder markiert (CSS-Klasse oder Strategie)
- [ ] Server-Endpoint konfiguriert
- [ ] Backend-Server läuft
- [ ] Face-API Modelle heruntergeladen (Node.js)
- [ ] Test mit echtem Passfoto durchgeführt
- [ ] HTTPS aktiviert (Produktion)
- [ ] CORS konfiguriert (Produktion)
- [ ] Logging aktiviert
- [ ] Monitoring eingerichtet

## 🎉 Fertig!

Ihre biometrische Bildprüfung ist jetzt aktiv. Benutzer erhalten sofortiges Feedback, ob ihr Foto den Anforderungen entspricht!
