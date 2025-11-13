# Face-API Models

This directory should contain the face-api.js models for face detection.

## Download Models

```bash
cd server/node/models

# Download from GitHub
wget https://github.com/vladmandic/face-api/raw/master/model/ssdMobilenetv1-weights_manifest.json
wget https://github.com/vladmandic/face-api/raw/master/model/ssdMobilenetv1-shard1
wget https://github.com/vladmandic/face-api/raw/master/model/ssdMobilenetv1-shard2

wget https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-weights_manifest.json
wget https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-shard1

wget https://github.com/vladmandic/face-api/raw/master/model/face_recognition_model-weights_manifest.json
wget https://github.com/vladmandic/face-api/raw/master/model/face_recognition_model-shard1
wget https://github.com/vladmandic/face-api/raw/master/model/face_recognition_model-shard2

wget https://github.com/vladmandic/face-api/raw/master/model/face_expression_model-weights_manifest.json
wget https://github.com/vladmandic/face-api/raw/master/model/face_expression_model-shard1
```

## Required Models

- `ssdMobilenetv1` - Face detection
- `face_landmark_68_model` - Facial landmarks (eyes, nose, mouth)
- `face_recognition_model` - Face recognition
- `face_expression_model` - Facial expressions

## Model Size

Total size: ~10 MB
