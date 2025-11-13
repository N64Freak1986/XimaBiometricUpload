# XIMA Biometric Image Upload

Biometrische Bildprüfung für Führerscheinfotos in XIMA Formcycle

## 📋 Überblick

Diese Lösung erweitert das XIMA Formcycle Upload-System um biometrische Validierung nach ICAO/ISO 19794-5 Standards für Führerscheinfotos.

## ✅ Geprüfte Kriterien

### Technische Anforderungen
- ✅ Bildformat (JPEG, PNG)
- ✅ Mindestauflösung (600x450 Pixel, empfohlen 1200x900)
- ✅ Dateigröße (50 KB - 500 KB)
- ✅ Seitenverhältnis (3:4 Portrait)
- ✅ Bildqualität und Schärfe

### Biometrische Anforderungen
- ✅ Gesichtserkennung (genau 1 Gesicht)
- ✅ Gesichtsgröße (60-80% der Bildhöhe)
- ✅ Gesichtsposition (zentriert)
- ✅ Augenerkennung (beide Augen offen und sichtbar)
- ✅ Hintergrund (einheitlich, hell)
- ✅ Keine Sonnenbrillen oder Kopfbedeckungen (außer religiös)
- ✅ Beleuchtung (gleichmäßig, keine Schatten)

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────┐
│ XIMA Formcycle (Browser)                                 │
│                                                           │
│  1. Upload-Feld                                          │
│  2. Client-Vorvalidierung (biometric-validator.js)       │
│     ├─ Bildgröße, Format, Auflösung                     │
│     └─ Einfache Gesichtserkennung (face-api.js)         │
│                                                           │
│  3. Visuelles Feedback                                   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ POST /upload
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Backend-Server (Node.js oder Python)                     │
│                                                           │
│  4. Server-Validierung (API)                             │
│     ├─ Detaillierte Gesichtserkennung                   │
│     ├─ Positionsprüfung                                 │
│     ├─ Hintergrundanalyse                               │
│     ├─ Qualitätsprüfung                                 │
│     └─ Metadaten-Extraktion                             │
│                                                           │
│  5. Speicherung + Protokollierung                        │
└─────────────────────────────────────────────────────────┘
```

## 📦 Komponenten

### 1. Client-Seite (`client/`)
- `biometric-validator.js` - Hauptvalidierung
- `formcycle-integration.js` - Integration in Ihr bestehendes Upload-System
- `face-detection-client.js` - Clientseitige Gesichtserkennung

### 2. Server-Seite (`server/`)
- `node/` - Node.js Implementation (Express + face-api.js)
- `python/` - Python Implementation (Flask + OpenCV + dlib)

### 3. Dokumentation (`docs/`)
- Anforderungen nach ICAO Standard
- API-Dokumentation
- Integrations-Guide

## 🚀 Quick Start

### Client-Integration in Formcycle

```html
<!-- 1. JavaScript-Dateien einbinden -->
<script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.min.js"></script>
<script src="/path/to/biometric-validator.js"></script>
<script src="/path/to/formcycle-integration.js"></script>

<!-- 2. Upload-Feld erstellen - ALLE Upload-Felder werden automatisch validiert! -->
<input type="file" accept="image/jpeg,image/png">
```

**Das war's!** Die biometrische Validierung läuft jetzt automatisch für **alle** Upload-Felder.

### Nur bestimmte Felder validieren?

Ändern Sie in `formcycle-integration.js`:

```javascript
const CONFIG = {
    VALIDATION_STRATEGY: 'biometric-upload',  // Statt 'all'
    ...
};
```

Dann nur Felder mit CSS-Klasse `biometric-upload` markieren:
```html
<input type="file" class="biometric-upload">
```

### Server Setup

#### Option A: Node.js
```bash
cd server/node
npm install
npm start
```

#### Option B: Python
```bash
cd server/python
pip install -r requirements.txt
python app.py
```

## 📖 Standards & Referenzen

- **ICAO Doc 9303** - Machine Readable Travel Documents
- **ISO/IEC 19794-5** - Face Image Data
- **ISO/IEC 29794-5** - Face Image Quality
- **BSI TR-03121** - Biometrics for Public Sector Applications

## 🔒 Datenschutz

- Bilder werden nur temporär verarbeitet
- Keine Speicherung biometrischer Templates
- DSGVO-konform
- Audit-Log für alle Prüfungen

## 📝 Lizenz

Proprietär - XIMA MEDIA GmbH
