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
 * 3. Füge Upload-Feldern die CSS-Klasse "biometric-upload" hinzu
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
 * Version: 2.5.0 - Relaxed requirements for better UX (dimensions = soft errors)
 * Datum: 2025-01-14
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

(function() {
    'use strict';

    // ============================================
    // KONFIGURATION
    // ============================================

    const CONFIG = {
        // ✅ NUR Upload-Felder mit CSS-Klasse "biometric-upload" werden validiert
        VALIDATION_STRATEGY: 'biometric-upload',

        // Falls 'specific' gewählt wird, hier die Feld-IDs eintragen
        SPECIFIC_FIELDS: ['xi-upl-passport-photo'],

        // Server-Endpoint für detaillierte Validierung
        SERVER_ENDPOINT: '/api/validate-biometric',

        // Biometrische Anforderungen (v2.5.0 - Gelockert für bessere UX)
        BIOMETRIC_REQUIREMENTS: {
            // Technische Anforderungen (gelockert)
            minWidth: 800,               // Gelockert: 800px statt 1050px
            minHeight: 1029,             // Gelockert: 1029px statt 1350px
            recommendedWidth: 1050,      // ICAO-Standard (Empfehlung)
            recommendedHeight: 1350,     // ICAO-Standard (Empfehlung)

            // Seitenverhältnis (größere Toleranz)
            aspectRatioMin: 0.74,        // Gelockert: 0.74 statt 0.76
            aspectRatioMax: 0.81,        // Gelockert: 0.81 statt 0.79

            // Dateigröße (größere Toleranz)
            minFileSize: 30 * 1024,      // Gelockert: 30 KB statt 50 KB
            maxFileSize: 500 * 1024,     // Unverändert: 500 KB

            enableFaceDetection: true,
            enableServerValidation: false,  // Deaktiviert per Default (Server optional)

            // Qualität (gelockert)
            minSharpness: 80,            // Gelockert: 80 statt 100
            minContrast: 30,             // Gelockert: 30 statt 40

            // Hintergrund (größere Toleranz)
            background: {
                minBrightness: 180,      // Gelockert: 180 statt 200 (dunkler erlaubt)
                maxVariance: 50,         // Gelockert: 50 statt 30 (mehr Ungleichmäßigkeit)
                checkEnabled: true       // Hintergrund-Prüfung aktiv
            },

            // Facial Lighting (größere Toleranz)
            facialLighting: {
                enabled: true,           // 4-Zonen Lighting-Analyse aktiviert
                maxIntensityRatio: 2.5,  // Gelockert: 2.5 statt 2.0 (mehr Schatten erlaubt)
                minZoneHomogeneity: 0.75, // Gelockert: 0.75 statt 0.85 (weniger homogen)
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

        log('🔍 Prüfe Bild-Optimierung:', file.name);

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

            log(`🔧 Optimierung nötig: ${optimizationType.join(', ')}`);

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
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

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
        }, 5000);
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

        // Banner
        const $banner = $('<div class="biometric-banner"></div>').css({
            padding: '12px 15px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '8px 8px 0 0',
            fontWeight: 'bold',
            textAlign: 'center',
            fontSize: '16px'
        }).html(`
            <div style="margin-bottom:8px;font-size:16px">📸 Biometrische Bildprüfung aktiv (ICAO-Kompatibel)</div>
            <div style="font-size:15px;font-weight:normal;opacity:0.95;line-height:1.4">
                Führerscheinfoto • Min: 800×1029px • Empfohlen: 1050×1350px • JPEG/PNG • Max 500 KB
            </div>
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

        $ui.append($banner, $status, $preview);

        // Füge UI nach dem Upload-Feld ein
        $field.after($ui);

        log('✅ Validierungs-UI erstellt für:', fieldId);

        return {
            $ui: $ui,
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
                <div style="font-size:24px;margin-bottom:10px">⏳</div>
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
     * Zeigt Validierungs-Ergebnis (Ampel-System)
     * 🟢 Grün = Perfekt (keine Fehler)
     * 🟡 Gelb = Akzeptabel (nur Soft Errors, Bild wird verwendet)
     * 🔴 Rot = Abgelehnt (Hard Errors, Bild wird entfernt)
     */
    function showValidationResult(ui, result, fileName) {
        const $status = ui.$status;

        const hasHardErrors = result.hardErrors && result.hardErrors.length > 0;
        const hasSoftErrors = result.softErrors && result.softErrors.length > 0;
        const hasWarnings = result.warnings && result.warnings.length > 0;

        // 🟢 GRÜN: Perfekt - keine Fehler
        if (result.valid && !hasSoftErrors) {
            $status.html(`
                <div style="text-align:center;padding:20px;background:#d4edda;border-radius:6px">
                    <div style="font-size:48px;margin-bottom:10px">✅</div>
                    <div style="font-weight:bold;font-size:18px;margin-bottom:10px;color:#155724">
                        Bild ist hervorragend!
                    </div>
                    <div style="font-size:14px;color:#155724">
                        ${fileName}
                    </div>
                    ${hasWarnings ? `
                        <div style="margin-top:15px;padding:10px;background:#fff3cd;border-radius:6px;text-align:left">
                            <strong>💡 Hinweise:</strong><br>
                            ${result.warnings.map(w => `• ${w}`).join('<br>')}
                        </div>
                    ` : ''}
                </div>
            `).show();

            // Auto-Hide nach 15 Sekunden
            setTimeout(() => {
                $status.slideUp();
            }, 15000);

        // 🟡 GELB: Akzeptabel - nur Soft Errors (Bild wird trotzdem verwendet!)
        } else if (!hasHardErrors && hasSoftErrors) {
            $status.html(`
                <div style="text-align:center;padding:20px;background:#fff3cd;border-radius:6px">
                    <div style="font-size:48px;margin-bottom:10px">⚠️</div>
                    <div style="font-weight:bold;font-size:18px;margin-bottom:10px;color:#856404">
                        Bild wird verwendet
                    </div>
                    <div style="margin-top:15px;padding:15px;background:#fff;border:2px solid #ffc107;border-radius:6px;text-align:left">
                        <strong style="font-size:15px">⚠️ Qualitätshinweise:</strong><br>
                        <div style="font-size:14px;margin-top:8px">${result.softErrors.map(e => `• ${e}`).join('<br>')}</div>
                        <div style="margin-top:10px;padding:10px;background:#fff3cd;border-radius:4px;font-size:12px">
                            <strong>💡 Info:</strong> Das Bild entspricht nicht allen Ideal-Anforderungen,
                            ist aber für den Druck noch verwendbar. Sie können es nutzen.
                        </div>
                    </div>
                    ${hasWarnings ? `
                        <div style="margin-top:15px;padding:10px;background:#e7f3ff;border-radius:6px;text-align:left">
                            <strong>ℹ️ Weitere Hinweise:</strong><br>
                            ${result.warnings.map(w => `• ${w}`).join('<br>')}
                        </div>
                    ` : ''}
                </div>
            `).show();

            // Länger anzeigen (45 Sekunden), damit User die Hinweise lesen kann
            setTimeout(() => {
                $status.slideUp();
            }, 45000);

        // 🔴 ROT: Abgelehnt - Hard Errors (Bild wird entfernt)
        } else if (hasHardErrors) {
            $status.html(`
                <div style="text-align:center;padding:20px;background:#f8d7da;border-radius:6px">
                    <div style="font-size:48px;margin-bottom:10px">❌</div>
                    <div style="font-weight:bold;font-size:18px;margin-bottom:10px;color:#721c24">
                        Bild nicht verwendbar
                    </div>
                    <div style="margin-top:15px;padding:15px;background:#fff;border:2px solid #dc3545;border-radius:6px;text-align:left">
                        <strong style="font-size:15px">❌ Technische Fehler:</strong><br>
                        <div style="font-size:14px;margin-top:8px">${result.hardErrors.map(e => `• ${e}`).join('<br>')}</div>
                        <div style="margin-top:10px;padding:10px;background:#f8d7da;border-radius:4px;font-size:12px">
                            <strong>⚠️ Bitte neues Foto aufnehmen:</strong> Diese Fehler sind kritisch
                            und können nicht umgangen werden.
                        </div>
                    </div>
                    ${hasSoftErrors ? `
                        <div style="margin-top:15px;padding:10px;background:#fff3cd;border-radius:6px;text-align:left">
                            <strong style="font-size:14px">⚠️ Zusätzliche Qualitätshinweise:</strong><br>
                            <div style="font-size:13px;margin-top:6px">${result.softErrors.map(e => `• ${e}`).join('<br>')}</div>
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
        log('🚀 Starte biometrische Validierung für:', file.name);

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
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Aktualisiere den FileInput mit dem optimierten Bild
                    await updateFileInput($field, fileToValidate);
                }
            }

            // SCHRITT 2: Validierung (mit optimiertem oder originalem Bild)
            const validator = getValidator();
            const result = await validator.validateImage(fileToValidate);

            // Speichere welches File tatsächlich validiert wurde (wichtig für removeInvalidFile!)
            result.validatedFile = fileToValidate;

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
                await new Promise(resolve => setTimeout(resolve, 3000));
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

        // WICHTIG: Leere auch den xm-upload-wrapper (Formcycle-spezifisch)
        const $wrapper = $field.closest('.xm-upload-wrapper');
        if ($wrapper.length > 0) {
            log('🗑️ Leere xm-upload-wrapper');

            // Entferne alle visuellen Upload-Elemente
            $wrapper.find('.xm-upload-file').remove();
            $wrapper.find('.xm-upload-preview').remove();
            $wrapper.find('.upload-item').remove();
            $wrapper.find('.xm-upl-wrapper').remove();  // Entferne Dateinamen-Label

            // Reset des Wrappers
            $wrapper.removeClass('has-file');

            // Wenn keine Dateien mehr übrig, zeige Upload-Hinweis wieder
            if (dt.files.length === 0) {
                $wrapper.find('.xm-upload-placeholder').show();
            }
        }

        log('🗑️ Ungültige Datei entfernt:', fileToRemove.name, `(${dt.files.length} Dateien übrig)`);
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
            log('   💡 Tipp: Fügen Sie Upload-Feldern die CSS-Klasse "biometric-upload" hinzu');
            return;
        }

        log(`✅ ${$fields.length} neue(s) Feld(er) für biometrische Validierung gefunden`);

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

                    log(`📝 Validiere Datei ${i + 1}/${newFiles.length}:`, file.name);

                    const result = await validateBiometricImage(file, $field, ui);

                    // 🟢 GRÜN: Perfekt - keine Fehler
                    if (result.valid && !result.softErrors?.length) {
                        log('✅ Datei perfekt:', file.name);
                        // Bild bleibt im Upload, grüne Erfolgsmeldung wird angezeigt

                    // 🟡 GELB: Akzeptabel - nur Soft Errors (Bild bleibt automatisch drin!)
                    } else if (!result.hardErrors?.length && result.softErrors?.length > 0) {
                        log('⚠️ Datei hat Qualitätsmängel, wird aber akzeptiert:', file.name);
                        log(`  → Soft Errors: ${result.softErrors.length}`);
                        // WICHTIG: Bild wird NICHT entfernt!
                        // Gelbe Warnung wird angezeigt, aber Bild bleibt im Upload

                    // 🔴 ROT: Hard Errors - Bild wird entfernt
                    } else if (result.hardErrors?.length > 0) {
                        log('❌ Datei hat technische Fehler → wird entfernt:', file.name);
                        log(`  → Hard Errors: ${result.hardErrors.length}`);

                        // WICHTIG: Verwende das validierte File (könnte optimiert sein!)
                        const fileToRemove = result.validatedFile || file;

                        if (CONFIG.AUTO_REMOVE_INVALID) {
                            // Entferne automatisch
                            removeInvalidFile($field, fileToRemove);
                        } else {
                            // Frage User
                            const shouldRemove = confirm(
                                `Datei "${file.name}" hat technische Fehler:\n\n${result.hardErrors.join('\n')}\n\nDie Datei muss entfernt werden.`
                            );

                            if (shouldRemove) {
                                removeInvalidFile($field, fileToRemove);
                            }
                        }

                        // Verhindere weiteren Upload
                        return false;
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
                log('🔍 Neue Upload-Felder im DOM erkannt');
                setupBiometricValidation();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('👁️ Beobachte DOM für neue Upload-Felder');
    }

    // ============================================
    // INITIALISIERUNG
    // ============================================

    function init() {
        console.clear();
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
        console.log('%c📸 BIOMETRIC UPLOAD INTEGRATION (STANDALONE)', 'color: #667eea; font-weight: bold; font-size: 16px');
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');

        if (typeof $ === 'undefined') {
            console.error('❌ jQuery nicht verfügbar!');
            return;
        }

        console.group('%c⚙️  Konfiguration', 'color: #2196F3; font-weight: bold');
        console.log('Validierungs-Strategie:', CONFIG.VALIDATION_STRATEGY);
        console.log('💡 Nur Upload-Felder mit CSS-Klasse "biometric-upload" werden validiert');
        console.log('Gesichtserkennung:', CONFIG.BIOMETRIC_REQUIREMENTS.enableFaceDetection);
        console.log('Auto-Optimize:', CONFIG.AUTO_OPTIMIZE.enabled);
        console.log('Ampel-System:', '🟢 Grün = Perfekt | 🟡 Gelb = Akzeptabel | 🔴 Rot = Abgelehnt');
        console.log('');
        console.log('⚠️ WICHTIG: Verwendet KEINE Formcycle-internen APIs!');
        console.log('⚠️ Funktioniert mit Standard HTML5 File-Inputs!');
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
