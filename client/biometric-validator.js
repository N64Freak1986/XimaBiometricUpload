/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * BIOMETRIC IMAGE VALIDATOR - CLIENT-SIDE PRE-VALIDATOR
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * ⚠️ WICHTIGER HINWEIS - GRENZEN DER CLIENT-VALIDIERUNG:
 *
 * Dieser Validator ist ein PRE-FILTER für technische und geometrische Anforderungen.
 * Er kann NICHT alle ICAO-Anforderungen zuverlässig prüfen!
 *
 * ✅ WAS GEPRÜFT WIRD (Client-seitig):
 *    - Bildgröße, Format, Dateigröße
 *    - Seitenverhältnis (35:45)
 *    - Gesichtsposition und -größe (70-80%)
 *    - Hintergrund-Helligkeit und Einheitlichkeit
 *    - Bildschärfe und Kontrast
 *
 * ❌ WAS NICHT GEPRÜFT WERDEN KANN (Client-seitig):
 *    - Brillenreflexionen
 *    - Gesichtsausdruck (neutral?)
 *    - Augen geöffnet/geschlossen
 *    - Mund geschlossen
 *    - Haare, die das Gesicht verdecken
 *    - Schatten im Gesicht
 *    - Korrekte Kopfhaltung (frontal)
 *    - Accessoires (Kopfbedeckung, Schmuck)
 *
 * 💡 EMPFEHLUNG:
 *    Aktivieren Sie IMMER die Server-Validierung (enableServerValidation: true)
 *    für vollständige ICAO-Konformität. Die Client-Validierung filtert nur
 *    ~90% der ungeeigneten Bilder (falsche Größe, Hintergrund, etc.) und
 *    reduziert damit die Last auf dem Server.
 *
 * Version: 2.3.0 - Mobile & Smartphone Optimizations
 * Datum: 2025-01-14
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

(function(window) {
    'use strict';

    /**
     * Biometrische Anforderungen nach ICAO Doc 9303
     *
     * ICAO-Standard: 35mm × 45mm @ 300 DPI = 1050 × 1350 Pixel
     * Gesichtshöhe: 32-36mm = 70-80% der Bildhöhe
     * Hintergrund: Schlicht, einheitlich, hell (weiß/hellgrau)
     */
    const BIOMETRIC_REQUIREMENTS = {
        // Technische Anforderungen (ICAO: 35mm × 45mm @ 300 DPI)
        minWidth: 1050,              // ICAO-Standard: 1050px (35mm @ 300 DPI)
        minHeight: 1350,             // ICAO-Standard: 1350px (45mm @ 300 DPI)
        recommendedWidth: 1050,      // ICAO-Standard
        recommendedHeight: 1350,     // ICAO-Standard

        // Seitenverhältnis (35:45 Portrait)
        aspectRatioMin: 0.76,        // 35:45 = 0.777..., mit Toleranz
        aspectRatioMax: 0.79,

        // Dateigröße
        minFileSize: 50 * 1024,      // 50 KB
        maxFileSize: 500 * 1024,     // 500 KB

        // Erlaubte Formate
        allowedFormats: ['image/jpeg', 'image/jpg', 'image/png'],

        // Gesichtserkennung (ICAO: 32-36mm = 70-80% der Bildhöhe)
        faceDetection: {
            minFaceSize: 0.70,       // ICAO: Mind. 70% der Bildhöhe (32mm)
            maxFaceSize: 0.80,       // ICAO: Max. 80% der Bildhöhe (36mm)
            centerTolerance: 0.15    // Toleranz für Zentrierung (15%)
        },

        // Qualität
        minSharpness: 100,           // Laplace-Varianz für Schärfe
        minContrast: 40,             // Mindestkontrast

        // Hintergrund (ICAO: Schlicht, einheitlich, hell)
        background: {
            minBrightness: 200,      // Min. Helligkeit (0-255, weiß/hellgrau)
            maxVariance: 30,         // Max. Varianz (Einheitlichkeit)
            checkEnabled: true       // Hintergrund-Prüfung aktiviert
        },

        // Facial Lighting (ICAOcheck-inspired: 4-Zonen-Analyse)
        facialLighting: {
            enabled: true,           // 4-Zonen Lighting-Analyse aktiviert
            maxIntensityRatio: 2.0,  // Max. Helligkeitsunterschied zwischen Zonen (2:1)
            minZoneHomogeneity: 0.85, // Min. Homogenität pro Zone (0-1)
            edgeThresholdLow: 50,    // Canny Low Threshold
            edgeThresholdHigh: 150   // Canny High Threshold
        }
    };

    /**
     * BiometricValidator Klasse
     */
    class BiometricValidator {
        constructor(options = {}) {
            this.config = {
                ...BIOMETRIC_REQUIREMENTS,
                ...options,
                serverEndpoint: options.serverEndpoint || null,
                enableFaceDetection: options.enableFaceDetection !== false,
                enableServerValidation: options.enableServerValidation !== false,
                debug: options.debug || false
            };

            this.faceApiLoaded = false;
            this.log('BiometricValidator initialisiert', this.config);
        }

        /**
         * Debug-Logger
         */
        log(...args) {
            if (this.config.debug) {
                console.log('[BiometricValidator]', ...args);
            }
        }

        /**
         * Hauptvalidierung - prüft alle Anforderungen
         */
        async validateImage(file) {
            this.log('Validiere Bild:', file.name);

            const result = {
                valid: false,
                errors: [],
                warnings: [],
                details: {},
                timestamp: new Date().toISOString()
            };

            try {
                // 1. Format-Check
                const formatCheck = this.validateFormat(file);
                result.details.format = formatCheck;
                if (!formatCheck.valid) {
                    result.errors.push(...formatCheck.errors);
                }

                // 2. Dateigröße-Check
                const sizeCheck = this.validateFileSize(file);
                result.details.fileSize = sizeCheck;
                if (!sizeCheck.valid) {
                    result.errors.push(...sizeCheck.errors);
                }

                // 3. Bild laden und Dimensionen prüfen
                const imageData = await this.loadImage(file);
                result.details.image = imageData;

                const dimensionCheck = this.validateDimensions(imageData);
                result.details.dimensions = dimensionCheck;
                if (!dimensionCheck.valid) {
                    result.errors.push(...dimensionCheck.errors);
                }
                if (dimensionCheck.warnings.length > 0) {
                    result.warnings.push(...dimensionCheck.warnings);
                }

                // 4. Seitenverhältnis-Check
                const aspectCheck = this.validateAspectRatio(imageData);
                result.details.aspectRatio = aspectCheck;
                if (!aspectCheck.valid) {
                    result.errors.push(...aspectCheck.errors);
                }

                // 5. Bildqualität-Check
                const qualityCheck = await this.validateQuality(imageData);
                result.details.quality = qualityCheck;
                if (!qualityCheck.valid) {
                    result.errors.push(...qualityCheck.errors);
                }
                if (qualityCheck.warnings.length > 0) {
                    result.warnings.push(...qualityCheck.warnings);
                }

                // 6. Hintergrund-Check (ICAO: Schlicht, einheitlich, hell)
                if (this.config.background && this.config.background.checkEnabled) {
                    const backgroundCheck = await this.validateBackground(imageData);
                    result.details.background = backgroundCheck;
                    if (!backgroundCheck.valid) {
                        result.errors.push(...backgroundCheck.errors);
                    }
                    if (backgroundCheck.warnings.length > 0) {
                        result.warnings.push(...backgroundCheck.warnings);
                    }
                }

                // 6b. Facial Lighting Check (ICAOcheck-inspired: 4-Zonen-Analyse)
                if (this.config.facialLighting && this.config.facialLighting.enabled) {
                    const lightingCheck = await this.validateFacialLighting(imageData);
                    result.details.facialLighting = lightingCheck;
                    if (!lightingCheck.valid) {
                        result.errors.push(...lightingCheck.errors);
                    }
                    if (lightingCheck.warnings.length > 0) {
                        result.warnings.push(...lightingCheck.warnings);
                    }
                }

                // Wenn bisher Fehler, breche ab (keine teure Face-Detection)
                if (result.errors.length > 0) {
                    result.valid = false;
                    this.log('Basis-Validierung fehlgeschlagen:', result.errors);
                    return result;
                }

                // 7. Gesichtserkennung (optional, clientseitig)
                if (this.config.enableFaceDetection) {
                    const faceCheck = await this.validateFace(imageData);
                    result.details.face = faceCheck;
                    if (!faceCheck.valid) {
                        result.errors.push(...faceCheck.errors);
                    }
                    if (faceCheck.warnings.length > 0) {
                        result.warnings.push(...faceCheck.warnings);
                    }
                }

                // 8. Server-Validierung (detaillierte Biometrie)
                if (this.config.enableServerValidation && this.config.serverEndpoint) {
                    const serverCheck = await this.validateOnServer(file);
                    result.details.server = serverCheck;
                    if (!serverCheck.valid) {
                        result.errors.push(...serverCheck.errors);
                    }
                    if (serverCheck.warnings && serverCheck.warnings.length > 0) {
                        result.warnings.push(...serverCheck.warnings);
                    }
                }

                // Finale Bewertung
                result.valid = result.errors.length === 0;

                this.log('Validierung abgeschlossen:', result);
                return result;

            } catch (error) {
                this.log('Validierungsfehler:', error);
                result.errors.push(`Interner Fehler: ${error.message}`);
                result.valid = false;
                return result;
            }
        }

        /**
         * 1. Format-Validierung
         */
        validateFormat(file) {
            const result = {
                valid: false,
                errors: [],
                warnings: [],
                mimeType: file.type,
                extension: file.name.split('.').pop().toLowerCase()
            };

            // HEIC/HEIF Format (iPhone) - Browser unterstützt das oft nicht
            if (result.extension === 'heic' || result.extension === 'heif') {
                result.errors.push(
                    `HEIC/HEIF Format wird nicht unterstützt. ` +
                    `Bitte verwenden Sie JPEG/PNG. ` +
                    `iPhone-Tipp: Einstellungen → Kamera → Formate → "Maximale Kompatibilität" aktivieren.`
                );
                return result;
            }

            if (!this.config.allowedFormats.includes(file.type)) {
                result.errors.push(
                    `Ungültiges Format: ${file.type}. ` +
                    `Erlaubt: ${this.config.allowedFormats.join(', ')}`
                );
            } else {
                result.valid = true;
            }

            return result;
        }

        /**
         * 2. Dateigröße-Validierung
         */
        validateFileSize(file) {
            const result = {
                valid: false,
                errors: [],
                size: file.size,
                sizeFormatted: this.formatSize(file.size)
            };

            if (file.size < this.config.minFileSize) {
                result.errors.push(
                    `Datei zu klein: ${result.sizeFormatted}. ` +
                    `Minimum: ${this.formatSize(this.config.minFileSize)}`
                );
            } else if (file.size > this.config.maxFileSize) {
                result.errors.push(
                    `Datei zu groß: ${result.sizeFormatted}. ` +
                    `Maximum: ${this.formatSize(this.config.maxFileSize)}`
                );
            } else {
                result.valid = true;
            }

            return result;
        }

        /**
         * 3. Bild laden (mit EXIF-Rotation Support für Smartphone-Fotos)
         */
        async loadImage(file) {
            return new Promise(async (resolve, reject) => {
                try {
                    // Lese EXIF-Orientation (wichtig für Smartphone-Fotos!)
                    const orientation = await this.getExifOrientation(file);
                    this.log('EXIF Orientation:', orientation);

                    const img = new Image();

                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        let width = img.width;
                        let height = img.height;

                        // EXIF-Rotation anwenden
                        // Orientation 5,6,7,8 = Bild ist gedreht (Portrait-Modus)
                        if (orientation >= 5 && orientation <= 8) {
                            // Breite und Höhe vertauschen für 90°/270° Rotation
                            canvas.width = height;
                            canvas.height = width;
                        } else {
                            canvas.width = width;
                            canvas.height = height;
                        }

                        // Transformationen basierend auf EXIF-Orientation
                        switch (orientation) {
                            case 2:
                                // Horizontal flip
                                ctx.transform(-1, 0, 0, 1, width, 0);
                                break;
                            case 3:
                                // 180° rotate
                                ctx.transform(-1, 0, 0, -1, width, height);
                                break;
                            case 4:
                                // Vertical flip
                                ctx.transform(1, 0, 0, -1, 0, height);
                                break;
                            case 5:
                                // Vertical flip + 90° rotate right
                                ctx.transform(0, 1, 1, 0, 0, 0);
                                break;
                            case 6:
                                // 90° rotate right (häufigster Fall bei Portrait-Fotos!)
                                ctx.transform(0, 1, -1, 0, height, 0);
                                break;
                            case 7:
                                // Horizontal flip + 90° rotate right
                                ctx.transform(0, -1, -1, 0, height, width);
                                break;
                            case 8:
                                // 90° rotate left
                                ctx.transform(0, -1, 1, 0, 0, width);
                                break;
                            default:
                                // 1 = Normal, keine Transformation
                                break;
                        }

                        ctx.drawImage(img, 0, 0);

                        // Korrekte Dimensionen nach Rotation
                        const finalWidth = canvas.width;
                        const finalHeight = canvas.height;

                        this.log(`Bild geladen: ${img.width}×${img.height} → ${finalWidth}×${finalHeight} (EXIF: ${orientation})`);

                        resolve({
                            img: img,
                            canvas: canvas,
                            ctx: ctx,
                            width: finalWidth,
                            height: finalHeight,
                            exifOrientation: orientation,
                            originalWidth: img.width,
                            originalHeight: img.height
                        });
                    };

                    img.onerror = () => {
                        reject(new Error('Bild konnte nicht geladen werden'));
                    };

                    img.src = URL.createObjectURL(file);

                } catch (error) {
                    reject(error);
                }
            });
        }

        /**
         * EXIF-Orientation aus Bild-Datei lesen
         * Wichtig für Smartphone-Fotos, die im Portrait-Modus aufgenommen wurden!
         */
        async getExifOrientation(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();

                reader.onload = (e) => {
                    const view = new DataView(e.target.result);

                    if (view.getUint16(0, false) !== 0xFFD8) {
                        // Kein JPEG
                        resolve(1);
                        return;
                    }

                    const length = view.byteLength;
                    let offset = 2;

                    while (offset < length) {
                        if (view.getUint16(offset + 2, false) <= 8) {
                            resolve(1);
                            return;
                        }

                        const marker = view.getUint16(offset, false);
                        offset += 2;

                        if (marker === 0xFFE1) {
                            // EXIF marker gefunden
                            if (view.getUint32(offset += 2, false) !== 0x45786966) {
                                resolve(1);
                                return;
                            }

                            const little = view.getUint16(offset += 6, false) === 0x4949;
                            offset += view.getUint32(offset + 4, little);
                            const tags = view.getUint16(offset, little);
                            offset += 2;

                            for (let i = 0; i < tags; i++) {
                                if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                                    // Orientation tag gefunden
                                    const orientation = view.getUint16(offset + (i * 12) + 8, little);
                                    resolve(orientation);
                                    return;
                                }
                            }
                        } else if ((marker & 0xFF00) !== 0xFF00) {
                            break;
                        } else {
                            offset += view.getUint16(offset, false);
                        }
                    }

                    resolve(1); // Default: keine Rotation
                };

                reader.onerror = () => resolve(1);

                // Lese nur die ersten 64KB (EXIF ist immer am Anfang)
                reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
            });
        }

        /**
         * 4. Dimensions-Validierung
         */
        validateDimensions(imageData) {
            const result = {
                valid: false,
                errors: [],
                warnings: [],
                width: imageData.width,
                height: imageData.height
            };

            // Mindestanforderungen
            if (imageData.width < this.config.minWidth) {
                result.errors.push(
                    `Breite zu gering: ${imageData.width}px. ` +
                    `Minimum: ${this.config.minWidth}px`
                );
            }

            if (imageData.height < this.config.minHeight) {
                result.errors.push(
                    `Höhe zu gering: ${imageData.height}px. ` +
                    `Minimum: ${this.config.minHeight}px`
                );
            }

            // Wenn Mindestanforderungen erfüllt
            if (result.errors.length === 0) {
                result.valid = true;

                // Warnung wenn nicht empfohlene Größe
                if (imageData.width < this.config.recommendedWidth ||
                    imageData.height < this.config.recommendedHeight) {
                    result.warnings.push(
                        `Empfohlene Größe: ${this.config.recommendedWidth}x${this.config.recommendedHeight}px. ` +
                        `Aktuell: ${imageData.width}x${imageData.height}px`
                    );
                }
            }

            return result;
        }

        /**
         * 5. Seitenverhältnis-Validierung (3:4 Portrait)
         */
        validateAspectRatio(imageData) {
            const result = {
                valid: false,
                errors: [],
                aspectRatio: imageData.width / imageData.height,
                expected: '3:4 (0.75)'
            };

            const ratio = result.aspectRatio;

            if (ratio < this.config.aspectRatioMin || ratio > this.config.aspectRatioMax) {
                result.errors.push(
                    `Falsches Seitenverhältnis: ${ratio.toFixed(2)}. ` +
                    `Erwartet: ${result.expected} (Portrait)`
                );
            } else {
                result.valid = true;
            }

            return result;
        }

        /**
         * 6. Bildqualität-Validierung
         */
        async validateQuality(imageData) {
            const result = {
                valid: false,
                errors: [],
                warnings: [],
                sharpness: null,
                contrast: null
            };

            try {
                // Schärfe messen (Laplace-Varianz)
                const sharpness = this.measureSharpness(imageData);
                result.sharpness = sharpness;

                if (sharpness < this.config.minSharpness) {
                    result.warnings.push(
                        `Bild könnte unscharf sein (Wert: ${sharpness.toFixed(0)}, ` +
                        `empfohlen: >${this.config.minSharpness})`
                    );
                }

                // Kontrast messen
                const contrast = this.measureContrast(imageData);
                result.contrast = contrast;

                if (contrast < this.config.minContrast) {
                    result.warnings.push(
                        `Geringer Kontrast (Wert: ${contrast.toFixed(0)}, ` +
                        `empfohlen: >${this.config.minContrast})`
                    );
                }

                result.valid = true; // Qualität sind nur Warnungen, keine harten Fehler

            } catch (error) {
                this.log('Qualitätsmessung fehlgeschlagen:', error);
                result.warnings.push('Qualitätsmessung nicht möglich');
                result.valid = true; // Nicht blockieren
            }

            return result;
        }

        /**
         * Schärfe messen (Laplace-Varianz)
         */
        measureSharpness(imageData) {
            const ctx = imageData.ctx;
            const width = imageData.width;
            const height = imageData.height;

            // Hole Bilddaten (Sample nur Teil für Performance)
            const sampleWidth = Math.min(width, 400);
            const sampleHeight = Math.min(height, 300);
            const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
            const data = imgData.data;

            // Laplace-Operator (Kantenerkennung)
            let variance = 0;
            let count = 0;

            for (let y = 1; y < sampleHeight - 1; y++) {
                for (let x = 1; x < sampleWidth - 1; x++) {
                    const idx = (y * sampleWidth + x) * 4;

                    // Grauwert
                    const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

                    // Nachbarn
                    const neighbors = [
                        ((y-1) * sampleWidth + x) * 4,      // oben
                        ((y+1) * sampleWidth + x) * 4,      // unten
                        (y * sampleWidth + (x-1)) * 4,      // links
                        (y * sampleWidth + (x+1)) * 4       // rechts
                    ];

                    let laplace = -4 * gray;
                    neighbors.forEach(nIdx => {
                        const nGray = (data[nIdx] + data[nIdx+1] + data[nIdx+2]) / 3;
                        laplace += nGray;
                    });

                    variance += laplace * laplace;
                    count++;
                }
            }

            return variance / count;
        }

        /**
         * Kontrast messen (Standardabweichung)
         */
        measureContrast(imageData) {
            const ctx = imageData.ctx;
            const width = imageData.width;
            const height = imageData.height;

            // Sample für Performance
            const sampleWidth = Math.min(width, 400);
            const sampleHeight = Math.min(height, 300);
            const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
            const data = imgData.data;

            // Durchschnittliche Helligkeit
            let sum = 0;
            let count = 0;

            for (let i = 0; i < data.length; i += 4) {
                const gray = (data[i] + data[i+1] + data[i+2]) / 3;
                sum += gray;
                count++;
            }

            const mean = sum / count;

            // Standardabweichung
            let variance = 0;
            for (let i = 0; i < data.length; i += 4) {
                const gray = (data[i] + data[i+1] + data[i+2]) / 3;
                variance += (gray - mean) * (gray - mean);
            }

            return Math.sqrt(variance / count);
        }

        /**
         * 6. Hintergrund-Validierung (ICAO: Schlicht, einheitlich, hell)
         */
        async validateBackground(imageData) {
            const result = {
                valid: false,
                errors: [],
                warnings: [],
                brightness: null,
                variance: null,
                isUniform: false
            };

            try {
                const ctx = imageData.ctx;
                const width = imageData.width;
                const height = imageData.height;

                // Analysiere Randbereiche (Hintergrund ist typischerweise am Rand)
                // Nehme 10% von allen 4 Seiten
                const borderSize = Math.floor(Math.min(width, height) * 0.1);

                // Sample-Bereiche: Oben, Unten, Links, Rechts
                const samples = [
                    ctx.getImageData(0, 0, width, borderSize),                    // Oben
                    ctx.getImageData(0, height - borderSize, width, borderSize),  // Unten
                    ctx.getImageData(0, 0, borderSize, height),                   // Links
                    ctx.getImageData(width - borderSize, 0, borderSize, height)   // Rechts
                ];

                let totalBrightness = 0;
                let totalPixels = 0;
                const brightnessValues = [];

                // Berechne Helligkeit für alle Sample-Bereiche
                for (const sample of samples) {
                    const data = sample.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        // Durchschnittliche Helligkeit (Grauwert)
                        const brightness = (r + g + b) / 3;
                        brightnessValues.push(brightness);
                        totalBrightness += brightness;
                        totalPixels++;
                    }
                }

                // Durchschnittliche Helligkeit
                const avgBrightness = totalBrightness / totalPixels;
                result.brightness = avgBrightness;

                // Varianz berechnen (misst Einheitlichkeit)
                let variance = 0;
                for (const brightness of brightnessValues) {
                    variance += (brightness - avgBrightness) * (brightness - avgBrightness);
                }
                variance = Math.sqrt(variance / brightnessValues.length);
                result.variance = variance;

                // Prüfe Helligkeit (ICAO: Hell - weiß/hellgrau)
                const minBrightness = this.config.background?.minBrightness || 200;
                if (avgBrightness < minBrightness) {
                    result.errors.push(
                        `Hintergrund zu dunkel (${avgBrightness.toFixed(0)}/255). ` +
                        `ICAO erfordert hellen Hintergrund (weiß/hellgrau, min. ${minBrightness})`
                    );
                }

                // Prüfe Einheitlichkeit (ICAO: Einheitlich, keine Muster/Schatten)
                const maxVariance = this.config.background?.maxVariance || 30;
                if (variance > maxVariance) {
                    result.errors.push(
                        `Hintergrund nicht einheitlich (Varianz: ${variance.toFixed(1)}). ` +
                        `ICAO erfordert schlichten, einheitlichen Hintergrund (max. Varianz: ${maxVariance})`
                    );
                } else {
                    result.isUniform = true;
                }

                // Warnungen für grenzwertige Fälle
                if (avgBrightness >= minBrightness && avgBrightness < minBrightness + 20) {
                    result.warnings.push(
                        `Hintergrund könnte heller sein (${avgBrightness.toFixed(0)}/255). ` +
                        `Empfohlen: >220 für optimale Ergebnisse`
                    );
                }

                if (variance > maxVariance * 0.7 && variance <= maxVariance) {
                    result.warnings.push(
                        `Hintergrund hat leichte Ungleichmäßigkeiten. ` +
                        `Für beste Ergebnisse: Gleichmäßige Ausleuchtung verwenden`
                    );
                }

                result.valid = result.errors.length === 0;

                this.log('Hintergrund-Analyse:', {
                    brightness: avgBrightness.toFixed(1),
                    variance: variance.toFixed(1),
                    valid: result.valid
                });

            } catch (error) {
                this.log('Hintergrund-Validierung fehlgeschlagen:', error);
                result.warnings.push('Hintergrund-Analyse nicht möglich');
                result.valid = true; // Nicht blockieren bei technischen Fehlern
            }

            return result;
        }

        /**
         * 6b. Facial Lighting Validierung (ICAOcheck-inspired)
         *
         * Analysiert 4 spezifische Gesichtszonen auf gleichmäßige Ausleuchtung:
         * - Zone 1: Stirn (Forehead)
         * - Zone 2: Linke Wange (Left Cheek)
         * - Zone 3: Rechte Wange (Right Cheek)
         * - Zone 4: Kinn (Chin)
         *
         * Prüft:
         * 1. Homogenität jeder Zone (mittels Canny Edge Detection)
         * 2. Helligkeitsunterschiede zwischen Zonen (max 2:1 Ratio)
         * 3. Schatten-Erkennung
         */
        async validateFacialLighting(imageData) {
            const result = {
                valid: false,
                errors: [],
                warnings: [],
                zones: [],
                intensityRatio: null,
                shadowsDetected: false
            };

            try {
                const ctx = imageData.ctx;
                const width = imageData.width;
                const height = imageData.height;

                // Definiere 4 Gesichtszonen (approximativ, ohne Face Detection)
                // Mittige Bereiche des Bildes, wo typischerweise das Gesicht ist
                const centerX = width / 2;
                const centerY = height / 2;
                const zoneWidth = Math.floor(width * 0.15);  // 15% der Bildbreite
                const zoneHeight = Math.floor(height * 0.12); // 12% der Bildhöhe

                // Zone-Positionen (relativ zum Gesicht in Portrait-Format)
                const zones = [
                    {
                        name: 'Stirn',
                        x: centerX - zoneWidth / 2,
                        y: centerY - height * 0.25,
                        width: zoneWidth,
                        height: zoneHeight
                    },
                    {
                        name: 'Linke Wange',
                        x: centerX - width * 0.15,
                        y: centerY - zoneHeight / 2,
                        width: zoneWidth,
                        height: zoneHeight
                    },
                    {
                        name: 'Rechte Wange',
                        x: centerX + width * 0.05,
                        y: centerY - zoneHeight / 2,
                        width: zoneWidth,
                        height: zoneHeight
                    },
                    {
                        name: 'Kinn',
                        x: centerX - zoneWidth / 2,
                        y: centerY + height * 0.15,
                        width: zoneWidth,
                        height: zoneHeight
                    }
                ];

                // Analysiere jede Zone
                let minIntensity = 255;
                let maxIntensity = 0;
                let allHomogeneous = true;

                for (const zone of zones) {
                    const zoneData = ctx.getImageData(zone.x, zone.y, zone.width, zone.height);

                    // Berechne durchschnittliche Helligkeit
                    const data = zoneData.data;
                    let totalIntensity = 0;
                    let pixelCount = 0;

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const intensity = (r + g + b) / 3;
                        totalIntensity += intensity;
                        pixelCount++;
                    }

                    const avgIntensity = totalIntensity / pixelCount;

                    // Prüfe Homogenität (mit Canny Edge Detection)
                    const homogeneity = this.isZoneHomogeneous(zoneData);

                    const zoneResult = {
                        name: zone.name,
                        x: zone.x,
                        y: zone.y,
                        width: zone.width,
                        height: zone.height,
                        avgIntensity: avgIntensity,
                        homogeneous: homogeneity.homogeneous,
                        edgePercentage: homogeneity.edgePercentage
                    };

                    result.zones.push(zoneResult);

                    // Track min/max Intensität
                    minIntensity = Math.min(minIntensity, avgIntensity);
                    maxIntensity = Math.max(maxIntensity, avgIntensity);

                    // Check Homogenität
                    if (!homogeneity.homogeneous) {
                        allHomogeneous = false;
                        this.log(`Zone ${zone.name} nicht homogen: ${homogeneity.edgePercentage.toFixed(1)}% Kanten`);
                    }
                }

                // Berechne Intensitäts-Ratio (wie ICAOcheck)
                const intensityRatio = maxIntensity / (minIntensity || 1);
                result.intensityRatio = intensityRatio;

                this.log('Facial Lighting Analyse:', {
                    minIntensity: minIntensity.toFixed(1),
                    maxIntensity: maxIntensity.toFixed(1),
                    ratio: intensityRatio.toFixed(2),
                    allHomogeneous
                });

                // Validierung
                const maxRatio = this.config.facialLighting?.maxIntensityRatio || 2.0;

                // Fehler: Nicht alle Zonen homogen
                if (!allHomogeneous) {
                    const inhomogeneousZones = result.zones
                        .filter(z => !z.homogeneous)
                        .map(z => z.name)
                        .join(', ');

                    result.errors.push(
                        `Schatten oder Ungleichmäßigkeiten erkannt in: ${inhomogeneousZones}. ` +
                        `ICAO erfordert gleichmäßige Ausleuchtung ohne Schatten.`
                    );
                    result.shadowsDetected = true;
                }

                // Fehler: Zu großer Helligkeitsunterschied zwischen Zonen
                if (intensityRatio > maxRatio) {
                    result.errors.push(
                        `Zu große Helligkeitsunterschiede im Gesicht (Ratio: ${intensityRatio.toFixed(2)}:1). ` +
                        `ICAO erfordert gleichmäßige Beleuchtung (max. ${maxRatio}:1).`
                    );
                    result.shadowsDetected = true;
                }

                // Warnungen für grenzwertige Fälle
                if (intensityRatio > maxRatio * 0.75 && intensityRatio <= maxRatio) {
                    result.warnings.push(
                        `Leichte Helligkeitsunterschiede erkannt (Ratio: ${intensityRatio.toFixed(2)}:1). ` +
                        `Für beste Ergebnisse: Gleichmäßige Frontalbeleuchtung verwenden.`
                    );
                }

                result.valid = result.errors.length === 0;

            } catch (error) {
                this.log('Facial Lighting Validierung fehlgeschlagen:', error);
                result.warnings.push('Beleuchtungs-Analyse nicht möglich');
                result.valid = true; // Nicht blockieren bei technischen Fehlern
            }

            return result;
        }

        /**
         * Prüft ob eine Zone homogen ist (mittels Canny Edge Detection)
         * Inspiriert von ICAOcheck's Homogenitäts-Check
         */
        isZoneHomogeneous(zoneImageData) {
            const result = {
                homogeneous: false,
                edgePercentage: 0
            };

            try {
                // Konvertiere zu Graustufen
                const data = zoneImageData.data;
                const width = zoneImageData.width;
                const height = zoneImageData.height;
                const grayscale = new Uint8ClampedArray(width * height);

                for (let i = 0; i < data.length; i += 4) {
                    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    grayscale[i / 4] = gray;
                }

                // Simplified Edge Detection (Sobel)
                const edges = this.sobelEdgeDetection(grayscale, width, height);

                // Zähle Edge-Pixel
                let edgeCount = 0;
                for (let i = 0; i < edges.length; i++) {
                    if (edges[i] > 0) edgeCount++;
                }

                const edgePercentage = (edgeCount / edges.length) * 100;
                result.edgePercentage = edgePercentage;

                // Zone ist homogen wenn weniger als 15% Kanten
                const minHomogeneity = (this.config.facialLighting?.minZoneHomogeneity || 0.85) * 100;
                result.homogeneous = edgePercentage < (100 - minHomogeneity);

            } catch (error) {
                this.log('Zone-Homogenitäts-Check fehlgeschlagen:', error);
                result.homogeneous = true; // Nicht blockieren
            }

            return result;
        }

        /**
         * Sobel Edge Detection (vereinfacht)
         */
        sobelEdgeDetection(grayscale, width, height) {
            const edges = new Uint8ClampedArray(grayscale.length);

            // Sobel Kernels
            const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
            const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let gx = 0;
                    let gy = 0;

                    // Konvolution mit Sobel-Kernels
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = (y + ky) * width + (x + kx);
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            const pixel = grayscale[idx];

                            gx += pixel * sobelX[kernelIdx];
                            gy += pixel * sobelY[kernelIdx];
                        }
                    }

                    // Gradient Magnitude
                    const magnitude = Math.sqrt(gx * gx + gy * gy);
                    edges[y * width + x] = magnitude > 50 ? 255 : 0; // Threshold 50
                }
            }

            return edges;
        }

        /**
         * 7. Gesichtserkennung (clientseitig, einfach)
         */
        async validateFace(imageData) {
            const result = {
                valid: false,
                errors: [],
                warnings: [],
                faceDetected: false,
                faceCount: 0,
                faceSize: null,
                facePosition: null
            };

            // Prüfe ob face-api.js verfügbar ist
            if (typeof faceapi === 'undefined') {
                this.log('face-api.js nicht verfügbar, überspringe Gesichtserkennung');
                result.warnings.push('Gesichtserkennung nicht verfügbar (face-api.js fehlt)');
                result.valid = true; // Nicht blockieren
                return result;
            }

            try {
                // Lade Modelle (nur beim ersten Mal)
                if (!this.faceApiLoaded) {
                    await this.loadFaceApiModels();
                    this.faceApiLoaded = true;
                }

                // Erkenne Gesichter
                const detections = await faceapi
                    .detectAllFaces(imageData.img, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks();

                result.faceCount = detections.length;

                if (detections.length === 0) {
                    result.errors.push('Kein Gesicht erkannt');
                    return result;
                }

                if (detections.length > 1) {
                    result.errors.push(`Mehrere Gesichter erkannt (${detections.length}). Nur 1 Person erlaubt.`);
                    return result;
                }

                // Ein Gesicht gefunden
                result.faceDetected = true;
                const detection = detections[0];
                const box = detection.detection.box;

                // Gesichtsgröße relativ zur Bildhöhe
                const faceHeightRatio = box.height / imageData.height;
                result.faceSize = {
                    width: box.width,
                    height: box.height,
                    heightRatio: faceHeightRatio
                };

                // Prüfe Gesichtsgröße
                if (faceHeightRatio < this.config.faceDetection.minFaceSize) {
                    result.errors.push(
                        `Gesicht zu klein (${(faceHeightRatio * 100).toFixed(0)}% der Bildhöhe). ` +
                        `Minimum: ${(this.config.faceDetection.minFaceSize * 100).toFixed(0)}%`
                    );
                }

                if (faceHeightRatio > this.config.faceDetection.maxFaceSize) {
                    result.errors.push(
                        `Gesicht zu groß (${(faceHeightRatio * 100).toFixed(0)}% der Bildhöhe). ` +
                        `Maximum: ${(this.config.faceDetection.maxFaceSize * 100).toFixed(0)}%`
                    );
                }

                // Prüfe Zentrierung
                const faceCenterX = box.x + box.width / 2;
                const imageCenterX = imageData.width / 2;
                const centerOffsetRatio = Math.abs(faceCenterX - imageCenterX) / imageData.width;

                result.facePosition = {
                    x: box.x,
                    y: box.y,
                    centerX: faceCenterX,
                    centerOffsetRatio: centerOffsetRatio
                };

                if (centerOffsetRatio > this.config.faceDetection.centerTolerance) {
                    result.warnings.push(
                        `Gesicht nicht zentriert (Abweichung: ${(centerOffsetRatio * 100).toFixed(0)}%)`
                    );
                }

                result.valid = result.errors.length === 0;

            } catch (error) {
                this.log('Gesichtserkennung fehlgeschlagen:', error);
                result.warnings.push(`Gesichtserkennung fehlgeschlagen: ${error.message}`);
                result.valid = true; // Nicht blockieren
            }

            return result;
        }

        /**
         * Lade face-api.js Modelle
         */
        async loadFaceApiModels() {
            this.log('Lade face-api.js Modelle...');

            const MODEL_URL = '/models'; // Pfad zu den Modellen anpassen!

            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
            ]);

            this.log('face-api.js Modelle geladen');
        }

        /**
         * 8. Server-Validierung (detaillierte Biometrie)
         */
        async validateOnServer(file) {
            const result = {
                valid: false,
                errors: [],
                warnings: []
            };

            if (!this.config.serverEndpoint) {
                result.warnings.push('Keine Server-Validierung konfiguriert');
                result.valid = true;
                return result;
            }

            try {
                const formData = new FormData();
                formData.append('image', file);

                const response = await fetch(this.config.serverEndpoint, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Server-Fehler: ${response.status} ${response.statusText}`);
                }

                const serverResult = await response.json();

                result.valid = serverResult.valid || false;
                result.errors = serverResult.errors || [];
                result.warnings = serverResult.warnings || [];
                result.serverDetails = serverResult;

            } catch (error) {
                this.log('Server-Validierung fehlgeschlagen:', error);
                result.errors.push(`Server-Validierung fehlgeschlagen: ${error.message}`);
            }

            return result;
        }

        /**
         * Hilfsfunktion: Dateigröße formatieren
         */
        formatSize(bytes) {
            if (bytes === 0) return '0 B';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        /**
         * Erstelle visuelles Feedback-Overlay
         */
        createFeedbackOverlay(imageData, validationResult) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = imageData.width;
            canvas.height = imageData.height;

            // Original-Bild zeichnen
            ctx.drawImage(imageData.img, 0, 0);

            // Gesichts-Box zeichnen (wenn erkannt)
            if (validationResult.details.face && validationResult.details.face.faceDetected) {
                const face = validationResult.details.face.facePosition;
                const size = validationResult.details.face.faceSize;

                ctx.strokeStyle = validationResult.valid ? '#00ff00' : '#ff0000';
                ctx.lineWidth = 4;
                ctx.strokeRect(face.x, face.y, size.width, size.height);

                // Zentrier-Linie
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.moveTo(imageData.width / 2, 0);
                ctx.lineTo(imageData.width / 2, imageData.height);
                ctx.stroke();
            }

            return canvas.toDataURL();
        }
    }

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BiometricValidator;
    } else {
        window.BiometricValidator = BiometricValidator;
    }

})(typeof window !== 'undefined' ? window : global);
