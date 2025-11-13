#!/usr/bin/env python3
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BIOMETRIC VALIDATOR - SERVER-SIDE (Python)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detaillierte biometrische Validierung für Führerscheinfotos
nach ICAO Doc 9303 und ISO/IEC 19794-5

Version: 1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import cv2
import numpy as np
import face_recognition
import exifread
from PIL import Image
from datetime import datetime, timedelta
from pathlib import Path
import math

# ============================================
# BIOMETRISCHE ANFORDERUNGEN (ICAO/ISO)
# ============================================

REQUIREMENTS = {
    # Dimensionen
    'min_width': 600,
    'min_height': 450,
    'recommended_width': 1200,
    'recommended_height': 1600,

    # Seitenverhältnis (Portrait)
    'aspect_ratio_min': 0.70,
    'aspect_ratio_max': 0.80,

    # Gesicht
    'face': {
        'min_size_ratio': 0.60,      # Mind. 60% der Bildhöhe
        'max_size_ratio': 0.85,      # Max. 85% der Bildhöhe
        'center_tolerance_x': 0.15,  # Horizontale Zentrierung ±15%
        'center_tolerance_y': 0.10,  # Vertikale Position ±10%
    },

    # Augen
    'eyes': {
        'min_distance': 90,          # Mind. 90 Pixel Augenabstand
        'horizontal_tolerance': 5,   # Max. 5° Neigung
    },

    # Hintergrund
    'background': {
        'min_brightness': 200,       # Helligkeit (0-255)
        'max_variance': 800,         # Einheitlichkeit
    },

    # Qualität
    'quality': {
        'min_sharpness': 100,
        'min_contrast': 40,
        'min_brightness': 50,
        'max_brightness': 200,
    }
}


class BiometricValidator:
    """Biometrische Bildvalidierung"""

    def __init__(self, debug=False, logger=None):
        self.debug = debug
        self.logger = logger or self._default_logger()

    def _default_logger(self):
        """Default Logger"""
        import logging
        return logging.getLogger(__name__)

    def log(self, level, message, **kwargs):
        """Logging Helper"""
        if self.logger:
            getattr(self.logger, level)(message, extra=kwargs)

    def validate(self, image_path):
        """
        Hauptvalidierung

        Args:
            image_path (str): Pfad zum Bild

        Returns:
            dict: Validierungsergebnis
        """
        self.log('info', f'🔍 Starte biometrische Validierung: {image_path}')

        result = {
            'valid': False,
            'errors': [],
            'warnings': [],
            'details': {},
            'timestamp': datetime.utcnow().isoformat()
        }

        try:
            # 1. Bild laden
            image = self._load_image(image_path)
            if image is None:
                result['errors'].append('Bild konnte nicht geladen werden')
                return result

            result['details']['image'] = {
                'width': image.shape[1],
                'height': image.shape[0],
                'channels': image.shape[2] if len(image.shape) > 2 else 1
            }

            # 2. Dimensionen prüfen
            dim_check = self._validate_dimensions(image)
            result['details']['dimensions'] = dim_check
            result['errors'].extend(dim_check.get('errors', []))
            result['warnings'].extend(dim_check.get('warnings', []))

            # 3. EXIF-Daten
            exif_check = self._analyze_exif(image_path)
            result['details']['exif'] = exif_check
            result['warnings'].extend(exif_check.get('warnings', []))

            # 4. Bildqualität
            quality_check = self._analyze_quality(image)
            result['details']['quality'] = quality_check
            result['errors'].extend(quality_check.get('errors', []))
            result['warnings'].extend(quality_check.get('warnings', []))

            # 5. Gesichtserkennung
            face_check = self._detect_and_validate_face(image)
            result['details']['face'] = face_check
            result['errors'].extend(face_check.get('errors', []))
            result['warnings'].extend(face_check.get('warnings', []))

            # 6. Hintergrund
            if face_check.get('valid') and face_check.get('location'):
                bg_check = self._analyze_background(image, face_check['location'])
                result['details']['background'] = bg_check
                result['errors'].extend(bg_check.get('errors', []))
                result['warnings'].extend(bg_check.get('warnings', []))

            # Finale Bewertung
            result['valid'] = len(result['errors']) == 0

            self.log(
                'info',
                f'{"✅" if result["valid"] else "❌"} Validierung abgeschlossen',
                valid=result['valid'],
                errors=len(result['errors']),
                warnings=len(result['warnings'])
            )

            return result

        except Exception as e:
            self.log('error', f'❌ Validierungs-Fehler: {str(e)}')
            result['errors'].append(f'Interner Fehler: {str(e)}')
            return result

    def _load_image(self, image_path):
        """Bild laden"""
        try:
            image = cv2.imread(image_path)
            if image is None:
                return None
            # BGR zu RGB
            return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        except Exception as e:
            self.log('error', f'Fehler beim Laden des Bildes: {str(e)}')
            return None

    def _validate_dimensions(self, image):
        """Dimensionen validieren"""
        result = {
            'valid': False,
            'errors': [],
            'warnings': []
        }

        height, width = image.shape[:2]

        # Mindestanforderungen
        if width < REQUIREMENTS['min_width']:
            result['errors'].append(
                f'Breite zu gering: {width}px (min: {REQUIREMENTS["min_width"]}px)'
            )

        if height < REQUIREMENTS['min_height']:
            result['errors'].append(
                f'Höhe zu gering: {height}px (min: {REQUIREMENTS["min_height"]}px)'
            )

        # Seitenverhältnis
        aspect_ratio = width / height
        if (aspect_ratio < REQUIREMENTS['aspect_ratio_min'] or
            aspect_ratio > REQUIREMENTS['aspect_ratio_max']):
            result['errors'].append(
                f'Falsches Seitenverhältnis: {aspect_ratio:.2f} '
                f'(erwartet: 0.75 ±0.05 für Portrait)'
            )

        # Empfohlene Größe
        if (width < REQUIREMENTS['recommended_width'] or
            height < REQUIREMENTS['recommended_height']):
            result['warnings'].append(
                f'Empfohlene Größe nicht erreicht: {width}x{height}px '
                f'(empfohlen: {REQUIREMENTS["recommended_width"]}x{REQUIREMENTS["recommended_height"]}px)'
            )

        result['valid'] = len(result['errors']) == 0
        return result

    def _analyze_exif(self, image_path):
        """EXIF-Daten analysieren"""
        result = {
            'data': {},
            'warnings': []
        }

        try:
            with open(image_path, 'rb') as f:
                tags = exifread.process_file(f, details=False)

                # Relevante Tags extrahieren
                result['data'] = {
                    'make': str(tags.get('Image Make', '')),
                    'model': str(tags.get('Image Model', '')),
                    'datetime': str(tags.get('EXIF DateTimeOriginal', '')),
                    'flash': str(tags.get('EXIF Flash', '')),
                    'software': str(tags.get('Image Software', ''))
                }

                # Warnungen
                flash_value = str(tags.get('EXIF Flash', '0'))
                if 'fired' in flash_value.lower():
                    result['warnings'].append('Blitz wurde verwendet (kann Schatten verursachen)')

                # Datum prüfen
                datetime_str = str(tags.get('EXIF DateTimeOriginal', ''))
                if datetime_str:
                    try:
                        photo_date = datetime.strptime(datetime_str, '%Y:%m:%d %H:%M:%S')
                        six_months_ago = datetime.now() - timedelta(days=180)

                        if photo_date < six_months_ago:
                            result['warnings'].append('Foto möglicherweise zu alt (älter als 6 Monate)')
                    except:
                        pass

        except Exception as e:
            self.log('warn', f'Konnte EXIF-Daten nicht lesen: {str(e)}')

        return result

    def _analyze_quality(self, image):
        """Bildqualität analysieren"""
        result = {
            'valid': False,
            'errors': [],
            'warnings': [],
            'metrics': {}
        }

        try:
            # Grayscale für Analyse
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

            # Schärfe (Laplace-Varianz)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            sharpness = laplacian.var()
            result['metrics']['sharpness'] = round(sharpness, 2)

            if sharpness < REQUIREMENTS['quality']['min_sharpness']:
                result['warnings'].append(f'Bild möglicherweise unscharf ({sharpness:.0f})')

            # Kontrast (Standardabweichung)
            contrast = gray.std()
            result['metrics']['contrast'] = round(contrast, 2)

            if contrast < REQUIREMENTS['quality']['min_contrast']:
                result['warnings'].append(f'Geringer Kontrast ({contrast:.0f})')

            # Helligkeit (Durchschnitt)
            brightness = gray.mean()
            result['metrics']['brightness'] = round(brightness, 2)

            if brightness < REQUIREMENTS['quality']['min_brightness']:
                result['errors'].append('Bild zu dunkel')
            elif brightness > REQUIREMENTS['quality']['max_brightness']:
                result['errors'].append('Bild überbelichtet')

            result['valid'] = len(result['errors']) == 0

        except Exception as e:
            self.log('error', f'Qualitätsanalyse fehlgeschlagen: {str(e)}')
            result['warnings'].append('Qualitätsanalyse nicht möglich')
            result['valid'] = True  # Nicht blockieren

        return result

    def _detect_and_validate_face(self, image):
        """Gesichtserkennung und Validierung"""
        result = {
            'valid': False,
            'errors': [],
            'warnings': [],
            'face_count': 0,
            'location': None
        }

        try:
            height, width = image.shape[:2]

            # Gesichter erkennen
            face_locations = face_recognition.face_locations(image, model='hog')
            result['face_count'] = len(face_locations)

            # Genau ein Gesicht erforderlich
            if len(face_locations) == 0:
                result['errors'].append('Kein Gesicht erkannt')
                return result

            if len(face_locations) > 1:
                result['errors'].append(f'Mehrere Gesichter erkannt ({len(face_locations)}). Nur eine Person erlaubt.')
                return result

            # Ein Gesicht gefunden
            top, right, bottom, left = face_locations[0]
            face_width = right - left
            face_height = bottom - top

            result['location'] = {
                'top': top,
                'right': right,
                'bottom': bottom,
                'left': left,
                'width': face_width,
                'height': face_height
            }

            # Gesichtsgröße prüfen
            face_height_ratio = face_height / height
            result['face_height_ratio'] = round(face_height_ratio, 2)

            if face_height_ratio < REQUIREMENTS['face']['min_size_ratio']:
                result['errors'].append(
                    f'Gesicht zu klein: {face_height_ratio*100:.0f}% '
                    f'(min: {REQUIREMENTS["face"]["min_size_ratio"]*100:.0f}%)'
                )
            elif face_height_ratio > REQUIREMENTS['face']['max_size_ratio']:
                result['errors'].append(
                    f'Gesicht zu groß: {face_height_ratio*100:.0f}% '
                    f'(max: {REQUIREMENTS["face"]["max_size_ratio"]*100:.0f}%)'
                )

            # Zentrierung prüfen
            face_center_x = (left + right) / 2
            face_center_y = (top + bottom) / 2
            image_center_x = width / 2
            image_center_y = height / 2

            offset_x = abs(face_center_x - image_center_x) / width
            offset_y = abs(face_center_y - image_center_y) / height

            result['center_offset'] = {
                'x': round(offset_x, 2),
                'y': round(offset_y, 2)
            }

            if offset_x > REQUIREMENTS['face']['center_tolerance_x']:
                result['warnings'].append(f'Gesicht horizontal nicht zentriert ({offset_x*100:.0f}%)')

            if offset_y > REQUIREMENTS['face']['center_tolerance_y']:
                result['warnings'].append(f'Gesicht vertikal nicht optimal positioniert ({offset_y*100:.0f}%)')

            # Augen prüfen
            eyes_check = self._validate_eyes(image, face_locations[0])
            result['eyes'] = eyes_check
            result['errors'].extend(eyes_check.get('errors', []))
            result['warnings'].extend(eyes_check.get('warnings', []))

            result['valid'] = len(result['errors']) == 0

        except Exception as e:
            self.log('error', f'Gesichtserkennung fehlgeschlagen: {str(e)}')
            result['errors'].append(f'Gesichtserkennung fehlgeschlagen: {str(e)}')

        return result

    def _validate_eyes(self, image, face_location):
        """Augen validieren"""
        result = {
            'valid': False,
            'errors': [],
            'warnings': []
        }

        try:
            # Face Landmarks
            face_landmarks_list = face_recognition.face_landmarks(image, [face_location])

            if not face_landmarks_list:
                result['warnings'].append('Augen-Landmarks nicht erkannt')
                result['valid'] = True  # Nicht blockieren
                return result

            landmarks = face_landmarks_list[0]

            # Linkes und rechtes Auge
            left_eye = landmarks['left_eye']
            right_eye = landmarks['right_eye']

            # Mittelpunkte
            left_center = self._get_center_point(left_eye)
            right_center = self._get_center_point(right_eye)

            # Augenabstand
            eye_distance = math.sqrt(
                (right_center[0] - left_center[0]) ** 2 +
                (right_center[1] - left_center[1]) ** 2
            )

            result['eye_distance'] = round(eye_distance)

            if eye_distance < REQUIREMENTS['eyes']['min_distance']:
                result['errors'].append(
                    f'Augenabstand zu gering: {eye_distance:.0f}px '
                    f'(min: {REQUIREMENTS["eyes"]["min_distance"]}px)'
                )

            # Horizontale Ausrichtung (Neigung)
            angle = math.degrees(math.atan2(
                right_center[1] - left_center[1],
                right_center[0] - left_center[0]
            ))

            result['eye_angle'] = round(angle, 1)

            if abs(angle) > REQUIREMENTS['eyes']['horizontal_tolerance']:
                result['warnings'].append(f'Kopf leicht geneigt: {abs(angle):.1f}°')

            result['valid'] = len(result['errors']) == 0

        except Exception as e:
            self.log('warn', f'Augen-Validierung fehlgeschlagen: {str(e)}')
            result['warnings'].append('Augen-Validierung nicht möglich')
            result['valid'] = True  # Nicht blockieren

        return result

    def _analyze_background(self, image, face_location):
        """Hintergrund analysieren"""
        result = {
            'valid': False,
            'errors': [],
            'warnings': [],
            'metrics': {}
        }

        try:
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

            # Maske für Hintergrund (ohne Gesicht)
            mask = np.ones((height, width), dtype=np.uint8) * 255

            # Gesichts-Region ausschneiden
            top = face_location['top']
            bottom = face_location['bottom']
            left = face_location['left']
            right = face_location['right']

            mask[top:bottom, left:right] = 0

            # Hintergrund-Pixel
            bg_pixels = gray[mask == 255]

            if len(bg_pixels) == 0:
                result['warnings'].append('Hintergrund-Analyse nicht möglich (Gesicht zu groß)')
                result['valid'] = True
                return result

            # Helligkeit
            brightness = bg_pixels.mean()
            result['metrics']['brightness'] = round(brightness)

            if brightness < REQUIREMENTS['background']['min_brightness']:
                result['errors'].append(
                    f'Hintergrund zu dunkel: {brightness:.0f} '
                    f'(min: {REQUIREMENTS["background"]["min_brightness"]})'
                )

            # Einheitlichkeit (Varianz)
            variance = bg_pixels.var()
            result['metrics']['variance'] = round(variance)

            if variance > REQUIREMENTS['background']['max_variance']:
                result['warnings'].append('Hintergrund nicht einheitlich (Muster oder Schatten erkannt)')

            result['valid'] = len(result['errors']) == 0

        except Exception as e:
            self.log('error', f'Hintergrund-Analyse fehlgeschlagen: {str(e)}')
            result['warnings'].append('Hintergrund-Analyse nicht möglich')
            result['valid'] = True  # Nicht blockieren

        return result

    def _get_center_point(self, points):
        """Mittelpunkt von Punkten berechnen"""
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        return (sum(x_coords) / len(points), sum(y_coords) / len(points))
