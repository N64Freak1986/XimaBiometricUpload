# Biometrische Anforderungen für Führerscheinfotos

## 📚 Standards

Diese Implementierung basiert auf folgenden internationalen Standards:

- **ICAO Doc 9303** - Machine Readable Travel Documents (Part 3)
- **ISO/IEC 19794-5:2011** - Biometric data interchange formats - Part 5: Face image data
- **ISO/IEC 29794-5:2010** - Biometric sample quality - Part 5: Face image data
- **BSI TR-03121** - Biometrics for Public Sector Applications (Germany)

## 🎯 Anforderungen im Detail

### 1. Technische Anforderungen

#### 1.1 Bildformat
- ✅ **Erlaubte Formate:** JPEG, PNG
- ✅ **Farbtiefe:** 24-bit Farbe (RGB) oder 8-bit Graustufen
- ✅ **Kompression:** JPEG mit Qualität ≥ 80% oder PNG verlustfrei

#### 1.2 Bildgröße
- ✅ **Mindestauflösung:** 600 x 450 Pixel
- ✅ **Empfohlene Auflösung:** 1200 x 900 Pixel oder höher
- ✅ **Maximale Dateigröße:** 500 KB
- ✅ **Minimale Dateigröße:** 50 KB

#### 1.3 Seitenverhältnis
- ✅ **Format:** Portrait (Hochformat)
- ✅ **Verhältnis:** 3:4 (0.75)
- ✅ **Toleranz:** ±5% (0.70 - 0.80)

### 2. Inhaltliche Anforderungen

#### 2.1 Gesicht

##### Position
- ✅ **Zentriert:** Gesicht horizontal zentriert (±15% Toleranz)
- ✅ **Höhe:** Kopf von Kinn bis Haarspitze: 60-85% der Bildhöhe
- ✅ **Frontalansicht:** Gesicht frontal zur Kamera
- ✅ **Kopfhaltung:** Keine Neigung oder Drehung

##### Gesichtsausdruck
- ✅ **Neutral:** Neutraler Gesichtsausdruck
- ✅ **Mund:** Geschlossen
- ✅ **Zähne:** Nicht sichtbar
- ✅ **Lächeln:** Nicht erlaubt

#### 2.2 Augen

##### Sichtbarkeit
- ✅ **Beide Augen:** Klar sichtbar
- ✅ **Geöffnet:** Vollständig geöffnet
- ✅ **Blickrichtung:** Direkt in die Kamera
- ✅ **Pupillen:** Deutlich erkennbar

##### Position
- ✅ **Augenhöhe:** Auf einer horizontalen Linie (±5°)
- ✅ **Augenabstand:** Mindestens 90 Pixel
- ✅ **Höhe:** Augen im oberen Drittel des Bildes

##### Verdeckungen
- ❌ **Sonnenbrillen:** Nicht erlaubt
- ❌ **Getönte Gläser:** Nicht erlaubt
- ⚠️ **Normale Brillen:** Erlaubt, wenn:
  - Keine Reflexionen
  - Augen klar erkennbar
  - Rahmen verdeckt Augen nicht

#### 2.3 Kopfbedeckung

##### Allgemein
- ❌ **Hüte:** Nicht erlaubt
- ❌ **Mützen:** Nicht erlaubt
- ❌ **Caps:** Nicht erlaubt
- ❌ **Kopftücher:** Nicht erlaubt (außer aus religiösen Gründen)

##### Ausnahmen (religiöse Kopfbedeckung)
- ✅ **Erlaubt, wenn:**
  - Gesicht von Kinn bis Stirn sichtbar
  - Keine Schatten im Gesicht
  - Gesichtskonturen erkennbar

#### 2.4 Hintergrund

##### Farbe und Muster
- ✅ **Einheitlich:** Einfarbig, ohne Muster
- ✅ **Hell:** Helle Farbe (idealerweise weiß oder hellgrau)
- ✅ **Helligkeit:** Mindestens RGB(200, 200, 200)
- ❌ **Objekte:** Keine Objekte im Hintergrund

##### Qualität
- ✅ **Keine Schatten:** Besonders nicht im Gesicht
- ✅ **Gleichmäßige Beleuchtung:** Keine hellen/dunklen Flecken
- ✅ **Scharf:** Kanten klar erkennbar

### 3. Qualitätsanforderungen

#### 3.1 Schärfe
- ✅ **Gesicht:** Scharf und klar erkennbar
- ✅ **Augen:** Pupillen scharf
- ✅ **Messmetrik:** Laplace-Varianz > 100
- ❌ **Bewegungsunschärfe:** Nicht erlaubt
- ❌ **Fokus-Unschärfe:** Nicht erlaubt

#### 3.2 Beleuchtung

##### Helligkeit
- ✅ **Gleichmäßig:** Keine über-/unterbelichteten Bereiche
- ✅ **Gesicht:** Gut ausgeleuchtet
- ✅ **Durchschnitt:** 50-200 (auf Skala 0-255)
- ❌ **Gegenlicht:** Nicht erlaubt

##### Schatten
- ✅ **Keine Schatten:** Besonders nicht im Gesicht
- ✅ **Weiche Beleuchtung:** Diffuses Licht bevorzugt
- ❌ **Harte Schatten:** Von Nase, Kinn, Hintergrund nicht erlaubt

##### Lichtquelle
- ✅ **Vorne:** Licht von vorne oder leicht oben
- ❌ **Seitlich:** Nicht stark von der Seite
- ❌ **Blitz:** Vermeiden (kann rote Augen/Schatten verursachen)

#### 3.3 Kontrast
- ✅ **Ausreichend:** Gesicht hebt sich vom Hintergrund ab
- ✅ **Natürlich:** Keine übertriebene Bearbeitung
- ✅ **Messmetrik:** Standardabweichung > 40

#### 3.4 Farbe
- ✅ **Natürlich:** Natürliche Hauttöne
- ✅ **Korrekt:** Keine Farbstiche (Rot/Blau/Grün)
- ✅ **Unbearbeitet:** Keine Filter oder Effekte

### 4. Verbotene Elemente

#### 4.1 Kleidung und Accessoires
- ❌ **Sonnenbrillen**
- ❌ **Kopfhörer**
- ❌ **Große Ohrringe** (die Gesichtskonturen verdecken)
- ❌ **Schals** (über Gesicht)

#### 4.2 Weitere Personen
- ❌ **Mehrere Personen:** Nur eine Person erlaubt
- ❌ **Tiere:** Keine Haustiere
- ❌ **Spielzeug:** Keine Gegenstände (z.B. bei Kinderfotos)

#### 4.3 Bearbeitung
- ❌ **Retusche:** Keine digitale Nachbearbeitung
- ❌ **Filter:** Keine Instagram/Snapchat-Filter
- ❌ **Rahmen:** Keine Rahmen oder Wasserzeichen
- ❌ **Morphing:** Keine Verzerrungen

### 5. Besonderheiten

#### 5.1 Kinder
- ⚠️ **Unter 6 Jahren:**
  - Neutraler Ausdruck kann schwierig sein
  - Leicht geöffneter Mund akzeptabel
  - Kopfhaltung: Mehr Toleranz

#### 5.2 Medizinische Ausnahmen
- ⚠️ **Brillen:** Pflicht bei medizinischer Notwendigkeit
- ⚠️ **Augenklappe:** Bei medizinischer Notwendigkeit erlaubt
- ⚠️ **Narben/Behinderungen:** Dokumentation erforderlich

#### 5.3 Religiöse Ausnahmen
- ⚠️ **Kopfbedeckung:**
  - Gesicht muss vollständig sichtbar sein
  - Von Kinn bis Stirn
  - Keine Schatten

### 6. Zeitliche Anforderungen

#### 6.1 Aktualität
- ✅ **Maximum:** Foto nicht älter als 6 Monate
- ✅ **Aussehen:** Muss aktuelles Aussehen zeigen
- ✅ **Frisur/Bart:** Signifikante Änderungen → neues Foto

### 7. Validierungs-Reihenfolge

Die Implementierung prüft in folgender Reihenfolge:

1. **Format & Dateigröße** (Client)
   - JPEG/PNG?
   - 50 KB - 500 KB?

2. **Dimensionen** (Client)
   - ≥ 600 x 450 px?
   - Seitenverhältnis 3:4?

3. **Bildqualität** (Client + Server)
   - Schärfe ausreichend?
   - Kontrast OK?
   - Helligkeit im Bereich?

4. **Gesichtserkennung** (Server)
   - Genau 1 Gesicht?
   - Größe 60-85%?
   - Zentriert?

5. **Augen** (Server)
   - Beide sichtbar?
   - Abstand > 90px?
   - Horizontal?

6. **Hintergrund** (Server)
   - Einheitlich?
   - Hell genug?
   - Keine Schatten?

7. **EXIF-Daten** (Server)
   - Datum < 6 Monate?
   - Kein Blitz?

### 8. Fehlermeldungen

Die Implementierung liefert klare Fehlermeldungen:

#### Kritische Fehler (blockieren Upload)
- ❌ "Kein Gesicht erkannt"
- ❌ "Mehrere Gesichter erkannt"
- ❌ "Gesicht zu klein/groß"
- ❌ "Bildabmessungen zu gering"
- ❌ "Bild zu dunkel/hell"
- ❌ "Hintergrund zu dunkel"

#### Warnungen (Upload möglich, aber nicht optimal)
- ⚠️ "Gesicht nicht zentriert"
- ⚠️ "Bild möglicherweise unscharf"
- ⚠️ "Geringer Kontrast"
- ⚠️ "Kopf leicht geneigt"
- ⚠️ "Hintergrund nicht einheitlich"
- ⚠️ "Blitz wurde verwendet"
- ⚠️ "Foto möglicherweise zu alt"

### 9. Best Practices für gute Fotos

#### Setup
1. **Kamera:** Smartphone oder Digital-Kamera (≥ 5 Megapixel)
2. **Stativ:** Oder Kamera auf stabilem Untergrund
3. **Abstand:** 1.5 - 2 Meter zur Person
4. **Höhe:** Kamera auf Augenhöhe

#### Beleuchtung
1. **Natürliches Licht:** Tageslicht bevorzugt
2. **Diffus:** Weiches Licht (z.B. bewölkter Tag)
3. **Von vorne:** Lichtquelle hinter der Kamera
4. **Zwei Lampen:** Bei Kunstlicht, 45° links/rechts

#### Hintergrund
1. **Weiße Wand:** Optimal
2. **Weißes Tuch:** Als Alternative
3. **Abstand:** Min. 50 cm zur Wand (verhindert Schatten)

#### Person
1. **Kleidung:** Kontrast zum Hintergrund
2. **Haare:** Aus dem Gesicht
3. **Brille:** Putzen, auf Reflexionen achten
4. **Position:** Gerade stehen, Schultern entspannt

#### Aufnahme
1. **Fokus:** Auf Augen
2. **Zoom:** Leicht heranzoomen (kein Weitwinkel)
3. **Mehrere Fotos:** 5-10 Aufnahmen machen
4. **Sofort prüfen:** Schärfe und Beleuchtung kontrollieren

### 10. Referenzen

- [ICAO Doc 9303](https://www.icao.int/publications/pages/publication.aspx?docnum=9303)
- [ISO/IEC 19794-5](https://www.iso.org/standard/50867.html)
- [BSI TR-03121](https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/Technische-Richtlinien/TR-nach-Thema-sortiert/tr03121/tr-03121.html)

### 11. Prüf-Checkliste

Vor dem Upload prüfen:

- [ ] Nur eine Person sichtbar
- [ ] Frontalansicht, Blick in Kamera
- [ ] Neutraler Gesichtsausdruck
- [ ] Beide Augen offen und sichtbar
- [ ] Keine Sonnenbrille
- [ ] Keine Kopfbedeckung (außer religiös)
- [ ] Heller, einheitlicher Hintergrund
- [ ] Keine Schatten im Gesicht
- [ ] Gesicht scharf und gut belichtet
- [ ] Kopf zentriert
- [ ] Gesichtshöhe 60-85% des Bildes
- [ ] Aktuelle Aufnahme (< 6 Monate)
- [ ] Keine Bearbeitung/Filter
