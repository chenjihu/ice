import { useState, useEffect, useMemo, useRef, forwardRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderUp, Activity, Download, ScanSearch, Play, AlertCircle, CheckCircle2, FolderOpen, ImageIcon, Layers, Settings } from "lucide-react";
import { AnsiUp } from "ansi-up";
import "./App.css";

const ansiUp = new AnsiUp();
ansiUp.useClasses = false;

const AnsiLog = forwardRef<HTMLDivElement, { text: string; className?: string }>(
  ({ text, className }, ref) => {
    const html = useMemo(() => ansiUp.ansi_to_html(text), [text]);
    return (
      <div
        ref={ref}
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
);

const MODEL_GROUPS = [
  { label: "YOLO26", models: [
    { value: "yolo26n-cls.pt", label: "YOLO26 Nano" },
    { value: "yolo26s-cls.pt", label: "YOLO26 Small" },
    { value: "yolo26m-cls.pt", label: "YOLO26 Medium" },
    { value: "yolo26l-cls.pt", label: "YOLO26 Large" },
    { value: "yolo26x-cls.pt", label: "YOLO26 XLarge" },
  ]},
  { label: "YOLO11", models: [
    { value: "yolo11n-cls.pt", label: "YOLO11 Nano" },
    { value: "yolo11s-cls.pt", label: "YOLO11 Small" },
    { value: "yolo11m-cls.pt", label: "YOLO11 Medium" },
    { value: "yolo11l-cls.pt", label: "YOLO11 Large" },
    { value: "yolo11x-cls.pt", label: "YOLO11 XLarge" },
  ]},
  { label: "YOLOv8", models: [
    { value: "yolov8n-cls.pt", label: "YOLOv8 Nano" },
    { value: "yolov8s-cls.pt", label: "YOLOv8 Small" },
    { value: "yolov8m-cls.pt", label: "YOLOv8 Medium" },
    { value: "yolov8l-cls.pt", label: "YOLOv8 Large" },
    { value: "yolov8x-cls.pt", label: "YOLOv8 XLarge" },
  ]},
];

function ModelPicker({ value, onChange, localModels }: {
  value: string;
  onChange: (v: string) => void;
  localModels: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLabel = MODEL_GROUPS.flatMap(g => g.models).find(m => m.value === value)?.label ?? value;
  const isLocal = localModels.includes(value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-blue-500 hover:border-neutral-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          {isLocal && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />}
          {selectedLabel}
          <span className="text-neutral-600 text-xs font-mono">{value}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {isLocal && <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded-full">本地</span>}
          <span className="text-neutral-500">▾</span>
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {MODEL_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-neutral-500 uppercase tracking-wider">{group.label}</p>
              {group.models.map(m => {
                const local = localModels.includes(m.value);
                const selected = m.value === value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => { onChange(m.value); setOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left
                      ${selected ? "bg-blue-600/20 text-white" : "hover:bg-neutral-800 text-neutral-300"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${local ? "bg-green-400" : "bg-neutral-700"}`} />
                      {m.label}
                      <span className="text-neutral-600 text-xs font-mono">{m.value}</span>
                    </span>
                    {local && (
                      <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded-full shrink-0">本地</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyBundledModelButton({ modelDir }: { modelDir: string }) {
  const [status, setStatus] = useState<"idle" | "copying" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const copy = async () => {
    setStatus("copying");
    setMsg("");
    try {
      const dest = await invoke<string>("copy_bundled_model", { destDir: modelDir });
      setStatus("done");
      setMsg(dest);
    } catch (e: any) {
      setStatus("error");
      setMsg(String(e));
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={copy}
        disabled={status === "copying"}
        className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-50"
      >
        <Download size={13} />
        {status === "copying" ? "复制中..." : "复制内置 yolo26n-cls.pt 到此目录"}
      </button>
      {status === "done" && (
        <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={11} /> 已复制：{msg}</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {msg}</p>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("train");
  const [yoloVersion, setYoloVersion] = useState<string | null | undefined>(undefined);

  // Settings — persisted in localStorage
  const [proxy, setProxy] = useState(() => localStorage.getItem("isee_proxy") ?? "");
  const [modelDir, setModelDir] = useState(() => localStorage.getItem("isee_model_dir") ?? "");

  useEffect(() => { localStorage.setItem("isee_proxy", proxy); }, [proxy]);
  useEffect(() => { localStorage.setItem("isee_model_dir", modelDir); }, [modelDir]);

  // Local models available in modelDir
  const [localModels, setLocalModels] = useState<string[]>([]);
  useEffect(() => {
    invoke<string[]>("list_local_models", { modelDir })
      .then(setLocalModels)
      .catch(() => setLocalModels([]));
  }, [modelDir]);

  useEffect(() => {
    invoke<string | null>("check_yolo_installed")
      .then(setYoloVersion)
      .catch(console.error);
  }, []);

  // Train State
  const [trainData, setTrainData] = useState("");
  const [epochs, setEpochs] = useState("10");
  const [baseModel, setBaseModel] = useState("yolo26n-cls.pt");
  const [projectDir, setProjectDir] = useState("");
  const [trainLog, setTrainLog] = useState("");
  const [trainOutputPath, setTrainOutputPath] = useState("");
  const [isTraining, setIsTraining] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  type ClassInfo = { name: string; count: number };
  type DatasetInfo = { classes: ClassInfo[]; total: number };
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);

  // Validate State
  const [valModel, setValModel] = useState("");
  const [valData, setValData] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  type ValMismatch = { image_path: string; expected: string; predicted: string; confidence: number };
  type ValReport = { total: number; correct: number; mismatches: ValMismatch[] };
  const [valReport, setValReport] = useState<ValReport | null>(null);
  const [valError, setValError] = useState("");
  const [valLog, setValLog] = useState("");
  const valLogRef = useRef<HTMLDivElement>(null);

  // Export State
  const [exportModel, setExportModel] = useState("");
  const [exportFormat, setExportFormat] = useState("onnx");
  const [exportLog, setExportLog] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Predict State
  const [predictModel, setPredictModel] = useState("");
  const [predictSource, setPredictSource] = useState("");
  const [isPredicting, setIsPredicting] = useState(false);
  type PredictResult = { image_path: string; label: string; confidence: number };
  const [predictResults, setPredictResults] = useState<PredictResult[]>([]);
  const [predictError, setPredictError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const selectFolder = async (setter: (val: string) => void) => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setter(selected);
    } else if (selected && Array.isArray(selected) && selected.length > 0) {
      setter(selected[0]);
    }
  };

  const selectFile = async (setter: (val: string) => void, filterTitle?: string, filterExts?: string[]) => {
    const filters = filterExts ? [{ name: filterTitle || "Files", extensions: filterExts }] : undefined;
    const selected = await open({
      multiple: false,
      filters,
    });
    if (selected && typeof selected === "string") {
      setter(selected);
    } else if (selected && Array.isArray(selected) && selected.length > 0) {
      setter(selected[0]);
    }
  };

  const selectTrainData = async () => {
    const selected = await open({ directory: true, multiple: false });
    const path = typeof selected === "string" ? selected : Array.isArray(selected) ? selected[0] : null;
    if (!path) return;
    setTrainData(path);
    setDatasetInfo(null);
    try {
      const info = await invoke<DatasetInfo>("scan_data_folder", { dataFolder: path });
      setDatasetInfo(info);
    } catch (e) {
      console.error("scan failed", e);
    }
  };

  const runTrain = async () => {
    if (!trainData) return alert("Select data folder");
    if (!projectDir) return alert("请先在左侧选择输出目录");
    setIsTraining(true);
    setTrainLog("");
    setTrainOutputPath("");

    const unlistenLog = await listen<string>("train_log", (e) => {
      const line = e.payload;
      setTrainLog(prev => prev + line + "\n");
      // Auto-scroll
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });

    const unlistenDone = await listen<string>("train_done", (e) => {
      const outputPath = e.payload;
      setTrainOutputPath(outputPath);
      setValModel(`${outputPath}/weights/best.pt`);
      setExportModel(`${outputPath}/weights/best.pt`);
      setIsTraining(false);
      unlistenLog();
      unlistenDone();
    });

    try {
      await invoke("run_yolo_train", {
        dataFolder: trainData,
        epochs: parseInt(epochs),
        baseModel,
        projectDir,
        proxy,
        modelDir,
      });
    } catch (e: any) {
      setTrainLog(prev => prev + "\nError: " + e);
      setIsTraining(false);
      unlistenLog();
      unlistenDone();
    }
  };

  const runVal = async () => {
    if (!valModel || !valData) return alert("Select model and validation data");
    setIsValidating(true);
    setValReport(null);
    setValError("");
    setValLog("");
    const unlisten = await listen<string>("val_log", (e) => {
      setValLog(prev => prev + e.payload + "\n");
      if (valLogRef.current) valLogRef.current.scrollTop = valLogRef.current.scrollHeight;
    });
    try {
      const report = await invoke<ValReport>("run_classify_val", { modelPath: valModel, dataFolder: valData, proxy });
      setValReport(report);
    } catch (e: any) {
      setValError(String(e));
    } finally {
      setIsValidating(false);
      unlisten();
    }
  };

  const runExport = async () => {
    if (!exportModel) return alert("Select model");
    setIsExporting(true);
    setExportLog(`Exporting to ${exportFormat}...`);
    try {
      const res: string = await invoke("run_yolo_export", { modelPath: exportModel, format: exportFormat, proxy });
      setExportLog(res);
    } catch (e: any) {
      setExportLog("Error: " + e);
    } finally {
      setIsExporting(false);
    }
  };

  const runPredict = async () => {
    if (!predictModel || !predictSource) return alert("Select model and source");
    setIsPredicting(true);
    setPredictResults([]);
    setPredictError("");
    try {
      const results = await invoke<PredictResult[]>("run_yolo_predict", { modelPath: predictModel, sourcePath: predictSource, proxy });
      setPredictResults(results);
    } catch (e: any) {
      setPredictError(String(e));
    } finally {
      setIsPredicting(false);
    }
  };

  const bestPtPath = trainOutputPath ? `${trainOutputPath}/weights/best.pt` : "";

  // Auto-fill predict model when training completes
  useEffect(() => {
    if (bestPtPath) setPredictModel(bestPtPath);
  }, [bestPtPath]);

  return (
    <div className="flex h-screen w-screen bg-neutral-900 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-neutral-950 flex flex-col border-r border-neutral-800 shrink-0">

        {/* Logo */}
        <div className="p-5 pb-4 border-b border-neutral-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
            <ScanSearch size={20} className="text-blue-500 shrink-0" />
            ice
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">Image Classification Tool</p>
        </div>

        {/* Nav */}
        <div className="p-3 flex flex-col gap-1">
          <p className="text-xs text-neutral-600 font-semibold uppercase tracking-wider px-2 mb-1">功能</p>
          {([
            { id: "train", icon: <FolderUp size={16} />, label: "Training" },
            { id: "val",   icon: <Activity size={16} />, label: "Validation" },
            { id: "export",icon: <Download size={16} />, label: "Export" },
            { id: "predict",icon: <ScanSearch size={16} />, label: "Inference" },
            { id: "settings", icon: <Settings size={16} />, label: "Settings" },
          ] as const).map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === id ? "bg-blue-600 text-white" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Project Workspace — 独立持久面板 */}
        <div className="mt-auto border-t border-neutral-800 p-3 flex flex-col gap-2">
          <p className="text-xs text-neutral-600 font-semibold uppercase tracking-wider px-1 mb-1">项目工作区</p>

          {/* Output folder */}
          <div className="bg-neutral-900 rounded-lg p-2.5 border border-neutral-800">
            <p className="text-xs text-neutral-500 mb-1">训练输出目录</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-300 truncate flex-1 font-mono">
                {projectDir || <span className="text-neutral-600 italic">未选择</span>}
              </span>
              <button
                onClick={() => selectFolder(setProjectDir)}
                title="选择训练输出目录"
                className="shrink-0 text-neutral-500 hover:text-blue-400 transition-colors"
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          {/* Training result */}
          <div className={`rounded-lg p-2.5 border transition-colors ${trainOutputPath ? "bg-blue-500/10 border-blue-500/30" : "bg-neutral-900 border-neutral-800"}`}>
            <p className="text-xs text-neutral-500 mb-1">训练结果</p>
            {trainOutputPath ? (
              <>
                <p className="text-xs text-blue-300 font-mono truncate">{bestPtPath}</p>
                <button
                  onClick={() => invoke("open_folder", { path: trainOutputPath })}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-md transition-colors"
                >
                  <FolderOpen size={12} /> 打开结果文件夹
                </button>
              </>
            ) : (
              <p className="text-xs text-neutral-600 italic">训练完成后自动显示</p>
            )}
          </div>

          {/* Env status */}
          <div className="px-1 mt-1 space-y-1">
            {yoloVersion === null && (
              <div className="flex items-center gap-1.5 text-red-400">
                <AlertCircle size={12} className="shrink-0" />
                <span className="text-xs">未安装 Ultralytics</span>
              </div>
            )}
            {typeof yoloVersion === "string" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Ultralytics</span>
                  <span className="text-xs text-green-400 font-mono">{yoloVersion}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">模型架构</span>
                  <span className="text-xs text-blue-400 font-mono">
                    {baseModel.startsWith("yolo26") ? "YOLO26" : baseModel.startsWith("yolo11") ? "YOLO11" : "YOLOv8"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {yoloVersion === null && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <AlertCircle className="shrink-0" />
            <div>
              <p className="font-semibold text-sm">未检测到 Ultralytics (YOLO) 命令行工具</p>
              <p className="text-xs mt-1">请确保系统已安装 Python，并在终端中运行 <code className="bg-red-500/20 px-1 py-0.5 rounded">pip install ultralytics</code>。安装成功后请重启本应用。</p>
            </div>
          </div>
        )}

        {activeTab === "train" && (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-bold">Training</h2>

            {/* ── Step 1: Data ── */}
            <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-800 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1 · 训练数据</p>
              <div className="flex gap-2">
                <input readOnly value={trainData} placeholder="选择包含分类子文件夹的图片目录" className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-blue-500" />
                <button onClick={selectTrainData} className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-sm transition-colors shrink-0">Browse</button>
              </div>

              {/* Dataset stats */}
              {datasetInfo && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      <Layers size={14} className="text-blue-400" />
                      <span className="font-semibold text-white">{datasetInfo.classes.length}</span> 种类
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      <ImageIcon size={14} className="text-blue-400" />
                      <span className="font-semibold text-white">{datasetInfo.total}</span> 张图片
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {datasetInfo.classes.map((cls) => (
                      <div key={cls.name} className="flex items-center gap-2 bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-800">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-neutral-200 truncate">{cls.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-neutral-800 rounded-full h-1">
                              <div
                                className="bg-blue-500 h-1 rounded-full"
                                style={{ width: `${Math.round((cls.count / datasetInfo.total) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-500 shrink-0">{cls.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 2: Config ── */}
            <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-800 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2 · 训练配置</p>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Base Model</label>
                <ModelPicker value={baseModel} onChange={setBaseModel} localModels={localModels} />
                {modelDir ? (
                  <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={11} /> 优先从本地加载：<code className="bg-neutral-800 px-1 rounded font-mono">{modelDir}</code>
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500 mt-1.5">首次使用将自动下载权重（需联网），后续缓存至 <code className="bg-neutral-800 px-1 rounded">~/.cache/ultralytics/</code>。可在 Settings 中配置本地模型目录。</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">训练轮次(Epochs)</label>
                <input type="number" min={1} value={epochs} onChange={(e) => setEpochs(e.target.value)} className="w-28 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            {/* ── Step 3: Start ── */}
            <div className="space-y-3">
              {!projectDir && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  请先在左侧"项目工作区"选择 训练输出目录
                </div>
              )}
              <button onClick={runTrain} disabled={isTraining || !projectDir || !trainData} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 py-2.5 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2">
                {isTraining ? <Activity size={16} className="animate-pulse" /> : <Play size={16} />}
                {isTraining ? "训练中…" : "Start Training"}
              </button>
            </div>

            {/* ── Log ── */}
            {(isTraining || trainLog) && (
              <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Output Log</p>
                <AnsiLog
                  text={trainLog}
                  className="bg-neutral-950 p-3 rounded-lg font-mono text-xs h-56 overflow-y-auto whitespace-pre-wrap border border-neutral-800"
                  ref={logRef}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "val" && (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-bold">Validation</h2>
            <p className="text-sm text-neutral-400">选择训练好的模型和带分类子文件夹的数据目录，逐张验证分类是否正确。</p>

            <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-800 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">模型文件 (.pt)</label>
                <div className="flex gap-2">
                  <input readOnly value={valModel} placeholder="选择模型文件" className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none" />
                  <button onClick={() => selectFile(setValModel, "Model", ["pt","onnx"])} className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-sm transition-colors shrink-0">Browse</button>
                </div>
                {bestPtPath && valModel === bestPtPath && (
                  <p className="text-xs text-blue-400 mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> 已复用左侧训练结果 best.pt</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">验证数据目录</label>
                <p className="text-xs text-neutral-600 mb-2">目录结构：每个子文件夹名称 = 类别名，文件夹内为该类别图片</p>
                <div className="flex gap-2">
                  <input readOnly value={valData} placeholder="选择包含分类子文件夹的目录" className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none" />
                  <button onClick={() => selectFolder(setValData)} className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-sm transition-colors shrink-0">Browse</button>
                </div>
              </div>

              <button onClick={runVal} disabled={isValidating || !valModel || !valData} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 py-2.5 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2">
                {isValidating ? <Activity size={16} className="animate-pulse" /> : <Play size={16} />}
                {isValidating ? "验证中..." : "开始验证"}
              </button>
            </div>

            {/* Live log */}
            {(isValidating || valLog) && (
              <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">验证进度</p>
                <div
                  ref={valLogRef}
                  className="bg-neutral-950 p-3 rounded-lg font-mono text-xs h-48 overflow-y-auto whitespace-pre-wrap border border-neutral-800 text-neutral-300"
                >{valLog}</div>
              </div>
            )}

            {/* Error */}
            {valError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap text-xs">{valError}</pre>
              </div>
            )}

            {/* Report */}
            {valReport && (
              <div className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 p-4 text-center">
                    <p className="text-2xl font-bold text-white">{valReport.total}</p>
                    <p className="text-xs text-neutral-500 mt-1">总图片数</p>
                  </div>
                  <div className="bg-green-500/10 rounded-xl border border-green-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{valReport.correct}</p>
                    <p className="text-xs text-neutral-500 mt-1">分类正确</p>
                  </div>
                  <div className={`rounded-xl border p-4 text-center ${valReport.mismatches.length > 0 ? "bg-red-500/10 border-red-500/30" : "bg-neutral-800/50 border-neutral-800"}`}>
                    <p className={`text-2xl font-bold ${valReport.mismatches.length > 0 ? "text-red-400" : "text-neutral-400"}`}>{valReport.mismatches.length}</p>
                    <p className="text-xs text-neutral-500 mt-1">分类错误</p>
                  </div>
                </div>

                {/* Accuracy bar */}
                <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 p-4">
                  <div className="flex justify-between text-xs text-neutral-400 mb-2">
                    <span>准确率</span>
                    <span className="font-mono font-semibold text-white">
                      {valReport.total > 0 ? ((valReport.correct / valReport.total) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-2.5">
                    <div
                      className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: valReport.total > 0 ? `${(valReport.correct / valReport.total) * 100}%` : "0%" }}
                    />
                  </div>
                </div>

                {/* Mismatch table */}
                {valReport.mismatches.length > 0 ? (
                  <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 overflow-hidden">
                    <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-red-400">分类错误列表</p>
                      <p className="text-xs text-neutral-500">{valReport.mismatches.length} 张</p>
                    </div>
                    <div className="overflow-y-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-neutral-900">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium">图片</th>
                            <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium w-28">期望分类</th>
                            <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium w-28">实际预测</th>
                            <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium w-24">置信度</th>
                          </tr>
                        </thead>
                        <tbody>
                          {valReport.mismatches.map((m, i) => (
                            <tr key={i} className="border-t border-neutral-800 hover:bg-neutral-800/50 transition-colors">
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => setPreviewImage(m.image_path)}
                                  className="text-xs text-blue-400 hover:text-blue-300 font-mono text-left truncate max-w-[160px] block underline underline-offset-2"
                                  title={m.image_path}
                                >
                                  {m.image_path.split("/").pop()}
                                </button>
                              </td>
                              <td className="px-4 py-2">
                                <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">{m.expected}</span>
                              </td>
                              <td className="px-4 py-2">
                                <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">{m.predicted}</span>
                              </td>
                              <td className="px-4 py-2 text-xs text-neutral-400 font-mono">{(m.confidence * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    全部分类正确！
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "export" && (
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold mb-6">Export Model</h2>
            <div className="bg-neutral-800/50 p-6 rounded-xl border border-neutral-800 space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Source Model (.pt)</label>
                <div className="flex gap-2">
                  <input readOnly value={exportModel} placeholder="选择 PyTorch 模型文件" className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-blue-500" />
                  <button onClick={() => selectFile(setExportModel, "PyTorch Model", ["pt"])} className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-sm transition-colors shrink-0">Browse</button>
                </div>
                {bestPtPath && exportModel === bestPtPath && (
                  <p className="text-xs text-blue-400 mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> 已复用左侧训练结果 best.pt</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Target Format</label>
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-blue-500">
                  <option value="onnx">ONNX (.onnx)</option>
                  <option value="engine">TensorRT (.engine)</option>
                  <option value="coreml">CoreML (.mlpackage)</option>
                </select>
              </div>

              <button onClick={runExport} disabled={isExporting} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 py-2.5 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2">
                {isExporting ? <Activity size={16} className="animate-pulse" /> : <Download size={16} />}
                {isExporting ? "Exporting..." : "Export Model"}
              </button>

              {exportLog && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">Output Log</h3>
                  <AnsiLog text={exportLog} className="bg-neutral-950 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto whitespace-pre-wrap border border-neutral-800" />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "predict" && (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-bold">Inference</h2>

            <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-800 space-y-4">
              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Model (.pt / .onnx / .engine / .mlpackage)</label>
                <div className="flex gap-2">
                  <input readOnly value={predictModel} placeholder="选择模型文件" className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none" />
                  <button onClick={() => selectFile(setPredictModel)} className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-sm transition-colors shrink-0">Browse</button>
                </div>
                {bestPtPath && predictModel === bestPtPath && (
                  <p className="text-xs text-blue-400 mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> 已复用左侧训练结果 best.pt</p>
                )}
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Target Image or Folder</label>
                <div className="flex gap-2">
                  <input readOnly value={predictSource} placeholder="选择单张图片或整个文件夹" className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none" />
                  <button onClick={() => selectFile(setPredictSource, "Images", ["jpg","jpeg","png","bmp","webp"])} className="bg-neutral-700 hover:bg-neutral-600 px-3 py-2 rounded-lg text-sm transition-colors shrink-0">单张图片</button>
                  <button onClick={() => selectFolder(setPredictSource)} className="bg-neutral-700 hover:bg-neutral-600 px-3 py-2 rounded-lg text-sm transition-colors shrink-0">文件夹</button>
                </div>
              </div>

              <button onClick={runPredict} disabled={isPredicting || !predictModel || !predictSource} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 py-2.5 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2">
                {isPredicting ? <Activity size={16} className="animate-pulse" /> : <Play size={16} />}
                {isPredicting ? "识别中..." : "Run Inference"}
              </button>
            </div>

            {/* Error */}
            {predictError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap text-xs">{predictError}</pre>
              </div>
            )}

            {/* Single image result */}
            {!predictError && predictResults.length === 1 && (
              <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 overflow-hidden">
                <div className="flex gap-4 p-5">
                  <button
                    onClick={() => setPreviewImage(predictResults[0].image_path)}
                    className="shrink-0 w-28 h-28 rounded-lg overflow-hidden border border-neutral-700 hover:border-blue-500 transition-colors bg-neutral-900 flex items-center justify-center"
                  >
                    <img
                      src={convertFileSrc(predictResults[0].image_path)}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </button>
                  <div className="flex flex-col justify-center gap-2">
                    <p className="text-xs text-neutral-500 font-mono truncate max-w-xs">{predictResults[0].image_path}</p>
                    <p className="text-3xl font-bold text-white">{predictResults[0].label}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-neutral-800 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(predictResults[0].confidence * 100).toFixed(0)}%` }} />
                      </div>
                      <span className="text-sm text-blue-300 font-mono">{(predictResults[0].confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Folder results table */}
            {!predictError && predictResults.length > 1 && (
              <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">推理结果</p>
                  <p className="text-xs text-neutral-500">{predictResults.length} 张图片</p>
                </div>
                <div className="overflow-y-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-neutral-900">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium">图片路径</th>
                        <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium w-32">分类</th>
                        <th className="text-left px-4 py-2 text-xs text-neutral-500 font-medium w-28">置信度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictResults.map((r, i) => (
                        <tr key={i} className="border-t border-neutral-800 hover:bg-neutral-800/50 transition-colors">
                          <td className="px-4 py-2 text-xs text-neutral-600">{i + 1}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => setPreviewImage(r.image_path)}
                              className="text-xs text-blue-400 hover:text-blue-300 font-mono text-left truncate max-w-xs block underline underline-offset-2"
                              title={r.image_path}
                            >
                              {r.image_path.split("/").pop()}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-white">{r.label}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-neutral-800 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(r.confidence * 100).toFixed(0)}%` }} />
                              </div>
                              <span className="text-xs text-neutral-400 font-mono">{(r.confidence * 100).toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-2xl font-bold">Settings</h2>

            {/* Proxy */}
            <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-0.5">网络代理</h3>
                <p className="text-xs text-neutral-500">用于下载模型权重文件。留空则不使用代理。</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">HTTP / HTTPS 代理地址</label>
                <input
                  type="text"
                  value={proxy}
                  onChange={e => setProxy(e.target.value)}
                  placeholder="例如 http://127.0.0.1:7890"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-blue-500 font-mono"
                />
                {proxy && (
                  <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={11} /> 已启用代理：{proxy}
                  </p>
                )}
              </div>
              {proxy && (
                <button
                  onClick={() => setProxy("")}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  清除代理
                </button>
              )}
            </div>

            {/* Model directory */}
            <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-0.5">本地模型文件夹</h3>
                <p className="text-xs text-neutral-500">训练时优先从此文件夹中查找基础模型（如 yolo11n-cls.pt），找不到才去联网下载。</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">模型文件夹路径</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={modelDir}
                    placeholder="选择存放 .pt 文件的文件夹"
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => selectFolder(setModelDir)}
                    className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-sm transition-colors shrink-0"
                  >Browse</button>
                </div>
                {modelDir && (
                  <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={11} /> 已设置：{modelDir}
                  </p>
                )}
              </div>

              {/* Copy bundled model */}
              {modelDir && (
                <CopyBundledModelButton modelDir={modelDir} />
              )}

              {modelDir && (
                <button
                  onClick={() => setModelDir("")}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  清除路径
                </button>
              )}
            </div>

            {/* Status summary */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">当前配置</p>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">代理</span>
                <span className={`font-mono ${proxy ? "text-green-400" : "text-neutral-600"}`}>{proxy || "未设置"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">本地模型目录</span>
                <span className={`font-mono truncate max-w-[200px] text-right ${modelDir ? "text-green-400" : "text-neutral-600"}`}>{modelDir || "未设置"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Image preview modal */}
        {previewImage && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-3xl max-h-full" onClick={e => e.stopPropagation()}>
              <img
                src={convertFileSrc(previewImage)}
                alt="preview"
                className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl"
              />
              <p className="text-xs text-neutral-400 mt-2 font-mono text-center truncate">{previewImage}</p>
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 bg-neutral-800 hover:bg-neutral-700 rounded-full w-8 h-8 flex items-center justify-center text-neutral-300 transition-colors"
              >✕</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
