/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * BIOMETRIC VALIDATOR - SERVER-SIDE (Node.js)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Detaillierte biometrische Validierung für Führerscheinfotos
 * nach ICAO Doc 9303 und ISO/IEC 19794-5
 *
 * Version: 1.0.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const sharp = require('sharp');
const exifParser = require('exif-parser');
const fs = require('fs').promises;
const path = require('path');

// Polyfill für face-api (Canvas)
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

/**
 * Biometrische Anforderungen (ICAO/ISO)
 */
const REQUIREMENTS = {
    // Dimensionen
    minWidth: 600,
    minHeight: 450,
    recommendedWidth: 1200,
    recommendedHeight: 1600,

    // Seitenverhältnis (Portrait)
    aspectRatioMin: 0.70,
    aspectRatioMax: 0.80,

    // Gesicht
    face: {
        minSizeRatio: 0.60,        // Mind. 60% der Bildhöhe
        maxSizeRatio: 0.85,        // Max. 85% der Bildhöhe
        centerToleranceX: 0.15,    // Horizontale Zentrierung ±15%
        centerToleranceY: 0.10,    // Vertikale Position ±10%
        minConfidence: 0.8         // Mind. 80% Sicherheit
    },

    // Augen
    eyes: {
        minDistance: 90,           // Mind. 90 Pixel Augenabstand
        horizontalTolerance: 5,    // Max. 5° Neigung
        bothVisible: true          // Beide Augen müssen sichtbar sein
    },

    // Hintergrund
    background: {
        minBrightness: 200,        // Helligkeit (0-255)
        maxVariance: 800,          // Einheitlichkeit
        minCoverage: 0.7           // Mind. 70% des Hintergrunds
    },

    // Qualität
    quality: {
        minSharpness: 100,
        minContrast: 40,
        minBrightness: 50,
        maxBrightness: 200
    }
};

/**
 * BiometricValidator Klasse
 */
class BiometricValidator {
    constructor(options = {}) {
        this.options = {
            debug: options.debug || false,
            logger: options.logger || console,
            modelPath: options.modelPath || path.join(__dirname, 'models')
        };

        this.modelsLoaded = false;
    }

    log(level, message, meta = {}) {
        if (this.options.logger && typeof this.options.logger[level] === 'function') {
            this.options.logger[level](message, meta);
        }
    }

    /**
     * Lade face-api Modelle
     */
    async loadModels() {
        if (this.modelsLoaded) return;

        this.log('info', '📦 Lade face-api Modelle...');

        try {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromDisk(this.options.modelPath),
                faceapi.nets.faceLandmark68Net.loadFromDisk(this.options.modelPath),
                faceapi.nets.faceRecognitionNet.loadFromDisk(this.options.modelPath),
                faceapi.nets.faceExpressionNet.loadFromDisk(this.options.modelPath)
            ]);

            this.modelsLoaded = true;
            this.log('info', '✅ face-api Modelle geladen');

        } catch (error) {
            this.log('error', '❌ Fehler beim Laden der Modelle', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Hauptvalidierung
     */
    async validate(imagePath) {
        this.log('info', '🔍 Starte biometrische Validierung', { imagePath });

        const result = {
            valid: false,
            errors: [],
            warnings: [],
            details: {},
            timestamp: new Date().toISOString()
        };

        try {
            // 1. Bild laden und Metadaten extrahieren
            const imageData = await this.loadImage(imagePath);
            result.details.image = imageData.metadata;

            // 2. Dimensionen prüfen
            const dimCheck = this.validateDimensions(imageData.metadata);
            result.details.dimensions = dimCheck;
            if (!dimCheck.valid) {
                result.errors.push(...dimCheck.errors);
            }
            if (dimCheck.warnings) {
                result.warnings.push(...dimCheck.warnings);
            }

            // 3. EXIF-Daten analysieren
            const exifCheck = await this.analyzeExif(imagePath);
            result.details.exif = exifCheck;
            if (exifCheck.warnings) {
                result.warnings.push(...exifCheck.warnings);
            }

            // 4. Bildqualität prüfen
            const qualityCheck = await this.analyzeQuality(imageData.buffer, imageData.metadata);
            result.details.quality = qualityCheck;
            if (!qualityCheck.valid) {
                result.errors.push(...qualityCheck.errors);
            }
            if (qualityCheck.warnings) {
                result.warnings.push(...qualityCheck.warnings);
            }

            // 5. Gesichtserkennung
            const faceCheck = await this.detectAndValidateFace(imageData.buffer);
            result.details.face = faceCheck;
            if (!faceCheck.valid) {
                result.errors.push(...faceCheck.errors);
            }
            if (faceCheck.warnings) {
                result.warnings.push(...faceCheck.warnings);
            }

            // 6. Hintergrund analysieren
            if (faceCheck.valid && faceCheck.detection) {
                const bgCheck = await this.analyzeBackground(imageData.buffer, faceCheck.detection);
                result.details.background = bgCheck;
                if (!bgCheck.valid) {
                    result.errors.push(...bgCheck.errors);
                }
                if (bgCheck.warnings) {
                    result.warnings.push(...bgCheck.warnings);
                }
            }

            // Finale Bewertung
            result.valid = result.errors.length === 0;

            this.log('info', result.valid ? '✅ Validierung erfolgreich' : '❌ Validierung fehlgeschlagen', {
                valid: result.valid,
                errors: result.errors.length,
                warnings: result.warnings.length
            });

            return result;

        } catch (error) {
            this.log('error', '❌ Validierungs-Fehler', {
                error: error.message,
                stack: error.stack
            });

            result.errors.push(`Interner Fehler: ${error.message}`);
            result.valid = false;
            return result;
        }
    }

    /**
     * Bild laden
     */
    async loadImage(imagePath) {
        const buffer = await fs.readFile(imagePath);

        const metadata = await sharp(buffer).metadata();

        return {
            buffer,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                space: metadata.space,
                channels: metadata.channels,
                depth: metadata.depth,
                density: metadata.density,
                hasAlpha: metadata.hasAlpha,
                size: buffer.length
            }
        };
    }

    /**
     * Dimensionen validieren
     */
    validateDimensions(metadata) {
        const result = {
            valid: false,
            errors: [],
            warnings: []
        };

        const { width, height } = metadata;

        // Mindestanforderungen
        if (width < REQUIREMENTS.minWidth) {
            result.errors.push(`Breite zu gering: ${width}px (min: ${REQUIREMENTS.minWidth}px)`);
        }

        if (height < REQUIREMENTS.minHeight) {
            result.errors.push(`Höhe zu gering: ${height}px (min: ${REQUIREMENTS.minHeight}px)`);
        }

        // Seitenverhältnis
        const aspectRatio = width / height;
        if (aspectRatio < REQUIREMENTS.aspectRatioMin || aspectRatio > REQUIREMENTS.aspectRatioMax) {
            result.errors.push(
                `Falsches Seitenverhältnis: ${aspectRatio.toFixed(2)} ` +
                `(erwartet: 0.75 ±0.05 für Portrait)`
            );
        }

        // Empfohlene Größe
        if (width < REQUIREMENTS.recommendedWidth || height < REQUIREMENTS.recommendedHeight) {
            result.warnings.push(
                `Empfohlene Größe nicht erreicht: ${width}x${height}px ` +
                `(empfohlen: ${REQUIREMENTS.recommendedWidth}x${REQUIREMENTS.recommendedHeight}px)`
            );
        }

        result.valid = result.errors.length === 0;
        return result;
    }

    /**
     * EXIF-Daten analysieren
     */
    async analyzeExif(imagePath) {
        const result = {
            data: null,
            warnings: []
        };

        try {
            const buffer = await fs.readFile(imagePath);
            const parser = exifParser.create(buffer);
            const exifData = parser.parse();

            result.data = {
                make: exifData.tags.Make,
                model: exifData.tags.Model,
                dateTime: exifData.tags.DateTime,
                orientation: exifData.tags.Orientation,
                flash: exifData.tags.Flash,
                software: exifData.tags.Software
            };

            // Warnungen basierend auf EXIF
            if (exifData.tags.Flash && exifData.tags.Flash !== 0) {
                result.warnings.push('Blitz wurde verwendet (kann Schatten verursachen)');
            }

            // Prüfe Datum (nicht älter als 6 Monate)
            if (exifData.tags.DateTime) {
                const photoDate = new Date(exifData.tags.DateTime * 1000);
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                if (photoDate < sixMonthsAgo) {
                    result.warnings.push('Foto möglicherweise zu alt (älter als 6 Monate)');
                }
            }

        } catch (error) {
            this.log('warn', 'Konnte EXIF-Daten nicht lesen', { error: error.message });
            // Nicht kritisch, kein Fehler
        }

        return result;
    }

    /**
     * Bildqualität analysieren
     */
    async analyzeQuality(buffer, metadata) {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
            metrics: {}
        };

        try {
            // Konvertiere zu Grayscale für Analyse
            const gray = await sharp(buffer)
                .greyscale()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const pixels = new Uint8Array(gray.data);
            const { width, height } = gray.info;

            // Schärfe (Laplace-Varianz)
            const sharpness = this.calculateSharpness(pixels, width, height);
            result.metrics.sharpness = sharpness;

            if (sharpness < REQUIREMENTS.quality.minSharpness) {
                result.warnings.push(`Bild möglicherweise unscharf (${sharpness.toFixed(0)})`);
            }

            // Kontrast (Standardabweichung)
            const contrast = this.calculateContrast(pixels);
            result.metrics.contrast = contrast;

            if (contrast < REQUIREMENTS.quality.minContrast) {
                result.warnings.push(`Geringer Kontrast (${contrast.toFixed(0)})`);
            }

            // Helligkeit (Durchschnitt)
            const brightness = this.calculateBrightness(pixels);
            result.metrics.brightness = brightness;

            if (brightness < REQUIREMENTS.quality.minBrightness) {
                result.errors.push('Bild zu dunkel');
            } else if (brightness > REQUIREMENTS.quality.maxBrightness) {
                result.errors.push('Bild überbelichtet');
            }

            result.valid = result.errors.length === 0;

        } catch (error) {
            this.log('error', 'Qualitätsanalyse fehlgeschlagen', { error: error.message });
            result.warnings.push('Qualitätsanalyse nicht möglich');
            result.valid = true; // Nicht blockieren
        }

        return result;
    }

    /**
     * Schärfe berechnen (Laplace-Varianz)
     */
    calculateSharpness(pixels, width, height) {
        let variance = 0;
        let count = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const center = pixels[idx];

                const neighbors = [
                    pixels[(y - 1) * width + x],     // oben
                    pixels[(y + 1) * width + x],     // unten
                    pixels[y * width + (x - 1)],     // links
                    pixels[y * width + (x + 1)]      // rechts
                ];

                const laplace = -4 * center + neighbors.reduce((sum, n) => sum + n, 0);
                variance += laplace * laplace;
                count++;
            }
        }

        return variance / count;
    }

    /**
     * Kontrast berechnen (Standardabweichung)
     */
    calculateContrast(pixels) {
        const sum = pixels.reduce((acc, val) => acc + val, 0);
        const mean = sum / pixels.length;

        const variance = pixels.reduce((acc, val) => acc + (val - mean) ** 2, 0) / pixels.length;

        return Math.sqrt(variance);
    }

    /**
     * Helligkeit berechnen (Durchschnitt)
     */
    calculateBrightness(pixels) {
        const sum = pixels.reduce((acc, val) => acc + val, 0);
        return sum / pixels.length;
    }

    /**
     * Gesichtserkennung und Validierung
     */
    async detectAndValidateFace(buffer) {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
            detection: null,
            faceCount: 0
        };

        try {
            // Bild in Canvas laden
            const img = await canvas.loadImage(buffer);
            const { width, height } = img;

            // Gesichter erkennen
            const detections = await faceapi
                .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: REQUIREMENTS.face.minConfidence }))
                .withFaceLandmarks()
                .withFaceExpressions();

            result.faceCount = detections.length;

            // Genau ein Gesicht erforderlich
            if (detections.length === 0) {
                result.errors.push('Kein Gesicht erkannt');
                return result;
            }

            if (detections.length > 1) {
                result.errors.push(`Mehrere Gesichter erkannt (${detections.length}). Nur eine Person erlaubt.`);
                return result;
            }

            const detection = detections[0];
            const box = detection.detection.box;

            result.detection = {
                box: {
                    x: Math.round(box.x),
                    y: Math.round(box.y),
                    width: Math.round(box.width),
                    height: Math.round(box.height)
                },
                confidence: detection.detection.score,
                landmarks: detection.landmarks,
                expressions: detection.expressions
            };

            // Gesichtsgröße prüfen
            const faceHeightRatio = box.height / height;
            result.detection.faceHeightRatio = faceHeightRatio;

            if (faceHeightRatio < REQUIREMENTS.face.minSizeRatio) {
                result.errors.push(
                    `Gesicht zu klein: ${(faceHeightRatio * 100).toFixed(0)}% ` +
                    `(min: ${(REQUIREMENTS.face.minSizeRatio * 100).toFixed(0)}%)`
                );
            } else if (faceHeightRatio > REQUIREMENTS.face.maxSizeRatio) {
                result.errors.push(
                    `Gesicht zu groß: ${(faceHeightRatio * 100).toFixed(0)}% ` +
                    `(max: ${(REQUIREMENTS.face.maxSizeRatio * 100).toFixed(0)}%)`
                );
            }

            // Zentrierung prüfen
            const faceCenterX = box.x + box.width / 2;
            const faceCenterY = box.y + box.height / 2;
            const imageCenterX = width / 2;
            const imageCenterY = height / 2;

            const offsetX = Math.abs(faceCenterX - imageCenterX) / width;
            const offsetY = Math.abs(faceCenterY - imageCenterY) / height;

            result.detection.centerOffset = { x: offsetX, y: offsetY };

            if (offsetX > REQUIREMENTS.face.centerToleranceX) {
                result.warnings.push(`Gesicht horizontal nicht zentriert (${(offsetX * 100).toFixed(0)}%)`);
            }

            if (offsetY > REQUIREMENTS.face.centerToleranceY) {
                result.warnings.push(`Gesicht vertikal nicht optimal positioniert (${(offsetY * 100).toFixed(0)}%)`);
            }

            // Augen prüfen
            const eyesCheck = this.validateEyes(detection.landmarks);
            if (!eyesCheck.valid) {
                result.errors.push(...eyesCheck.errors);
            }
            if (eyesCheck.warnings) {
                result.warnings.push(...eyesCheck.warnings);
            }
            result.detection.eyes = eyesCheck;

            // Gesichtsausdruck prüfen
            const expressionCheck = this.validateExpression(detection.expressions);
            if (expressionCheck.warnings) {
                result.warnings.push(...expressionCheck.warnings);
            }
            result.detection.expressions = expressionCheck;

            result.valid = result.errors.length === 0;

        } catch (error) {
            this.log('error', 'Gesichtserkennung fehlgeschlagen', { error: error.message });
            result.errors.push(`Gesichtserkennung fehlgeschlagen: ${error.message}`);
        }

        return result;
    }

    /**
     * Augen validieren
     */
    validateEyes(landmarks) {
        const result = {
            valid: false,
            errors: [],
            warnings: []
        };

        try {
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();

            // Augenabstand
            const leftCenter = this.getCenterPoint(leftEye);
            const rightCenter = this.getCenterPoint(rightEye);

            const eyeDistance = Math.sqrt(
                (rightCenter.x - leftCenter.x) ** 2 +
                (rightCenter.y - leftCenter.y) ** 2
            );

            result.eyeDistance = Math.round(eyeDistance);

            if (eyeDistance < REQUIREMENTS.eyes.minDistance) {
                result.errors.push(`Augenabstand zu gering: ${Math.round(eyeDistance)}px (min: ${REQUIREMENTS.eyes.minDistance}px)`);
            }

            // Horizontale Ausrichtung (Neigung)
            const angle = Math.atan2(
                rightCenter.y - leftCenter.y,
                rightCenter.x - leftCenter.x
            ) * (180 / Math.PI);

            result.eyeAngle = Math.round(angle);

            if (Math.abs(angle) > REQUIREMENTS.eyes.horizontalTolerance) {
                result.warnings.push(`Kopf leicht geneigt: ${Math.abs(angle).toFixed(1)}°`);
            }

            result.valid = result.errors.length === 0;

        } catch (error) {
            this.log('warn', 'Augen-Validierung fehlgeschlagen', { error: error.message });
            result.warnings.push('Augen-Validierung nicht möglich');
            result.valid = true; // Nicht blockieren
        }

        return result;
    }

    /**
     * Gesichtsausdruck validieren
     */
    validateExpression(expressions) {
        const result = {
            warnings: [],
            dominant: null
        };

        // Finde dominanten Ausdruck
        const sorted = Object.entries(expressions)
            .sort((a, b) => b[1] - a[1]);

        result.dominant = {
            expression: sorted[0][0],
            confidence: sorted[0][1]
        };

        // Neutraler Ausdruck bevorzugt
        if (sorted[0][0] !== 'neutral' && sorted[0][1] > 0.5) {
            result.warnings.push(`Gesichtsausdruck: ${sorted[0][0]} (neutral bevorzugt)`);
        }

        return result;
    }

    /**
     * Hintergrund analysieren
     */
    async analyzeBackground(buffer, faceDetection) {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
            metrics: {}
        };

        try {
            const img = await sharp(buffer)
                .greyscale()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const pixels = new Uint8Array(img.data);
            const { width, height } = img.info;

            // Extrahiere Hintergrund-Pixel (außerhalb Gesichts-Box)
            const box = faceDetection.box;
            const bgPixels = [];

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // Skip Gesichts-Region
                    if (x >= box.x && x < box.x + box.width &&
                        y >= box.y && y < box.y + box.height) {
                        continue;
                    }

                    bgPixels.push(pixels[y * width + x]);
                }
            }

            if (bgPixels.length === 0) {
                result.warnings.push('Hintergrund-Analyse nicht möglich (Gesicht zu groß)');
                result.valid = true;
                return result;
            }

            // Helligkeit
            const brightness = bgPixels.reduce((sum, p) => sum + p, 0) / bgPixels.length;
            result.metrics.brightness = Math.round(brightness);

            if (brightness < REQUIREMENTS.background.minBrightness) {
                result.errors.push(`Hintergrund zu dunkel: ${Math.round(brightness)} (min: ${REQUIREMENTS.background.minBrightness})`);
            }

            // Einheitlichkeit (Varianz)
            const mean = brightness;
            const variance = bgPixels.reduce((sum, p) => sum + (p - mean) ** 2, 0) / bgPixels.length;
            result.metrics.variance = Math.round(variance);

            if (variance > REQUIREMENTS.background.maxVariance) {
                result.warnings.push('Hintergrund nicht einheitlich (Muster oder Schatten erkannt)');
            }

            result.valid = result.errors.length === 0;

        } catch (error) {
            this.log('error', 'Hintergrund-Analyse fehlgeschlagen', { error: error.message });
            result.warnings.push('Hintergrund-Analyse nicht möglich');
            result.valid = true; // Nicht blockieren
        }

        return result;
    }

    /**
     * Hilfsfunktion: Mittelpunkt von Punkten
     */
    getCenterPoint(points) {
        const sum = points.reduce((acc, p) => ({
            x: acc.x + p.x,
            y: acc.y + p.y
        }), { x: 0, y: 0 });

        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        };
    }
}

module.exports = BiometricValidator;
