# Local, WebGL-independent hand recognition

TensorFlow.js 4.22.0, WASM backend 4.22.0, and hand-pose-detection 2.0.1.
Upstream: https://github.com/tensorflow/tfjs and https://github.com/tensorflow/tfjs-models/tree/master/hand-pose-detection
JavaScript and WASM files obtained from their versioned npm distributions through jsDelivr.
Apache-2.0 license: ../LICENSE-APACHE-2.0.txt. Original notices remain in the source files.

MediaPipe Hands lite TFJS models (Google/MediaPipe, Apache-2.0):
- https://tfhub.dev/mediapipe/tfjs-model/handpose_3d/detector/lite/1
- https://tfhub.dev/mediapipe/tfjs-model/handpose_3d/landmark/lite/1
Downloaded model.json and their weightsManifest shards with ?tfjs-format=file.

All assets are served locally. Camera frames are transferred only to a local
Web Worker for WASM/CPU inference; no camera images or landmarks are uploaded.
