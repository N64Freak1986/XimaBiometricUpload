#!/usr/bin/env python3
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BIOMETRIC IMAGE VALIDATION SERVER (Python + Flask)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REST API für biometrische Bildvalidierung nach ICAO/ISO 19794-5

Features:
- ✅ Detaillierte Gesichtserkennung mit dlib/face_recognition
- ✅ Positionsprüfung (Zentrierung, Gesichtsgröße)
- ✅ Hintergrundanalyse (Einheitlichkeit, Helligkeit)
- ✅ Augenerkennung (beide Augen offen)
- ✅ Metadaten-Extraktion (EXIF)
- ✅ Qualitätsprüfung (Schärfe, Beleuchtung)
- ✅ DSGVO-konformes Logging

Version: 1.0.0
Datum: 2025-01-13
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import logging
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

from validator import BiometricValidator

# ============================================
# KONFIGURATION
# ============================================

CONFIG = {
    'PORT': int(os.getenv('PORT', 3000)),
    'MAX_FILE_SIZE': 10 * 1024 * 1024,  # 10 MB
    'UPLOAD_DIR': Path(__file__).parent / 'uploads',
    'TEMP_DIR': Path(__file__).parent / 'temp',
    'LOG_DIR': Path(__file__).parent / 'logs',
    'CORS_ORIGIN': os.getenv('CORS_ORIGIN', '*'),
    'ALLOWED_EXTENSIONS': {'jpg', 'jpeg', 'png'}
}

# ============================================
# LOGGING
# ============================================

# Erstelle Verzeichnisse
CONFIG['UPLOAD_DIR'].mkdir(exist_ok=True)
CONFIG['TEMP_DIR'].mkdir(exist_ok=True)
CONFIG['LOG_DIR'].mkdir(exist_ok=True)

# Logger konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(CONFIG['LOG_DIR'] / 'app.log')
    ]
)

logger = logging.getLogger(__name__)

# ============================================
# FLASK APP
# ============================================

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = CONFIG['MAX_FILE_SIZE']

# CORS
CORS(app, origins=CONFIG['CORS_ORIGIN'])

# ============================================
# VALIDATOR INSTANCE
# ============================================

validator = BiometricValidator(debug=True, logger=logger)

# ============================================
# HELPER FUNCTIONS
# ============================================

def allowed_file(filename):
    """Prüft ob Dateiendung erlaubt ist"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in CONFIG['ALLOWED_EXTENSIONS']

# ============================================
# ROUTES
# ============================================

@app.route('/health', methods=['GET'])
def health():
    """Health Check"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api', methods=['GET'])
def api_info():
    """API Info"""
    return jsonify({
        'name': 'XIMA Biometric Validation API',
        'version': '1.0.0',
        'endpoints': {
            'validate': '/api/validate-biometric (POST)',
            'health': '/health (GET)'
        },
        'standards': [
            'ICAO Doc 9303',
            'ISO/IEC 19794-5',
            'ISO/IEC 29794-5'
        ]
    })

@app.route('/api/validate-biometric', methods=['POST'])
def validate_biometric():
    """Biometrische Validierung"""
    request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')

    logger.info(f'📸 Neue Validierungsanfrage [ID: {request_id}]')

    try:
        # Prüfe ob Datei vorhanden
        if 'image' not in request.files:
            logger.warning(f'❌ Keine Datei hochgeladen [ID: {request_id}]')
            return jsonify({
                'valid': False,
                'errors': ['Keine Bilddatei hochgeladen']
            }), 400

        file = request.files['image']

        if file.filename == '':
            return jsonify({
                'valid': False,
                'errors': ['Keine Datei ausgewählt']
            }), 400

        if not allowed_file(file.filename):
            return jsonify({
                'valid': False,
                'errors': [f'Ungültiges Dateiformat. Erlaubt: {", ".join(CONFIG["ALLOWED_EXTENSIONS"])}']
            }), 400

        # Datei temporär speichern
        filename = secure_filename(file.filename)
        temp_path = CONFIG['TEMP_DIR'] / f'{request_id}_{filename}'
        file.save(str(temp_path))

        logger.info(f'📁 Datei empfangen: {filename} [ID: {request_id}]')

        # Validierung durchführen
        result = validator.validate(str(temp_path))

        # Log Ergebnis
        logger.info(
            f'{"✅" if result["valid"] else "❌"} Validierung abgeschlossen '
            f'[ID: {request_id}, Errors: {len(result["errors"])}, Warnings: {len(result["warnings"])}]'
        )

        # Temporäre Datei löschen
        try:
            temp_path.unlink()
        except Exception as e:
            logger.error(f'Fehler beim Löschen der temp. Datei: {e}')

        # Response
        return jsonify({
            'requestId': request_id,
            **result
        })

    except RequestEntityTooLarge:
        logger.warning(f'❌ Datei zu groß [ID: {request_id}]')
        return jsonify({
            'valid': False,
            'errors': [f'Datei zu groß (max {CONFIG["MAX_FILE_SIZE"] // (1024*1024)} MB)']
        }), 413

    except Exception as e:
        logger.error(f'❌ Validierungs-Fehler [ID: {request_id}]: {str(e)}', exc_info=True)

        # Cleanup
        try:
            if 'temp_path' in locals():
                temp_path.unlink()
        except:
            pass

        return jsonify({
            'requestId': request_id,
            'valid': False,
            'errors': [f'Serverfehler: {str(e)}']
        }), 500

# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(413)
def too_large(e):
    return jsonify({
        'valid': False,
        'errors': [f'Datei zu groß (max {CONFIG["MAX_FILE_SIZE"] // (1024*1024)} MB)']
    }), 413

@app.errorhandler(500)
def internal_error(e):
    logger.error(f'Interner Server-Fehler: {str(e)}', exc_info=True)
    return jsonify({
        'valid': False,
        'errors': ['Interner Serverfehler']
    }), 500

# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🔐 BIOMETRIC VALIDATION SERVER (Python)')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info(f'✅ Server läuft auf Port {CONFIG["PORT"]}')
    logger.info(f'📍 API: http://localhost:{CONFIG["PORT"]}/api')
    logger.info(f'🏥 Health: http://localhost:{CONFIG["PORT"]}/health')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    app.run(
        host='0.0.0.0',
        port=CONFIG['PORT'],
        debug=os.getenv('DEBUG', 'false').lower() == 'true'
    )
