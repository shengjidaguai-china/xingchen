<!-- README_SYNC: source=working-tree; updated=2026-11-10 -->

[简体中文](./README.md) · English

# Xingchen · Celestial Drift

Open your hand and watch the dust lanes of a star atlas separate into layers of orbiting particles. Xingchen is a browser-based artwork you can play with both hands.

**[Try it live](https://shengjidaguai-china.github.io/xingchen/)** · [Star the project](https://github.com/shengjidaguai-china/xingchen) · [Follow the community](https://github.com/shengjidaguai-china)

[![GitHub Stars](https://img.shields.io/github/stars/shengjidaguai-china/xingchen?style=flat-square)](https://github.com/shengjidaguai-china/xingchen/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/shengjidaguai-china/xingchen?style=flat-square)](https://github.com/shengjidaguai-china/xingchen/issues)
[![MIT License](https://img.shields.io/badge/code-MIT-blue?style=flat-square)](./LICENSE)

## Try it in your browser

Open the live site in desktop Chrome or Edge. Scroll or drag the slider to see the atlas dissolve into spinning stardust. Choose from the Orion Nebula M42, the Pinwheel Galaxy M101, and the AI-generated Celestial Bloom.

| To | Gesture |
| --- | --- |
| Move between atlas and stardust | Raise one hand first to assign it as the primary hand. Pinch your thumb and index finger for the atlas, then spread them to release the particles. |
| Visit the next scene | Swipe sideways with the other hand. |
| Write across the sky | Extend only the index finger of your secondary hand, pause briefly, and trace a shape. Meteors follow your finger, and the writing fades. |

Select the camera button and grant permission to see a mirrored 16:9 preview in the lower-right corner. Cyan landmarks identify the primary hand and gold landmarks identify the secondary hand. Swap roles in the preview or hide it while keeping gestures active. The browser processes camera frames and gestures on your device.

## How the atlas turns into stardust

[volume.js](./volume.js) samples colors and positions from the images and gives the particles depth. [app.js](./app.js) uses a shared release field to fade the image and reveal its particles, preserving the colors and the shape of the dust lanes through the transition. The particles settle into layered orbits. Pinching reverses the motion.

[hand-runtime.js](./hand-runtime.js) detects hand landmarks with MediaPipe. The compatibility path runs TensorFlow.js in a local Web Worker via [hand-worker.js](./hand-worker.js), and [canvas-universe.js](./canvas-universe.js) renders the scene when WebGL is unavailable.

## Run locally

You need Python 3 and a browser with camera support. Run the following commands, then open `http://localhost:8767/`.

```bash
git clone https://github.com/shengjidaguai-china/xingchen.git
cd xingchen
python3 -m http.server 8767 --bind 127.0.0.1
```

The [usage guide in Chinese](./使用说明.txt) covers the controls in more detail. If the camera fails to start, check browser permissions and whether another application is using it.

## Credits and participation

The project code uses the [MIT License](./LICENSE). Astronomical images and third-party components retain their respective licenses.

The Orion and Pinwheel scenes use ESA/Hubble observations. Celestial Bloom uses an AI-generated image. The deformations and orbits are artistic interpretations. See [asset credits](./素材来源.txt) for full attribution and third-party licensing.

[Star Xingchen](https://github.com/shengjidaguai-china/xingchen) to save it for later. If you would like to help, try a browser or camera, then [open an issue](https://github.com/shengjidaguai-china/xingchen/issues) with the gesture, what you observed, and steps to reproduce it.
