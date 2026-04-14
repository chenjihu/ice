<p align="center">
  <img src="src-tauri/icons/app-icon.png" width="128" alt="ice icon" />
</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-CN.md">中文</a>
</p>

# ice - Image Classification Engine

**ice** (Image Classification Engine) is a cross-platform desktop application built with Tauri 2.0 and YOLO v26, designed to simplify the full lifecycle of image classification — from training to inference.

## 🌟 Features

1. **Training** — Upload an image folder organized by class name (subfolder names are used as labels), configure epochs and other parameters, then start training with one click.
2. **Validation** — Select a validation dataset and an existing or newly trained model to evaluate classification metrics.
3. **Export** — Export trained `.pt` models to industry-standard formats:
   - ONNX (`.onnx`)
   - TensorRT (`.engine`)
   - CoreML (`.mlpackage`)
4. **Inference** — Import exported ONNX, TensorRT, or CoreML models and run batch classification on a single image or an entire folder.

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons + Vite
- **Desktop Framework**: Tauri 2.0 (Rust-powered native capabilities: file system access, subprocess management)
- **ML Backend**: YOLO CLI (`ultralytics` package)

## 🚀 Getting Started

### Prerequisites

1. **Node.js** >= 20
2. **Rust** toolchain ([rustup](https://rustup.rs))
3. **YOLO CLI** via Python:
   ```bash
   pip install ultralytics
   ```

### Development

```bash
# Install dependencies
npm install

# Start the desktop dev server
npm run tauri dev
```

### Build

To package the app as a standalone installer for macOS / Windows / Linux:

```bash
npm run tauri build
```

## 📂 Project Structure

- `/src` — React frontend pages and UI components.
- `/src-tauri` — Rust backend and Tauri configuration.
- `/src-tauri/src/lib.rs` — YOLO CLI bindings and system event communication.
