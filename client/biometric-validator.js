/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * BIOMETRIC IMAGE VALIDATOR - CLIENT-SIDE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Validiert Bilder nach biometrischen Anforderungen für Führerscheinfotos
 * gemäß ICAO/ISO 19794-5 Standard
 *
 * Features:
 * - ✅ Technische Validierung (Größe, Format, Auflösung)
 * - ✅ Seitenverhältnis-Prüfung (3:4 Portrait)
 * - ✅ Bildqualität (Schärfe, Kontrast)
 * - ✅ Einfache Gesichtserkennung (via face-api.js)
 * - ✅ Server-Validierung (detaillierte Biometrie)
 * - ✅ Visuelles Feedback mit Overlay
 *
 * Version: 1.0.0
 * Datum: 2025-01-13
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

(function(window) {
    'use strict';

    /**
     * Biometrische Anforderungen nach ICAO Doc 9303
     */
    const BIOMETRIC_REQUIREMENTS = {
        // Technische Anforderungen
        minWidth: 600,              // Mindestbreite in Pixel
        minHeight: 450,             // Mindesthöhe in Pixel
        recommendedWidth: 1200,     // Empfohlene Breite
        recommendedHeight: 900,     // Empfohlene Höhe

        // Seitenverhältnis (3:4 Portrait)
        aspectRatioMin: 0.70,       // 3:4 = 0.75, mit Toleranz
        aspectRatioMax: 0.80,

        // Dateigröße
        minFileSize: 50 * 1024,     // 50 KB
        maxFileSize: 500 * 1024,    // 500 KB

        // Erlaubte Formate
        allowedFormats: ['image/jpeg', 'image/jpg', 'image/png'],

        // Gesichtserkennung
        faceDetection: {
            minFaceSize: 0.60,      // Gesicht muss mind. 60% der Bildhöhe sein
            maxFaceSize: 0.85,      // Gesicht darf max. 85% der Bildhöhe sein
            centerTolerance: 0.15   // Toleranz für Zentrierung (15%)
        },

        // Qualität
        minSharpness: 100,          // Laplace-Varianz für Schärfe
        minContrast: 40             // Mindestkontrast
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

                // Wenn bisher Fehler, breche ab (keine teure Face-Detection)
                if (result.errors.length > 0) {
                    result.valid = false;
                    this.log('Basis-Validierung fehlgeschlagen:', result.errors);
                    return result;
                }

                // 6. Gesichtserkennung (optional, clientseitig)
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

                // 7. Server-Validierung (detaillierte Biometrie)
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
                mimeType: file.type,
                extension: file.name.split('.').pop().toLowerCase()
            };

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
         * 3. Bild laden
         */
        loadImage(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    resolve({
                        img: img,
                        canvas: canvas,
                        ctx: ctx,
                        width: img.width,
                        height: img.height
                    });
                };

                img.onerror = () => {
                    reject(new Error('Bild konnte nicht geladen werden'));
                };

                img.src = URL.createObjectURL(file);
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
