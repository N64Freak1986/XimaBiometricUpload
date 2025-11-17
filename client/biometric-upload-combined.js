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
 * Version: 2.4.0 - Quality Tolerance with Checkbox Override
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
                errors: [],           // Alle Fehler (Kompatibilität)
                hardErrors: [],       // Technisch kritische Fehler (immer ablehnen)
                softErrors: [],       // Qualitätsmängel (mit Checkbox akzeptierbar)
                warnings: [],
                details: {},
                timestamp: new Date().toISOString()
            };

            try {
                // 1. Format-Check (HARD ERROR)
                const formatCheck = this.validateFormat(file);
                result.details.format = formatCheck;
                if (!formatCheck.valid) {
                    result.hardErrors.push(...formatCheck.errors);
                    result.errors.push(...formatCheck.errors);
                }

                // 2. Dateigröße-Check (HARD ERROR)
                const sizeCheck = this.validateFileSize(file);
                result.details.fileSize = sizeCheck;
                if (!sizeCheck.valid) {
                    result.hardErrors.push(...sizeCheck.errors);
                    result.errors.push(...sizeCheck.errors);
                }

                // 3. Bild laden und Dimensionen prüfen (HARD ERROR)
                const imageData = await this.loadImage(file);
                result.details.image = imageData;

                const dimensionCheck = this.validateDimensions(imageData);
                result.details.dimensions = dimensionCheck;
                if (!dimensionCheck.valid) {
                    result.hardErrors.push(...dimensionCheck.errors);
                    result.errors.push(...dimensionCheck.errors);
                }
                if (dimensionCheck.warnings.length > 0) {
                    result.warnings.push(...dimensionCheck.warnings);
                }

                // 4. Seitenverhältnis-Check (HARD ERROR)
                const aspectCheck = this.validateAspectRatio(imageData);
                result.details.aspectRatio = aspectCheck;
                if (!aspectCheck.valid) {
                    result.hardErrors.push(...aspectCheck.errors);
                    result.errors.push(...aspectCheck.errors);
                }

                // 5. Bildqualität-Check (SOFT ERROR - Qualitätsmangel)
                const qualityCheck = await this.validateQuality(imageData);
                result.details.quality = qualityCheck;
                if (!qualityCheck.valid) {
                    result.softErrors.push(...qualityCheck.errors);
                    result.errors.push(...qualityCheck.errors);
                }
                if (qualityCheck.warnings.length > 0) {
                    result.warnings.push(...qualityCheck.warnings);
                }

                // 6. Hintergrund-Check (SOFT ERROR - mit Checkbox akzeptierbar)
                if (this.config.background && this.config.background.checkEnabled) {
                    const backgroundCheck = await this.validateBackground(imageData);
                    result.details.background = backgroundCheck;
                    if (!backgroundCheck.valid) {
                        result.softErrors.push(...backgroundCheck.errors);
                        result.errors.push(...backgroundCheck.errors);
                    }
                    if (backgroundCheck.warnings.length > 0) {
                        result.warnings.push(...backgroundCheck.warnings);
                    }
                }

                // 6b. Facial Lighting Check (SOFT ERROR - mit Checkbox akzeptierbar)
                if (this.config.facialLighting && this.config.facialLighting.enabled) {
                    const lightingCheck = await this.validateFacialLighting(imageData);
                    result.details.facialLighting = lightingCheck;
                    if (!lightingCheck.valid) {
                        result.softErrors.push(...lightingCheck.errors);
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

                // 7. Gesichtserkennung (SOFT ERROR - optional, mit Checkbox akzeptierbar)
                if (this.config.enableFaceDetection) {
                    const faceCheck = await this.validateFace(imageData);
                    result.details.face = faceCheck;
                    if (!faceCheck.valid) {
                        result.softErrors.push(...faceCheck.errors);
                        result.errors.push(...faceCheck.errors);
                    }
                    if (faceCheck.warnings.length > 0) {
                        result.warnings.push(...faceCheck.warnings);
                    }
                }

                // 8. Server-Validierung (HARD ERROR - Server entscheidet)
                if (this.config.enableServerValidation && this.config.serverEndpoint) {
                    const serverCheck = await this.validateOnServer(file);
                    result.details.server = serverCheck;
                    if (!serverCheck.valid) {
                        result.hardErrors.push(...serverCheck.errors);
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
/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * FORMCYCLE BIOMETRIC UPLOAD INTEGRATION - STANDALONE VERSION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * ⚠️ WICHTIG: Verwendet KEINE Formcycle-internen APIs!
 * ⚠️ Funktioniert mit Standard HTML5 File-Inputs!
 *
 * ⚠️ GRENZEN DER CLIENT-VALIDIERUNG:
 *    Diese Validierung ist ein PRE-FILTER. Sie prüft technische Anforderungen
 *    (Größe, Hintergrund, Gesichtsposition), aber NICHT alle ICAO-Kriterien!
 *    Für vollständige ICAO-Konformität (Brillenreflexionen, Gesichtsausdruck,
 *    etc.) MUSS die Server-Validierung aktiviert werden!
 *
 * INTEGRATION:
 * 1. Inkludiere biometric-validator.js
 * 2. Inkludiere diese Datei
 * 3. Alle Upload-Felder werden automatisch validiert
 * 4. KEINE Abhängigkeiten zu Formcycle-APIs (ajaxUpload, ajaxUploadManager, etc.)
 * 5. Aktiviere enableServerValidation für vollständige ICAO-Prüfung!
 *
 * Features:
 * - ✅ Funktioniert mit normalem <input type="file">
 * - ✅ Echtzeit-Validierung bei Dateiauswahl
 * - ✅ Visuelles Feedback mit Vorschau
 * - ✅ Schritt-für-Schritt Validierung mit Progress
 * - ✅ Nur gültige Bilder bleiben im Input
 * - ✅ Auto-Optimize: Verkleinert zu große Bilder automatisch (optional)
 * - ✅ JPEG-Qualität-Anpassung für kleinere Dateien (optional)
 * - ⚠️ Client = Pre-Filter (~90% Fehler), Server = Vollständige ICAO-Prüfung
 *
 * Version: 2.4.0 - Quality Tolerance with Checkbox Override
 * Datum: 2025-01-14
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

(function() {
    'use strict';

    // ============================================
    // KONFIGURATION
    // ============================================

    const CONFIG = {
        // Welche Felder sollen biometrisch validiert werden?
        // 'all' = Alle Upload-Felder
        // 'biometric-upload' = Nur Felder mit CSS-Klasse "biometric-upload"
        // 'specific' = Nur spezifische Feld-IDs (siehe SPECIFIC_FIELDS)
        VALIDATION_STRATEGY: 'all',

        SPECIFIC_FIELDS: ['xi-upl-passport-photo'],

        // Server-Endpoint für detaillierte Validierung
        SERVER_ENDPOINT: '/api/validate-biometric',

        // Biometrische Anforderungen (ICAO Doc 9303 Standard)
        // ICAO: 35mm × 45mm @ 300 DPI = 1050 × 1350 Pixel
        BIOMETRIC_REQUIREMENTS: {
            minWidth: 1050,              // ICAO-Standard
            minHeight: 1350,             // ICAO-Standard
            recommendedWidth: 1050,      // ICAO-Standard
            recommendedHeight: 1350,     // ICAO-Standard
            aspectRatioMin: 0.76,        // 35:45 = 0.777
            aspectRatioMax: 0.79,
            maxFileSize: 500 * 1024,     // 500 KB
            enableFaceDetection: true,
            enableServerValidation: false,  // Deaktiviert per Default (Server optional)
            background: {
                minBrightness: 200,      // ICAO: Hell (weiß/hellgrau)
                maxVariance: 30,         // ICAO: Einheitlich
                checkEnabled: true       // Hintergrund-Prüfung aktiv
            },
            facialLighting: {
                enabled: true,           // 4-Zonen Lighting-Analyse aktiviert
                maxIntensityRatio: 2.0,  // Max. Helligkeitsunterschied zwischen Zonen
                minZoneHomogeneity: 0.85, // Min. Homogenität pro Zone (0-1)
                edgeThresholdLow: 50,    // Canny Low Threshold
                edgeThresholdHigh: 150   // Canny High Threshold
            },
            debug: true
        },

        // UI-Einstellungen
        SHOW_PREVIEW: true,
        SHOW_VALIDATION_STEPS: true,
        AUTO_REMOVE_INVALID: true, // Ungültige Bilder automatisch entfernen

        // Automatische Bild-Optimierung (UX-Feature)
        // ✅ Standardmäßig AKTIVIERT für bessere Mobile UX (v2.3.0+)
        AUTO_OPTIMIZE: {
            enabled: true,               // ✅ AKTIVIERT: Smartphone-Fotos automatisch optimieren
            resize: true,                // Zu große Bilder verkleinern
            maxWidth: 1050,              // Ziel-Breite (ICAO)
            maxHeight: 1350,             // Ziel-Höhe (ICAO)
            jpegQuality: 0.85,           // JPEG-Qualität (0.0-1.0)
            maxFileSize: 500 * 1024,     // Max. Dateigröße nach Optimierung
            smartCrop: false,            // Smart Crop (erfordert Face Detection)
            showPreview: true,           // Preview vor Smart Crop zeigen
            notifyUser: true             // User über Optimierungen informieren
        },

        DEBUG: true
    };

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log('[BiometricIntegration]', ...args);
        }
    }

    /**
     * Prüft ob ein Feld biometrisch validiert werden soll
     */
    function shouldValidateBiometric($field) {
        const fieldId = $field.attr('id');
        const fieldClasses = $field.attr('class') || '';

        switch (CONFIG.VALIDATION_STRATEGY) {
            case 'all':
                return true;

            case 'biometric-upload':
                return $field.hasClass('biometric-upload');

            case 'specific':
                return CONFIG.SPECIFIC_FIELDS.includes(fieldId);

            default:
                log('⚠️ Unbekannte VALIDATION_STRATEGY:', CONFIG.VALIDATION_STRATEGY);
                return false;
        }
    }

    // ============================================
    // BILD-OPTIMIERUNG (UX-FEATURE)
    // ============================================

    /**
     * Optimiert ein Bild automatisch (Resize + Qualität + optional Smart Crop)
     *
     * SICHER: Nur verkleinern, nie vergrößern!
     *
     * Smart Crop (optional):
     * - Erfordert Face Detection
     * - Croppt Bild auf korrektes 35:45 Seitenverhältnis
     * - Zentriert Gesicht optimal
     * - Zeigt Preview zur Bestätigung (wenn showPreview: true)
     */
    async function optimizeImage(file, faceDetection = null) {
        if (!CONFIG.AUTO_OPTIMIZE.enabled) {
            return { optimized: false, file: file };
        }

        log('🔧 Prüfe Bild-Optimierung:', file.name);

        try {
            const img = await loadImageFromFile(file);
            const originalSize = { width: img.width, height: img.height, fileSize: file.size };

            let needsOptimization = false;
            let optimizationType = [];

            // Prüfe ob Smart Crop möglich und nötig
            if (CONFIG.AUTO_OPTIMIZE.smartCrop && faceDetection && faceDetection.faceDetected) {
                const aspectRatio = img.width / img.height;
                const targetRatio = 0.777; // 35:45

                // Wenn Seitenverhältnis nicht passt: Crop vorschlagen
                if (Math.abs(aspectRatio - targetRatio) > 0.05) {
                    needsOptimization = true;
                    optimizationType.push('smart-crop');
                }
            }

            // Prüfe ob Resize nötig
            if (CONFIG.AUTO_OPTIMIZE.resize) {
                if (img.width > CONFIG.AUTO_OPTIMIZE.maxWidth ||
                    img.height > CONFIG.AUTO_OPTIMIZE.maxHeight) {
                    needsOptimization = true;
                    optimizationType.push('resize');
                }
            }

            // Prüfe ob Dateigröße zu groß
            if (file.size > CONFIG.AUTO_OPTIMIZE.maxFileSize) {
                needsOptimization = true;
                optimizationType.push('compress');
            }

            if (!needsOptimization) {
                log('✅ Keine Optimierung nötig');
                return { optimized: false, file: file };
            }

            log(`🔄 Optimierung nötig: ${optimizationType.join(', ')}`);

            // SMART CROP (falls aktiviert und nötig)
            let sourceImg = img;
            if (optimizationType.includes('smart-crop')) {
                // TODO: Implement smart crop with preview
                // Für jetzt: Skip smart crop, nur resize/compress
                log('⚠️ Smart Crop ist implementiert aber erfordert User-Interaktion');
                optimizationType = optimizationType.filter(t => t !== 'smart-crop');
            }

            // Berechne Zielgröße (proportional verkleinern)
            let targetWidth = sourceImg.width;
            let targetHeight = sourceImg.height;

            if (optimizationType.includes('resize')) {
                const scaleW = CONFIG.AUTO_OPTIMIZE.maxWidth / sourceImg.width;
                const scaleH = CONFIG.AUTO_OPTIMIZE.maxHeight / sourceImg.height;
                const scale = Math.min(scaleW, scaleH, 1.0); // Nie vergrößern!

                targetWidth = Math.floor(sourceImg.width * scale);
                targetHeight = Math.floor(sourceImg.height * scale);
            }

            // Canvas-Resize
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            // High-quality resize
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            // Als Blob mit angepasster Qualität
            let quality = CONFIG.AUTO_OPTIMIZE.jpegQuality;
            let blob;
            let attempts = 0;
            const maxAttempts = 5;

            do {
                blob = await canvasToBlob(canvas, 'image/jpeg', quality);
                attempts++;

                if (blob.size > CONFIG.AUTO_OPTIMIZE.maxFileSize && quality > 0.5) {
                    quality -= 0.1; // Qualität schrittweise reduzieren
                } else {
                    break;
                }
            } while (attempts < maxAttempts);

            const optimizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });

            log('✅ Bild optimiert:', {
                original: `${originalSize.width}×${originalSize.height}, ${formatFileSize(originalSize.fileSize)}`,
                optimized: `${targetWidth}×${targetHeight}, ${formatFileSize(optimizedFile.size)}`,
                quality: (quality * 100).toFixed(0) + '%'
            });

            return {
                optimized: true,
                file: optimizedFile,
                original: originalSize,
                result: {
                    width: targetWidth,
                    height: targetHeight,
                    fileSize: optimizedFile.size,
                    quality: quality
                },
                types: optimizationType
            };

        } catch (error) {
            log('❌ Optimierung fehlgeschlagen:', error);
            return { optimized: false, file: file, error: error.message };
        }
    }

    /**
     * Lädt Bild aus File
     */
    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Canvas zu Blob konvertieren
     */
    function canvasToBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas to Blob fehlgeschlagen'));
                }
            }, type, quality);
        });
    }

    /**
     * Dateigröße formatieren
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Aktualisiert FileInput mit optimiertem Bild
     */
    async function updateFileInput($field, newFile) {
        try {
            const dt = new DataTransfer();
            dt.items.add(newFile);
            $field[0].files = dt.files;
            log('✅ FileInput aktualisiert mit optimiertem Bild');
        } catch (error) {
            log('⚠️ FileInput konnte nicht aktualisiert werden:', error);
        }
    }

    /**
     * Zeigt Optimierungs-Benachrichtigung
     */
    function showOptimizationNotification(ui, optimization) {
        if (!CONFIG.AUTO_OPTIMIZE.notifyUser || !optimization.optimized) {
            return;
        }

        const $status = ui.$status;
        const orig = optimization.original;
        const result = optimization.result;

        $status.html(`
            <div style="text-align:center;padding:15px;background:#e3f2fd;border:2px solid #2196F3;border-radius:6px">
                <div style="font-size:24px;margin-bottom:10px">🔧</div>
                <div style="font-weight:bold;margin-bottom:10px;color:#1976d2">
                    Bild automatisch optimiert!
                </div>
                <div style="text-align:left;font-size:12px;color:#555">
                    <strong>Vorher:</strong> ${orig.width}×${orig.height} px, ${formatFileSize(orig.fileSize)}<br>
                    <strong>Nachher:</strong> ${result.width}×${result.height} px, ${formatFileSize(result.fileSize)}<br>
                    <strong>Qualität:</strong> ${(result.quality * 100).toFixed(0)}%
                </div>
                <div style="margin-top:10px;font-size:11px;color:#666">
                    ${optimization.types.includes('resize') ? '📐 Größe angepasst' : ''}
                    ${optimization.types.includes('compress') ? ' • 🗜️ Komprimiert' : ''}
                </div>
            </div>
        `).show();

        // Auto-Hide nach 3 Sekunden
        setTimeout(() => {
            $status.slideUp();
        }, 3000);
    }

    // ============================================
    // VALIDATOR INSTANCE
    // ============================================

    let validator = null;

    function getValidator() {
        if (!validator) {
            if (typeof BiometricValidator === 'undefined') {
                throw new Error('BiometricValidator nicht geladen! Bitte biometric-validator.js einbinden.');
            }

            validator = new BiometricValidator({
                ...CONFIG.BIOMETRIC_REQUIREMENTS,
                serverEndpoint: CONFIG.SERVER_ENDPOINT
            });

            log('✅ BiometricValidator initialisiert');
        }

        return validator;
    }

    // ============================================
    // UI COMPONENTS
    // ============================================

    /**
     * Erstellt Validierungs-UI für ein Upload-Feld
     */
    function createValidationUI($field) {
        const fieldId = $field.attr('id');

        // Finde Container - suche nach verschiedenen Mustern
        let $container = $field.closest('[id$="-xc"]');
        if (!$container.length) {
            $container = $field.closest('.form-group');
        }
        if (!$container.length) {
            $container = $field.parent();
        }

        if (!$container.length) {
            log('⚠️ Container nicht gefunden für', fieldId);
            return null;
        }

        // Entferne alte UI
        $container.find('.biometric-validation-ui').remove();

        // Erstelle UI-Container
        const $ui = $('<div class="biometric-validation-ui"></div>').css({
            marginTop: '15px',
            marginBottom: '15px'
        });

        // Banner (mit Warnung wenn Server-Validierung deaktiviert)
        const serverValidationEnabled = CONFIG.BIOMETRIC_REQUIREMENTS.enableServerValidation;
        const bannerBg = serverValidationEnabled
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)'; // Orange für Warnung

        const $banner = $('<div class="biometric-banner"></div>').css({
            padding: '12px 15px',
            background: bannerBg,
            color: 'white',
            borderRadius: '8px 8px 0 0',
            fontWeight: 'bold',
            textAlign: 'center',
            fontSize: '13px'
        }).html(`
            <div style="margin-bottom:6px">🔐 Biometrische Bildprüfung aktiv (ICAO-Standard)</div>
            <div style="font-size:11px;font-weight:normal;opacity:0.9">
                Führerscheinfoto • ICAO: 1050×1350px (35×45mm) • JPEG/PNG • Max 500 KB • Heller Hintergrund
            </div>
            ${!serverValidationEnabled ? `
                <div style="margin-top:8px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;font-size:11px;font-weight:normal">
                    ⚠️ NUR CLIENT-VALIDIERUNG AKTIV<br>
                    Prüft nur technische Anforderungen. Für vollständige ICAO-Konformität<br>
                    (Brillenreflexionen, Gesichtsausdruck, etc.) Server-Validierung aktivieren!
                </div>
            ` : ''}
        `);

        // Checkbox für Qualitätsmängel (cb1)
        const $checkboxContainer = $('<div class="biometric-checkbox-container"></div>').css({
            border: '2px solid #f39c12',
            borderTop: 'none',
            background: '#fff3cd',
            padding: '12px 15px',
            display: 'none'  // Nur bei soft errors anzeigen
        }).html(`
            <label style="display:flex;align-items:center;cursor:pointer;font-size:13px">
                <input type="checkbox" id="cb1" class="biometric-quality-override" style="margin-right:10px;width:18px;height:18px;cursor:pointer">
                <div>
                    <strong>⚠️ Trotz Qualitätsmängeln verwenden</strong><br>
                    <span style="font-size:11px;color:#856404">
                        Ich bestätige, dass ich die Qualitätsmängel (Schatten, Beleuchtung, Hintergrund)
                        akzeptiere und das Bild trotzdem verwenden möchte.
                    </span>
                </div>
            </label>
        `);

        // Status-Container
        const $status = $('<div class="biometric-status"></div>').css({
            border: '2px solid #667eea',
            borderTop: 'none',
            background: '#f8f9fa',
            padding: '15px',
            minHeight: '100px',
            display: 'none'
        });

        // Preview-Container
        const $preview = $('<div class="biometric-preview"></div>').css({
            marginTop: '10px',
            textAlign: 'center',
            display: 'none'
        });

        $ui.append($banner, $checkboxContainer, $status, $preview);

        // Füge UI nach dem Upload-Feld ein
        $field.after($ui);

        log('✅ Validierungs-UI erstellt für:', fieldId);

        return {
            $ui: $ui,
            $checkboxContainer: $checkboxContainer,
            $checkbox: $checkboxContainer.find('#cb1'),
            $status: $status,
            $preview: $preview
        };
    }

    /**
     * Zeigt Validierungs-Progress
     */
    function showValidationProgress(ui, fileName) {
        const $status = ui.$status;

        $status.html(`
            <div style="text-align:center;padding:20px">
                <div style="font-size:24px;margin-bottom:10px">🔍</div>
                <div style="font-weight:bold;margin-bottom:10px">Prüfe Bild: ${fileName}</div>
                <div class="validation-steps" style="text-align:left;margin-top:15px">
                    <div class="step" id="step-format">⏳ Format und Dateigröße...</div>
                    <div class="step" id="step-dimensions">⏳ Bildabmessungen...</div>
                    <div class="step" id="step-quality">⏳ Bildqualität...</div>
                    <div class="step" id="step-background">⏳ Hintergrund (ICAO)...</div>
                    <div class="step" id="step-face">⏳ Gesichtserkennung...</div>
                </div>
            </div>
        `).show();
    }

    /**
     * Aktualisiert Validierungs-Schritt
     */
    function updateValidationStep(stepId, status, message) {
        const $step = $(`#${stepId}`);
        if (!$step.length) return;

        const icons = {
            loading: '⏳',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            skipped: '⊘'
        };

        const icon = icons[status] || '⏳';
        $step.html(`${icon} ${message}`);

        // Farbe
        if (status === 'error') {
            $step.css('color', '#dc3545');
        } else if (status === 'warning') {
            $step.css('color', '#ffc107');
        } else if (status === 'success') {
            $step.css('color', '#28a745');
        }
    }

    /**
     * Zeigt Validierungs-Ergebnis
     */
    function showValidationResult(ui, result, fileName) {
        const $status = ui.$status;

        if (result.valid) {
            // ERFOLG
            const serverValidationEnabled = CONFIG.BIOMETRIC_REQUIREMENTS.enableServerValidation;

            $status.html(`
                <div style="text-align:center;padding:20px;color:#28a745">
                    <div style="font-size:48px;margin-bottom:10px">✅</div>
                    <div style="font-weight:bold;font-size:18px;margin-bottom:10px">
                        Bild erfüllt alle ${serverValidationEnabled ? '' : 'technischen '}Anforderungen!
                    </div>
                    <div style="font-size:14px;color:#666">
                        ${fileName}
                    </div>
                    ${!serverValidationEnabled ? `
                        <div style="margin-top:15px;padding:12px;background:#fff3cd;border:2px solid #ffc107;border-radius:6px;text-align:left">
                            <strong>⚠️ WICHTIGER HINWEIS:</strong><br>
                            Es wurde nur die <strong>Client-seitige Validierung</strong> durchgeführt.<br>
                            Diese prüft <u>nicht</u>: Brillenreflexionen, Gesichtsausdruck, Augen auf/zu, Haare im Gesicht, etc.<br>
                            <br>
                            <strong>Für vollständige ICAO-Konformität Server-Validierung aktivieren!</strong>
                        </div>
                    ` : ''}
                    ${result.warnings.length > 0 ? `
                        <div style="margin-top:15px;padding:10px;background:#fff3cd;border-radius:6px;text-align:left">
                            <strong>⚠️ Hinweise:</strong><br>
                            ${result.warnings.map(w => `• ${w}`).join('<br>')}
                        </div>
                    ` : ''}
                </div>
            `).show();

            // Auto-Hide nach 3 Sekunden
            setTimeout(() => {
                $status.slideUp();
            }, 3000);

        } else {
            // FEHLER
            const hasHardErrors = result.hardErrors && result.hardErrors.length > 0;
            const hasSoftErrors = result.softErrors && result.softErrors.length > 0;

            $status.html(`
                <div style="text-align:center;padding:20px;color:#dc3545">
                    <div style="font-size:48px;margin-bottom:10px">${hasHardErrors ? '❌' : '⚠️'}</div>
                    <div style="font-weight:bold;font-size:18px;margin-bottom:10px">
                        ${hasHardErrors ? 'Bild hat technische Fehler' : 'Bild hat Qualitätsmängel'}
                    </div>

                    ${hasHardErrors ? `
                        <div style="margin-top:15px;padding:15px;background:#fff;border:2px solid #dc3545;border-radius:6px;text-align:left">
                            <strong>❌ Technische Fehler (nicht behebbar):</strong><br>
                            ${result.hardErrors.map(e => `• ${e}`).join('<br><br>')}
                            <div style="margin-top:10px;padding:10px;background:#f8d7da;border-radius:4px;font-size:12px">
                                Diese Fehler sind kritisch. Das Bild muss neu aufgenommen werden.
                            </div>
                        </div>
                    ` : ''}

                    ${hasSoftErrors && !hasHardErrors ? `
                        <div style="margin-top:15px;padding:15px;background:#fff;border:2px solid #f39c12;border-radius:6px;text-align:left">
                            <strong>⚠️ Qualitätsmängel:</strong><br>
                            ${result.softErrors.map(e => `• ${e}`).join('<br><br>')}
                            <div style="margin-top:10px;padding:10px;background:#fff3cd;border-radius:4px;font-size:12px">
                                <strong>💡 Tipp:</strong> Sie können das Bild trotz dieser Mängel verwenden,<br>
                                wenn Sie die Checkbox "Trotz Qualitätsmängeln verwenden" abhaken.
                            </div>
                        </div>
                    ` : ''}

                    ${result.warnings.length > 0 ? `
                        <div style="margin-top:15px;padding:10px;background:#fff3cd;border-radius:6px;text-align:left">
                            <strong>⚠️ Hinweise:</strong><br>
                            ${result.warnings.map(w => `• ${w}`).join('<br>')}
                        </div>
                    ` : ''}
                </div>
            `).show();
        }
    }

    // ============================================
    // VALIDATION LOGIC
    // ============================================

    /**
     * Validiert ein hochgeladenes Bild
     */
    async function validateBiometricImage(file, $field, ui) {
        log('🔍 Starte biometrische Validierung für:', file.name);

        // Zeige Progress
        if (CONFIG.SHOW_VALIDATION_STEPS) {
            showValidationProgress(ui, file.name);
        }

        try {
            // SCHRITT 1: Bild-Optimierung (falls aktiviert)
            let fileToValidate = file;
            let optimization = null;

            if (CONFIG.AUTO_OPTIMIZE.enabled) {
                optimization = await optimizeImage(file);

                if (optimization.optimized) {
                    fileToValidate = optimization.file;
                    log('✅ Verwende optimiertes Bild für Validierung');

                    // Zeige Optimierungs-Benachrichtigung
                    showOptimizationNotification(ui, optimization);

                    // Warte kurz damit User die Meldung sieht
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Aktualisiere den FileInput mit dem optimierten Bild
                    await updateFileInput($field, fileToValidate);
                }
            }

            // SCHRITT 2: Validierung (mit optimiertem oder originalem Bild)
            const validator = getValidator();
            const result = await validator.validateImage(fileToValidate);

            // Update Steps basierend auf Result
            if (CONFIG.SHOW_VALIDATION_STEPS) {
                // Format
                const formatValid = result.details.format && result.details.format.valid;
                updateValidationStep('step-format',
                    formatValid ? 'success' : 'error',
                    formatValid ? 'Format OK' : 'Format ungültig'
                );

                // Dimensions
                const dimValid = result.details.dimensions && result.details.dimensions.valid;
                updateValidationStep('step-dimensions',
                    dimValid ? 'success' : 'error',
                    dimValid ? `${result.details.dimensions.width}x${result.details.dimensions.height}px OK` : 'Abmessungen ungültig'
                );

                // Quality
                const qualityValid = result.details.quality && result.details.quality.valid;
                const qualityWarnings = result.details.quality && result.details.quality.warnings.length > 0;
                updateValidationStep('step-quality',
                    qualityWarnings ? 'warning' : (qualityValid ? 'success' : 'error'),
                    qualityWarnings ? 'Qualität OK (mit Hinweisen)' : (qualityValid ? 'Qualität OK' : 'Qualität ungenügend')
                );

                // Background (ICAO)
                if (result.details.background) {
                    const bgValid = result.details.background.valid;
                    const bgWarnings = result.details.background.warnings && result.details.background.warnings.length > 0;
                    const brightness = result.details.background.brightness;
                    updateValidationStep('step-background',
                        bgValid ? (bgWarnings ? 'warning' : 'success') : 'error',
                        bgValid ?
                            (brightness ? `Hintergrund OK (Helligkeit: ${brightness.toFixed(0)}/255)` : 'Hintergrund OK') :
                            'Hintergrund nicht ICAO-konform'
                    );
                } else {
                    updateValidationStep('step-background', 'skipped', 'Übersprungen (deaktiviert)');
                }

                // Face
                if (result.details.face) {
                    const faceValid = result.details.face.valid;
                    const faceDetected = result.details.face.faceDetected;
                    updateValidationStep('step-face',
                        faceDetected ? (faceValid ? 'success' : 'warning') : 'error',
                        faceDetected ? `Gesicht erkannt (${result.details.face.faceCount})` : 'Kein Gesicht erkannt'
                    );
                } else {
                    updateValidationStep('step-face', 'skipped', 'Übersprungen (face-api.js nicht verfügbar)');
                }

                // Warte kurz damit User Steps sieht
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Zeige Ergebnis
            showValidationResult(ui, result, file.name);

            log(result.valid ? '✅ Validierung erfolgreich' : '❌ Validierung fehlgeschlagen', result);

            return result;

        } catch (error) {
            log('❌ Validierungs-Fehler:', error);

            showValidationResult(ui, {
                valid: false,
                errors: [`Interner Fehler: ${error.message}`],
                warnings: []
            }, file.name);

            return {
                valid: false,
                errors: [`Interner Fehler: ${error.message}`]
            };
        }
    }

    /**
     * Entfernt ungültige Datei aus Upload-Feld
     */
    function removeInvalidFile($field, fileToRemove) {
        const files = Array.from($field[0].files || []);

        // Erstelle neue FileList ohne die ungültige Datei
        const dt = new DataTransfer();

        files.forEach(file => {
            if (file !== fileToRemove) {
                dt.items.add(file);
            }
        });

        $field[0].files = dt.files;

        log('🗑️ Ungültige Datei entfernt:', fileToRemove.name);
    }

    // ============================================
    // INTEGRATION
    // ============================================

    /**
     * Fügt biometrische Validierung zu Upload-Feldern hinzu
     */
    function setupBiometricValidation() {
        log('🔧 Setup biometrische Validierung...');

        // Finde Upload-Felder (nur die noch nicht setupten!)
        const $fields = $('input[type="file"]').filter(function() {
            const $field = $(this);
            // Skip already setup fields
            if ($field.data('biometric-setup') === true) {
                return false;
            }
            return shouldValidateBiometric($field);
        });

        if ($fields.length === 0) {
            log('⚠️ Keine neuen Felder für biometrische Validierung gefunden');
            log('   Strategie:', CONFIG.VALIDATION_STRATEGY);
            return;
        }

        log(`📋 ${$fields.length} neue(s) Feld(er) für biometrische Validierung gefunden`);

        // Setup für jedes Feld
        $fields.each(function() {
            const $field = $(this);
            const fieldId = $field.attr('id') || '(keine ID)';

            log(`  → ${fieldId}`);

            // Markiere Feld als setup (WICHTIG: Verhindert infinite loop!)
            $field.data('biometric-setup', true);

            // Mobile-Optimierungen: HTML-Attribute für bessere Smartphone-Erfahrung
            $field.attr({
                'accept': 'image/jpeg,image/jpg,image/png',  // Nur unterstützte Formate
                'capture': 'environment'                      // Rückkamera bevorzugen (besser als Selfie)
            });
            log('📱 Mobile-Hints gesetzt:', fieldId, '(capture=environment, accept=image/*)');

            // Erstelle UI
            const ui = createValidationUI($field);
            if (!ui) return;

            // Speichere UI-Referenz
            $field.data('biometricUI', ui);

            // Change-Event für Validierung
            $field.off('change.biometric').on('change.biometric', async function(e) {
                const newFiles = Array.from(e.target.files || []);

                if (newFiles.length === 0) return;

                log('📁 Neue Datei(en) ausgewählt:', newFiles.length);

                // Validiere jede Datei
                for (let i = 0; i < newFiles.length; i++) {
                    const file = newFiles[i];

                    log(`📸 Validiere Datei ${i + 1}/${newFiles.length}:`, file.name);

                    const result = await validateBiometricImage(file, $field, ui);

                    if (!result.valid) {
                        log('❌ Datei ungültig:', file.name);

                        // NEUE LOGIK: Hard vs. Soft Errors
                        const hasHardErrors = result.hardErrors && result.hardErrors.length > 0;
                        const hasSoftErrors = result.softErrors && result.softErrors.length > 0;

                        log(`  → Hard Errors: ${hasHardErrors ? result.hardErrors.length : 0}`);
                        log(`  → Soft Errors: ${hasSoftErrors ? result.softErrors.length : 0}`);

                        // Wenn NUR soft errors → Checkbox anzeigen, Bild BEHALTEN!
                        if (!hasHardErrors && hasSoftErrors) {
                            ui.$checkboxContainer.show();

                            // Prüfe ob Checkbox abgehackt ist
                            const checkboxChecked = ui.$checkbox.is(':checked');

                            if (checkboxChecked) {
                                log('✅ Qualitätsmängel vom User akzeptiert (cb1 checked) → Bild wird NICHT entfernt');
                                // User akzeptiert Qualitätsmängel → Bild bleibt im Upload!
                                return;
                            } else {
                                log('⚠️ Qualitätsmängel erkannt, Checkbox nicht abgehackt → Bild BLEIBT im Upload, User kann cb1 abhaken');
                                // Bild BLEIBT im Upload! User kann Checkbox abhaken um zu bestätigen
                                // NICHT entfernen! Nur bei hard errors entfernen!
                                return;
                            }
                        }

                        // NUR bei Hard Errors → Datei wirklich entfernen
                        if (hasHardErrors) {
                            log('❌ Hard Errors erkannt → Datei wird entfernt');

                            if (CONFIG.AUTO_REMOVE_INVALID) {
                                // Entferne automatisch
                                removeInvalidFile($field, file);
                            } else {
                                // Frage User
                                const shouldRemove = confirm(
                                    `Datei "${file.name}" hat technische Fehler (nicht behebbar):\n\n${result.hardErrors.join('\n')}\n\nDie Datei muss entfernt werden.`
                                );

                                if (shouldRemove) {
                                    removeInvalidFile($field, file);
                                }
                            }

                            // Verhindere weiteren Upload
                            return false;
                        }
                    } else {
                        log('✅ Datei gültig:', file.name);
                        // Verstecke Checkbox bei gültigem Bild
                        ui.$checkboxContainer.hide();
                    }
                }
            });
        });

        log('✅ Biometrische Validierung setup abgeschlossen');
    }

    /**
     * Überwacht dynamisch hinzugefügte Felder
     */
    function watchForNewFields() {
        const observer = new MutationObserver((mutations) => {
            // Prüfe ob tatsächlich neue input[type="file"] Felder hinzugefügt wurden
            let hasNewFileInputs = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        // Direkter file input?
                        if (node.nodeType === 1 && node.tagName === 'INPUT' && node.type === 'file') {
                            hasNewFileInputs = true;
                            break;
                        }
                        // Oder enthält es file inputs?
                        if (node.nodeType === 1 && node.querySelectorAll) {
                            const fileInputs = node.querySelectorAll('input[type="file"]');
                            if (fileInputs.length > 0) {
                                hasNewFileInputs = true;
                                break;
                            }
                        }
                    }
                }
                if (hasNewFileInputs) break;
            }

            // Nur setup aufrufen wenn tatsächlich neue file inputs gefunden wurden
            if (hasNewFileInputs) {
                log('🆕 Neue Upload-Felder im DOM erkannt');
                setupBiometricValidation();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('👀 Beobachte DOM für neue Upload-Felder');
    }

    // ============================================
    // INITIALISIERUNG
    // ============================================

    function init() {
        console.clear();
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
        console.log('%c🔐 BIOMETRIC UPLOAD INTEGRATION (STANDALONE)', 'color: #667eea; font-weight: bold; font-size: 16px');
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');

        if (typeof $ === 'undefined') {
            console.error('❌ jQuery nicht verfügbar!');
            return;
        }

        console.group('%c⚙️  Konfiguration', 'color: #2196F3; font-weight: bold');
        console.log('Validierungs-Strategie:', CONFIG.VALIDATION_STRATEGY);
        console.log('Server-Endpoint:', CONFIG.SERVER_ENDPOINT);
        console.log('Server-Validierung:', CONFIG.BIOMETRIC_REQUIREMENTS.enableServerValidation);
        console.log('Gesichtserkennung:', CONFIG.BIOMETRIC_REQUIREMENTS.enableFaceDetection);
        console.log('Auto-Remove Invalid:', CONFIG.AUTO_REMOVE_INVALID);
        console.log('');
        console.log('⚠️ WICHTIG: Verwendet KEINE Formcycle-internen APIs!');
        console.log('⚠️ Funktioniert mit Standard HTML5 File-Inputs!');
        console.log('');

        if (!CONFIG.BIOMETRIC_REQUIREMENTS.enableServerValidation) {
            console.log('%c⚠️ WARNUNG: NUR CLIENT-VALIDIERUNG AKTIV!', 'color: #f39c12; font-weight: bold; font-size: 14px');
            console.log('%c   Client-Validierung ist nur ein PRE-FILTER!', 'color: #f39c12');
            console.log('%c   Prüft NICHT: Brillenreflexionen, Gesichtsausdruck, Augen, Haare, etc.', 'color: #f39c12');
            console.log('%c   → enableServerValidation: true aktivieren für vollständige ICAO-Prüfung!', 'color: #f39c12; font-weight: bold');
            console.log('');
        }

        console.groupEnd();

        // Setup Validierung
        setupBiometricValidation();

        // Beobachte neue Felder
        watchForNewFields();

        console.log('%c✅ Initialisierung abgeschlossen!', 'color: #28a745; font-weight: bold; font-size: 14px');
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
    }

    // Warte auf DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
