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

## � Usage Guide

### Step 1 · Prepare Training Data

Organize your images into a folder where **each subfolder name is a class label**:

```
dataset/
├── cat/
│   ├── 001.jpg
│   └── 002.jpg
├── dog/
│   ├── 001.jpg
│   └── 002.jpg
└── bird/
    ├── 001.jpg
    └── 002.jpg
```

> **Tip:** Aim for at least 50–100 images per class for reliable results. The more balanced the class sizes, the better.

### Step 2 · Train

1. Open **ice** and select an **Output Directory** in the left sidebar (training artifacts will be saved here).
2. Go to the **Training** tab.
3. Click **Browse** and select your `dataset/` folder. The app will scan subfolders and show class counts.
4. Choose a **Base Model** (e.g. `yolo11n-cls.pt` for fast experimentation, `yolo11x-cls.pt` for higher accuracy).
5. Set **Epochs** (default 100 is a good starting point).
6. Click **Start Training** and monitor the live output log.
7. When training finishes, `best.pt` is auto-filled in the left sidebar under **Training Result**.

### Step 3 · Validate

1. Go to the **Validation** tab.
2. The **Model File** field is pre-filled with `best.pt` from the last training run — or browse to any `.pt` file.
3. Select a **Validation Data Directory** with the same subfolder structure as the training data.
4. Click **Start Validation**. The app reports per-image accuracy, a summary table, and a list of misclassified images.

### Step 4 · Export

1. Go to the **Export** tab.
2. The source model is pre-filled with `best.pt`, or browse to any `.pt` file.
3. Choose a **Target Format** based on your deployment target:

   | Format | Use case |
   |--------|----------|
   | ONNX (`.onnx`) | Cross-platform inference (Python, C++, JS, etc.) |
   | TensorRT (`.engine`) | NVIDIA GPU high-performance inference |
   | CoreML (`.mlpackage`) | Apple platforms (iOS, macOS) |

4. Click **Export Model** and wait for the output log to confirm success.

### Step 5 · Integrate the Exported Model

#### ONNX — Python

```python
import onnxruntime as ort
import numpy as np
from PIL import Image

session = ort.InferenceSession("best.onnx")
img = Image.open("test.jpg").resize((224, 224))
x = np.array(img).astype(np.float32).transpose(2, 0, 1)[None] / 255.0
outputs = session.run(None, {"images": x})
class_id = int(np.argmax(outputs[0]))
print("Predicted class index:", class_id)
```

#### CoreML — Swift / Xcode

```swift
import CoreML
import Vision

let model = try! MLModel(contentsOf: Bundle.main.url(forResource: "best", withExtension: "mlpackage")!)
let vnModel = try! VNCoreMLModel(for: model)
let request = VNCoreMLRequest(model: vnModel) { req, _ in
    if let result = req.results?.first as? VNClassificationObservation {
        print("Label: \(result.identifier), confidence: \(result.confidence)")
    }
}
let handler = VNImageRequestHandler(cgImage: cgImage)
try! handler.perform([request])
```

#### ONNX — JavaScript (onnxruntime-web)

```js
import * as ort from "onnxruntime-web";

const session = await ort.InferenceSession.create("best.onnx");
// imageData: Float32Array [1, 3, 224, 224], normalized to [0, 1]
const tensor = new ort.Tensor("float32", imageData, [1, 3, 224, 224]);
const { output } = await session.run({ images: tensor });
const classId = output.data.indexOf(Math.max(...output.data));
console.log("Predicted class index:", classId);
```

#### ONNX — Java (ONNX Runtime)

```java
import ai.onnxruntime.*;
import java.nio.FloatBuffer;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;

OrtEnvironment env = OrtEnvironment.getEnvironment();
OrtSession session = env.createSession("best.onnx");

BufferedImage img = ImageIO.read(new File("test.jpg"));
BufferedImage resized = new BufferedImage(224, 224, BufferedImage.TYPE_INT_RGB);
resized.getGraphics().drawImage(img.getScaledInstance(224, 224, java.awt.Image.SCALE_SMOOTH), 0, 0, null);

float[] data = new float[1 * 3 * 224 * 224];
for (int y = 0; y < 224; y++) {
    for (int x = 0; x < 224; x++) {
        int rgb = resized.getRGB(x, y);
        data[0 * 224 * 224 + y * 224 + x] = ((rgb >> 16) & 0xFF) / 255.0f; // R
        data[1 * 224 * 224 + y * 224 + x] = ((rgb >>  8) & 0xFF) / 255.0f; // G
        data[2 * 224 * 224 + y * 224 + x] = ( rgb        & 0xFF) / 255.0f; // B
    }
}

OnnxTensor tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(data), new long[]{1, 3, 224, 224});
OrtSession.Result result = session.run(java.util.Collections.singletonMap("images", tensor));
float[] scores = (float[]) ((OnnxTensor) result.get(0)).getValue();

int classId = 0;
for (int i = 1; i < scores.length; i++) {
    if (scores[i] > scores[classId]) classId = i;
}
System.out.println("Predicted class index: " + classId);
```

> Add the dependency to your `pom.xml`:
> ```xml
> <dependency>
>   <groupId>com.microsoft.onnxruntime</groupId>
>   <artifactId>onnxruntime</artifactId>
>   <version>1.20.0</version>
> </dependency>
> ```

#### ONNX — Go (onnxruntime-go)

```go
package main

import (
	"fmt"
	"image"
	_ "image/jpeg"
	"os"

	ort "github.com/yalue/onnxruntime_go"
)

func main() {
	ort.InitializeEnvironment()
	defer ort.DestroyEnvironment()

	session, _ := ort.NewSession[float32](
		"best.onnx",
		[]string{"images"},
		[]string{"output"},
		[]*ort.Shape{ort.NewShape(1, 3, 224, 224)},
		[]*ort.Shape{nil},
	)
	defer session.Destroy()

	f, _ := os.Open("test.jpg")
	img, _, _ := image.Decode(f)
	f.Close()

	// Resize to 224x224 and normalize to [0,1] CHW
	const W, H = 224, 224
	pixels := make([]float32, 3*H*W)
	for y := 0; y < H; y++ {
		for x := 0; x < W; x++ {
			r, g, b, _ := img.At(x*img.Bounds().Dx()/W, y*img.Bounds().Dy()/H).RGBA()
			pixels[0*H*W+y*W+x] = float32(r>>8) / 255.0
			pixels[1*H*W+y*W+x] = float32(g>>8) / 255.0
			pixels[2*H*W+y*W+x] = float32(b>>8) / 255.0
		}
	}

	input, _ := ort.NewTensor(ort.NewShape(1, 3, H, W), pixels)
	defer input.Destroy()

	outputs, _ := session.Run([]*ort.Tensor[float32]{input})
	scores := outputs[0].GetData()

	classId, best := 0, scores[0]
	for i, v := range scores {
		if v > best {
			best, classId = v, i
		}
	}
	fmt.Println("Predicted class index:", classId)
}
```

> ```bash
> go get github.com/yalue/onnxruntime_go
> ```

---

## � Project Structure

- `/src` — React frontend pages and UI components.
- `/src-tauri` — Rust backend and Tauri configuration.
- `/src-tauri/src/lib.rs` — YOLO CLI bindings and system event communication.

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshot1.png" alt="Training" width="720" />
</p>
<p align="center">
  <img src="docs/screenshot2.png" alt="Validation" width="720" />
</p>
<p align="center">
  <img src="docs/screenshot3.png" alt="Inference" width="720" />
</p>
