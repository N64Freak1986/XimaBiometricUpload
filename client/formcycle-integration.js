/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * FORMCYCLE BIOMETRIC UPLOAD INTEGRATION - STANDALONE VERSION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * ⚠️ WICHTIG: Verwendet KEINE Formcycle-internen APIs!
 * ⚠️ Funktioniert mit Standard HTML5 File-Inputs!
 *
 * INTEGRATION:
 * 1. Inkludiere biometric-validator.js
 * 2. Inkludiere diese Datei
 * 3. Alle Upload-Felder werden automatisch validiert
 * 4. KEINE Abhängigkeiten zu Formcycle-APIs (ajaxUpload, ajaxUploadManager, etc.)
 *
 * Features:
 * - ✅ Funktioniert mit normalem <input type="file">
 * - ✅ Echtzeit-Validierung bei Dateiauswahl
 * - ✅ Visuelles Feedback mit Vorschau
 * - ✅ Schritt-für-Schritt Validierung mit Progress
 * - ✅ Nur gültige Bilder bleiben im Input
 *
 * Version: 1.1.0
 * Datum: 2025-01-13
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

        // Biometrische Anforderungen (überschreibt Defaults)
        BIOMETRIC_REQUIREMENTS: {
            minWidth: 1200,
            minHeight: 900,
            recommendedWidth: 1200,
            recommendedHeight: 1600,
            maxFileSize: 500 * 1024, // 500 KB
            enableFaceDetection: true,
            enableServerValidation: false,  // Deaktiviert per Default (Server optional)
            debug: true
        },

        // UI-Einstellungen
        SHOW_PREVIEW: true,
        SHOW_VALIDATION_STEPS: true,
        AUTO_REMOVE_INVALID: true, // Ungültige Bilder automatisch entfernen

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
            fontSize: '13px'
        }).html(`
            <div style="margin-bottom:6px">🔐 Biometrische Bildprüfung aktiv (Standalone)</div>
            <div style="font-size:11px;font-weight:normal;opacity:0.9">
                Führerscheinfoto • Mind. 1200x900px • Format: JPEG/PNG • Max 500 KB
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
                <div style="font-size:24px;margin-bottom:10px">🔍</div>
                <div style="font-weight:bold;margin-bottom:10px">Prüfe Bild: ${fileName}</div>
                <div class="validation-steps" style="text-align:left;margin-top:15px">
                    <div class="step" id="step-format">⏳ Format und Dateigröße...</div>
                    <div class="step" id="step-dimensions">⏳ Bildabmessungen...</div>
                    <div class="step" id="step-quality">⏳ Bildqualität...</div>
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
            $status.html(`
                <div style="text-align:center;padding:20px;color:#28a745">
                    <div style="font-size:48px;margin-bottom:10px">✅</div>
                    <div style="font-weight:bold;font-size:18px;margin-bottom:10px">
                        Bild erfüllt alle Anforderungen!
                    </div>
                    <div style="font-size:14px;color:#666">
                        ${fileName}
                    </div>
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
            $status.html(`
                <div style="text-align:center;padding:20px;color:#dc3545">
                    <div style="font-size:48px;margin-bottom:10px">❌</div>
                    <div style="font-weight:bold;font-size:18px;margin-bottom:10px">
                        Bild entspricht nicht den Anforderungen
                    </div>
                    <div style="margin-top:15px;padding:15px;background:#fff;border:2px solid #dc3545;border-radius:6px;text-align:left">
                        <strong>Fehler:</strong><br>
                        ${result.errors.map(e => `❌ ${e}`).join('<br><br>')}
                    </div>
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
            const validator = getValidator();
            const result = await validator.validateImage(file);

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

        // Finde Upload-Felder
        const $fields = $('input[type="file"]').filter(function() {
            return shouldValidateBiometric($(this));
        });

        if ($fields.length === 0) {
            log('⚠️ Keine Felder für biometrische Validierung gefunden');
            log('   Strategie:', CONFIG.VALIDATION_STRATEGY);
            return;
        }

        log(`📋 ${$fields.length} Feld(er) für biometrische Validierung gefunden`);

        // Setup für jedes Feld
        $fields.each(function() {
            const $field = $(this);
            const fieldId = $field.attr('id') || '(keine ID)';

            log(`  → ${fieldId}`);

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

                        if (CONFIG.AUTO_REMOVE_INVALID) {
                            // Entferne automatisch
                            removeInvalidFile($field, file);
                        } else {
                            // Frage User
                            const shouldRemove = confirm(
                                `Datei "${file.name}" entspricht nicht den biometrischen Anforderungen.\n\n` +
                                `Fehler:\n${result.errors.join('\n')}\n\n` +
                                `Möchten Sie die Datei entfernen?`
                            );

                            if (shouldRemove) {
                                removeInvalidFile($field, file);
                            }
                        }

                        // Verhindere weiteren Upload
                        return false;
                    } else {
                        log('✅ Datei gültig:', file.name);
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
        const observer = new MutationObserver(() => {
            setupBiometricValidation();
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
