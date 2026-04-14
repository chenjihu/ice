<p align="center">
  <img src="src-tauri/icons/app-icon.png" width="128" alt="ice icon" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>中文</strong>
</p>

# ice - Image Classification Engine

**ice**（Image Classification Engine）是一款基于 Tauri 2.0 框架和 Yolo26 模型的跨平台桌面级图片分类工具。该工具提供轻量化且美观的用户界面，简化了图片分类模型的训练、验证、导出和部署流程。

## 🌟 核心功能

1. **分类训练 (Training)**：支持用户上传带分类名称（子文件夹名即为分类标签）的图片文件夹，设置 Epoch 等参数，一键开始模型训练。
2. **模型验证 (Validation)**：支持选择验证集文件夹以及预训练/新训练的模型进行指标验证。
3. **格式导出 (Export)**：支持将训练后的模型 (.pt) 导出为业界通用的多种格式，如：
   - ONNX (`.onnx`)
   - TensorRT (`.engine`)
   - CoreML (`.mlpackage`)
4. **分类推理 (Inference)**：支持导入导出的 ONNX、TensorRT、CoreML 等模型，并上传单张图片或多张图片的文件夹进行批量分类推理。

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons + Vite
- **客户端框架**：Tauri 2.0 (采用 Rust 驱动底层操作系统级能力，如原生文件系统选取及子进程调用)
- **底层推理/训练框架**：YOLO CLI (`ultralytics` 包)

## 🚀 启动与使用指南

### 环境准备

1. 请确保系统已安装 **Node.js** (推荐 >= 20)。
2. 请确保系统已安装 **Rust** 及其编译工具链。
3. 请确保系统已经通过 Python 安装了对应的 `yolo` (Ultralytics) 命令行工具，并且在环境变量 `PATH` 中：
   ```bash
   pip install ultralytics
   ```

### 运行开发服务器

在项目根目录下运行：

```bash
# 安装依赖
npm install

# 启动桌面开发版
npm run tauri dev
```

### 构建安装包

如需将其打包为独立的 macOS / Windows / Linux 应用程序：

```bash
npm run tauri build
```

## � 使用指南

### 第一步 · 准备训练数据

将图片整理到一个文件夹中，**每个子文件夹的名称即为分类标签**：

```
dataset/
├── cat/          ← 类别名
│   ├── 001.jpg
│   └── 002.jpg
├── dog/
│   ├── 001.jpg
│   └── 002.jpg
└── bird/
    ├── 001.jpg
    └── 002.jpg
```

> **建议：** 每个类别至少准备 50–100 张图片，且各类别数量尽量均衡，可显著提升模型准确率。

### 第二步 · 训练模型

1. 打开 **ice**，在左侧边栏选择 **训练输出目录**（训练产物将保存到此处）。
2. 切换到 **训练** 标签页。
3. 点击 **浏览** 选择 `dataset/` 文件夹，应用会自动扫描子文件夹并展示各类别图片数量。
4. 选择 **基础模型**（例如 `yolo11n-cls.pt` 适合快速验证，`yolo11x-cls.pt` 精度更高）。
5. 设置 **训练轮次 (Epochs)**，默认 100 轮是一个不错的起点。
6. 点击 **开始训练**，实时查看输出日志。
7. 训练完成后，左侧 **训练结果** 区域会自动填入 `best.pt` 路径。

### 第三步 · 验证模型

1. 切换到 **验证** 标签页。
2. **模型文件** 字段会自动复用上次训练的 `best.pt`，也可手动选择其他 `.pt` 文件。
3. 选择 **验证数据目录**（目录结构与训练数据相同）。
4. 点击 **开始验证**，应用将逐张验证并给出准确率统计及分类错误列表。

### 第四步 · 导出模型

1. 切换到 **导出** 标签页。
2. 源模型默认填充为 `best.pt`，也可手动选择其他 `.pt` 文件。
3. 根据部署目标选择 **目标格式**：

   | 格式 | 适用场景 |
   |------|----------|
   | ONNX (`.onnx`) | 跨平台推理（Python、C++、JavaScript 等） |
   | TensorRT (`.engine`) | NVIDIA GPU 高性能推理 |
   | CoreML (`.mlpackage`) | Apple 平台（iOS、macOS） |

4. 点击 **导出模型**，等待日志输出成功提示。

### 第五步 · 在项目中集成导出模型

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
print("预测类别索引:", class_id)
```

#### CoreML — Swift / Xcode

```swift
import CoreML
import Vision

let model = try! MLModel(contentsOf: Bundle.main.url(forResource: "best", withExtension: "mlpackage")!)
let vnModel = try! VNCoreMLModel(for: model)
let request = VNCoreMLRequest(model: vnModel) { req, _ in
    if let result = req.results?.first as? VNClassificationObservation {
        print("标签: \(result.identifier)，置信度: \(result.confidence)")
    }
}
let handler = VNImageRequestHandler(cgImage: cgImage)
try! handler.perform([request])
```

#### ONNX — JavaScript (onnxruntime-web)

```js
import * as ort from "onnxruntime-web";

const session = await ort.InferenceSession.create("best.onnx");
// imageData: Float32Array [1, 3, 224, 224]，像素值归一化到 [0, 1]
const tensor = new ort.Tensor("float32", imageData, [1, 3, 224, 224]);
const { output } = await session.run({ images: tensor });
const classId = output.data.indexOf(Math.max(...output.data));
console.log("预测类别索引:", classId);
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
System.out.println("预测类别索引: " + classId);
```

> 在 `pom.xml` 中添加依赖：
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

	// 缩放到 224x224 并归一化为 [0,1] CHW 格式
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
	fmt.Println("预测类别索引:", classId)
}
```

> ```bash
> go get github.com/yalue/onnxruntime_go
> ```

---

## 📂 项目结构

- `/src`：React 前端页面、UI 组件逻辑。
- `/src-tauri`：Rust 后端与 Tauri 核心配置文件。
- `/src-tauri/src/lib.rs`：Yolo CLI 调用绑定、系统事件通讯。

## 📸 软件截图

<p align="center">
  <img src="docs/screenshot1.png" alt="训练" width="720" />
</p>
<p align="center">
  <img src="docs/screenshot2.png" alt="验证" width="720" />
</p>
<p align="center">
  <img src="docs/screenshot3.png" alt="推理" width="720" />
</p>
