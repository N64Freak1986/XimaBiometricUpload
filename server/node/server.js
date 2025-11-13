/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * BIOMETRIC IMAGE VALIDATION SERVER (Node.js + Express)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * REST API für biometrische Bildvalidierung nach ICAO/ISO 19794-5
 *
 * Features:
 * - ✅ Detaillierte Gesichtserkennung mit face-api.js
 * - ✅ Positionsprüfung (Zentrierung, Gesichtsgröße)
 * - ✅ Hintergrundanalyse (Einheitlichkeit, Helligkeit)
 * - ✅ Augenerkennung (beide Augen offen)
 * - ✅ Metadaten-Extraktion (EXIF, Kameradaten)
 * - ✅ Qualitätsprüfung (Schärfe, Beleuchtung, Schatten)
 * - ✅ Audit-Logging (DSGVO-konform)
 * - ✅ Rate-Limiting & Security
 *
 * Version: 1.0.0
 * Datum: 2025-01-13
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;

const BiometricValidator = require('./validator');

// ============================================
// KONFIGURATION
// ============================================

const CONFIG = {
    PORT: process.env.PORT || 3000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
    UPLOAD_DIR: path.join(__dirname, 'uploads'),
    TEMP_DIR: path.join(__dirname, 'temp'),
    LOG_DIR: path.join(__dirname, 'logs'),
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 Minuten
    RATE_LIMIT_MAX: 100 // Max 100 Requests pro 15 Minuten
};

// ============================================
// LOGGER
// ============================================

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({
            filename: path.join(CONFIG.LOG_DIR, 'error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(CONFIG.LOG_DIR, 'combined.log')
        })
    ]
});

// ============================================
// EXPRESS APP
// ============================================

const app = express();

// Security
app.use(helmet());
app.use(cors({
    origin: CONFIG.CORS_ORIGIN
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: CONFIG.RATE_LIMIT_WINDOW,
    max: CONFIG.RATE_LIMIT_MAX,
    message: 'Zu viele Anfragen, bitte später nochmal versuchen.'
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json());

// Multer für File-Uploads
const upload = multer({
    dest: CONFIG.TEMP_DIR,
    limits: {
        fileSize: CONFIG.MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Ungültiges Format: ${file.mimetype}`));
        }
    }
});

// ============================================
// VALIDATOR INSTANCE
// ============================================

let validator = null;

async function getValidator() {
    if (!validator) {
        validator = new BiometricValidator({
            debug: true,
            logger: logger
        });
        await validator.loadModels();
        logger.info('✅ BiometricValidator initialisiert');
    }
    return validator;
}

// ============================================
// ROUTES
// ============================================

/**
 * Health Check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * API Info
 */
app.get('/api', (req, res) => {
    res.json({
        name: 'XIMA Biometric Validation API',
        version: '1.0.0',
        endpoints: {
            validate: '/api/validate-biometric (POST)',
            health: '/health (GET)'
        },
        standards: [
            'ICAO Doc 9303',
            'ISO/IEC 19794-5',
            'ISO/IEC 29794-5'
        ]
    });
});

/**
 * Biometrische Validierung
 */
app.post('/api/validate-biometric', upload.single('image'), async (req, res) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    logger.info('📸 Neue Validierungsanfrage', {
        requestId,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    try {
        // Prüfe ob Datei vorhanden
        if (!req.file) {
            logger.warn('❌ Keine Datei hochgeladen', { requestId });
            return res.status(400).json({
                valid: false,
                errors: ['Keine Bilddatei hochgeladen']
            });
        }

        const filePath = req.file.path;
        const fileName = req.file.originalname;

        logger.info('📁 Datei empfangen', {
            requestId,
            fileName,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // Validierung durchführen
        const validator = await getValidator();
        const result = await validator.validate(filePath);

        // Audit-Log
        logger.info('✅ Validierung abgeschlossen', {
            requestId,
            fileName,
            valid: result.valid,
            errors: result.errors.length,
            warnings: result.warnings.length
        });

        // Temporäre Datei löschen
        await fs.unlink(filePath).catch(err => {
            logger.error('Fehler beim Löschen der temp. Datei', { requestId, error: err.message });
        });

        // Response
        res.json({
            requestId,
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
            details: result.details,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('❌ Validierungs-Fehler', {
            requestId,
            error: error.message,
            stack: error.stack
        });

        // Cleanup
        if (req.file && req.file.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }

        res.status(500).json({
            requestId,
            valid: false,
            errors: [`Serverfehler: ${error.message}`]
        });
    }
});

/**
 * Fehler-Handler
 */
app.use((err, req, res, next) => {
    logger.error('Express Error Handler', {
        error: err.message,
        stack: err.stack
    });

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                valid: false,
                errors: ['Datei zu groß (max 10 MB)']
            });
        }
    }

    res.status(500).json({
        valid: false,
        errors: [err.message || 'Interner Serverfehler']
    });
});

// ============================================
// SERVER START
// ============================================

async function start() {
    try {
        // Erstelle Verzeichnisse
        await fs.mkdir(CONFIG.UPLOAD_DIR, { recursive: true });
        await fs.mkdir(CONFIG.TEMP_DIR, { recursive: true });
        await fs.mkdir(CONFIG.LOG_DIR, { recursive: true });

        // Validator initialisieren
        await getValidator();

        // Server starten
        app.listen(CONFIG.PORT, () => {
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logger.info('🔐 BIOMETRIC VALIDATION SERVER');
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logger.info(`✅ Server läuft auf Port ${CONFIG.PORT}`);
            logger.info(`📍 API: http://localhost:${CONFIG.PORT}/api`);
            logger.info(`🏥 Health: http://localhost:${CONFIG.PORT}/health`);
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        });

    } catch (error) {
        logger.error('❌ Server-Start fehlgeschlagen', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Graceful Shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM empfangen, fahre Server herunter...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT empfangen, fahre Server herunter...');
    process.exit(0);
});

// Start
start();
