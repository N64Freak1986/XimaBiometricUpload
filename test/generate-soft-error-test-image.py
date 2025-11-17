#!/usr/bin/env python3
"""
Generiert ein Testbild für Biometrische Validierung:
- ERFÜLLT alle Hard-Error-Anforderungen (Dimensionen, Format, Größe, Seitenverhältnis)
- HAT Soft Errors (Schatten, ungleichmäßige Beleuchtung)

Damit kann die Checkbox cb1 getestet werden!
"""

from PIL import Image, ImageDraw, ImageFilter
import os

# ICAO-konforme Dimensionen
WIDTH = 1050   # 35mm @ 300 DPI
HEIGHT = 1350  # 45mm @ 300 DPI

# Erstelle Bild mit hellem Hintergrund
img = Image.new('RGB', (WIDTH, HEIGHT), color=(240, 240, 240))  # Hellgrau
draw = ImageDraw.Draw(img)

# Gesicht (Oval) - ICAO: 70-80% der Bildhöhe
face_height = int(HEIGHT * 0.75)  # 75% = 1012px
face_width = int(face_height * 0.75)  # Oval-Form

# Zentriert horizontal, leicht oberhalb der Mitte
face_x = (WIDTH - face_width) // 2
face_y = int(HEIGHT * 0.2)  # 20% von oben

# Zeichne Gesicht (Hautfarbe)
face_bbox = [
    face_x,
    face_y,
    face_x + face_width,
    face_y + face_height
]
draw.ellipse(face_bbox, fill=(255, 220, 177))  # Hautfarbe

# SOFT ERROR 1: Schatten auf linker Gesichtshälfte
# Erstelle halbtransparenten dunklen Bereich
shadow = Image.new('RGBA', (WIDTH, HEIGHT), color=(0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(shadow)

# Linke Gesichtshälfte abdunkeln
shadow_left = face_x
shadow_right = face_x + face_width // 2
shadow_draw.rectangle(
    [shadow_left, face_y, shadow_right, face_y + face_height],
    fill=(0, 0, 0, 80)  # 80/255 = ~31% Transparenz
)

# Weicher Übergang
shadow = shadow.filter(ImageFilter.GaussianBlur(radius=30))

# Merge shadow
img = Image.alpha_composite(img.convert('RGBA'), shadow).convert('RGB')

# SOFT ERROR 2: Dunkler Fleck im oberen Bereich (simuliert Schatten)
draw = ImageDraw.Draw(img)
dark_spot_x = face_x + int(face_width * 0.3)
dark_spot_y = face_y + int(face_height * 0.2)
dark_spot_size = 100

# Erstelle Gradient für dunklen Fleck
spot = Image.new('RGBA', (WIDTH, HEIGHT), color=(0, 0, 0, 0))
spot_draw = ImageDraw.Draw(spot)
spot_draw.ellipse(
    [
        dark_spot_x - dark_spot_size,
        dark_spot_y - dark_spot_size,
        dark_spot_x + dark_spot_size,
        dark_spot_y + dark_spot_size
    ],
    fill=(0, 0, 0, 60)
)
spot = spot.filter(ImageFilter.GaussianBlur(radius=40))
img = Image.alpha_composite(img.convert('RGBA'), spot).convert('RGB')

# SOFT ERROR 3: Ungleichmäßiger Hintergrund - rechte Seite etwas dunkler
draw = ImageDraw.Draw(img)
for i in range(WIDTH // 2, WIDTH):
    darkness = int((i - WIDTH // 2) / (WIDTH // 2) * 30)  # 0-30
    draw.line([(i, 0), (i, HEIGHT)], fill=(240 - darkness, 240 - darkness, 240 - darkness))

# Augen (einfache Punkte)
eye_y = face_y + int(face_height * 0.35)
eye_spacing = int(face_width * 0.3)
eye_center_x = face_x + face_width // 2

draw.ellipse(
    [
        eye_center_x - eye_spacing - 20,
        eye_y - 15,
        eye_center_x - eye_spacing + 20,
        eye_y + 15
    ],
    fill=(50, 50, 50)
)

draw.ellipse(
    [
        eye_center_x + eye_spacing - 20,
        eye_y - 15,
        eye_center_x + eye_spacing + 20,
        eye_y + 15
    ],
    fill=(50, 50, 50)
)

# Mund (Linie)
mouth_y = face_y + int(face_height * 0.7)
mouth_width = int(face_width * 0.4)
draw.arc(
    [
        eye_center_x - mouth_width // 2,
        mouth_y - 30,
        eye_center_x + mouth_width // 2,
        mouth_y + 30
    ],
    start=0,
    end=180,
    fill=(100, 100, 100),
    width=3
)

# Speichern als JPEG mit Qualität 85%
output_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(output_dir, 'test-soft-errors-only.jpg')

img.save(output_path, 'JPEG', quality=85, optimize=True)

# File info
file_size = os.path.getsize(output_path)
print(f"✅ Testbild erstellt: {output_path}")
print(f"   Dimensionen: {WIDTH}×{HEIGHT} px (ICAO-konform)")
print(f"   Format: JPEG")
print(f"   Dateigröße: {file_size / 1024:.1f} KB")
print(f"   Seitenverhältnis: {WIDTH/HEIGHT:.3f} (sollte 0.777 sein)")
print("")
print("Expected Validation Result:")
print("  ✅ Hard Errors: 0 (alle technischen Anforderungen erfüllt)")
print("  ❌ Soft Errors: 2-3 (Schatten, ungleichmäßige Beleuchtung)")
print("  → Checkbox cb1 sollte ANGEZEIGT werden!")
