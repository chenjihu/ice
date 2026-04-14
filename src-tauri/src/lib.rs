use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::fs;
use serde::Serialize;
use tauri::{Emitter, Manager};

fn apply_proxy(cmd: &mut Command, proxy: &str) {
    if !proxy.is_empty() {
        cmd.env("HTTP_PROXY", proxy)
           .env("HTTPS_PROXY", proxy)
           .env("http_proxy", proxy)
           .env("https_proxy", proxy);
    }
    // Fix SSL cert verification on macOS where Python doesn't use system certs.
    // Try common certifi locations across Python versions.
    let cert_candidates = [
        "/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/site-packages/certifi/cacert.pem",
        "/Library/Frameworks/Python.framework/Versions/3.12/lib/python3.12/site-packages/certifi/cacert.pem",
        "/Library/Frameworks/Python.framework/Versions/3.11/lib/python3.11/site-packages/certifi/cacert.pem",
        "/usr/local/lib/python3.13/site-packages/certifi/cacert.pem",
        "/usr/local/lib/python3.12/site-packages/certifi/cacert.pem",
        "/opt/homebrew/lib/python3.13/site-packages/certifi/cacert.pem",
        "/opt/homebrew/lib/python3.12/site-packages/certifi/cacert.pem",
    ];
    for path in &cert_candidates {
        if std::path::Path::new(path).exists() {
            cmd.env("SSL_CERT_FILE", path)
               .env("REQUESTS_CA_BUNDLE", path);
            break;
        }
    }
}

fn find_file_recursive(dir: &std::path::Path, filename: &str) -> Option<std::path::PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else { return None; };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_file_recursive(&path, filename) {
                return Some(found);
            }
        } else if path.file_name().and_then(|n| n.to_str()) == Some(filename) {
            return Some(path);
        }
    }
    None
}

fn resolve_model(base_model: &str, model_dir: &str) -> String {
    if model_dir.is_empty() {
        return base_model.to_string();
    }
    let local = std::path::Path::new(model_dir).join(base_model);
    if local.exists() {
        local.to_string_lossy().to_string()
    } else {
        base_model.to_string()
    }
}

#[derive(Serialize)]
struct ClassInfo {
    name: String,
    count: u32,
}

#[derive(Serialize)]
struct DatasetInfo {
    classes: Vec<ClassInfo>,
    total: u32,
}

#[tauri::command]
fn scan_data_folder(data_folder: String) -> Result<DatasetInfo, String> {
    let path = std::path::Path::new(&data_folder);
    let mut classes: Vec<ClassInfo> = Vec::new();
    let image_exts = ["jpg", "jpeg", "png", "bmp", "webp", "tiff", "gif"];

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
            let count = fs::read_dir(&p)
                .map(|rd| rd.flatten().filter(|e| {
                    e.path().extension()
                        .and_then(|x| x.to_str())
                        .map(|x| image_exts.contains(&x.to_lowercase().as_str()))
                        .unwrap_or(false)
                }).count() as u32)
                .unwrap_or(0);
            if count > 0 {
                classes.push(ClassInfo { name, count });
            }
        }
    }
    classes.sort_by(|a, b| b.count.cmp(&a.count));
    let total = classes.iter().map(|c| c.count).sum();
    Ok(DatasetInfo { classes, total })
}

#[tauri::command]
fn list_local_models(model_dir: String) -> Vec<String> {
    if model_dir.is_empty() { return vec![]; }
    let Ok(entries) = fs::read_dir(&model_dir) else { return vec![]; };
    let mut names: Vec<String> = entries.flatten()
        .filter_map(|e| {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) == Some("pt") {
                p.file_name().map(|n| n.to_string_lossy().to_string())
            } else { None }
        })
        .collect();
    names.sort();
    names
}

#[tauri::command]
async fn check_yolo_installed() -> Option<String> {
    match Command::new("yolo").arg("version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if version.is_empty() {
                Some("Unknown version".to_string())
            } else {
                Some(version)
            }
        },
        _ => None,
    }
}

#[tauri::command]
async fn run_yolo_train(
    app: tauri::AppHandle,
    data_folder: String,
    epochs: u32,
    base_model: String,
    project_dir: String,
    proxy: String,
    model_dir: String,
) -> Result<String, String> {
    let resolved_model = resolve_model(&base_model, &model_dir);
    let output_path = format!("{}/runs/classify/train", project_dir);
    let mut cmd = Command::new("yolo");
    cmd.args(["classify", "train",
            &format!("data={}", data_folder),
            &format!("model={}", resolved_model),
            &format!("epochs={}", epochs),
            &format!("project={}/runs/classify", project_dir),
            "name=train",
            "exist_ok=True",
        ])
        .current_dir(&project_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_proxy(&mut cmd, &proxy);
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_clone = app.clone();

    let stdout_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            let _ = app_clone.emit("train_log", line);
        }
    });

    let app_clone2 = app.clone();
    let stderr_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            let _ = app_clone2.emit("train_log", line);
        }
    });

    let status = child.wait().map_err(|e| e.to_string())?;
    let _ = stdout_handle.join();
    let _ = stderr_handle.join();

    if status.success() {
        // If a model_dir is configured and the model wasn't already loaded from there,
        // copy the downloaded model from ultralytics WEIGHTS_DIR into model_dir.
        if !model_dir.is_empty() {
            let dest = std::path::Path::new(&model_dir).join(&base_model);
            if !dest.exists() {
                // Ask Python for the actual WEIGHTS_DIR (respects user's ultralytics settings)
                // 1) Try ultralytics WEIGHTS_DIR
                let mut src_found: Option<std::path::PathBuf> = None;
                if let Ok(out) = Command::new("python3")
                    .args(["-c", "from ultralytics.utils import WEIGHTS_DIR; print(WEIGHTS_DIR)"])
                    .output()
                {
                    let weights_dir = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    let candidate = std::path::Path::new(&weights_dir).join(&base_model);
                    if candidate.exists() {
                        src_found = Some(candidate);
                    }
                }
                // 2) Fallback: search project_dir recursively for the same filename
                if src_found.is_none() {
                    src_found = find_file_recursive(std::path::Path::new(&project_dir), &base_model);
                }
                if let Some(src) = src_found {
                    let _ = fs::copy(&src, &dest);
                    let _ = app.emit("train_log",
                        format!("模型已复制到本地目录：{}", dest.display()));
                }
            }
        }
        let _ = app.emit("train_done", &output_path);
        Ok(output_path)
    } else {
        Err("Training failed".to_string())
    }
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
struct ValMismatch {
    image_path: String,
    expected: String,
    predicted: String,
    confidence: f32,
}

#[derive(Serialize)]
struct ValReport {
    total: usize,
    correct: usize,
    mismatches: Vec<ValMismatch>,
}

fn predict_single(model_path: &str, image_path: &str, proxy: &str) -> Option<(String, f32)> {
    let mut cmd = Command::new("yolo");
    cmd.args([
        "classify", "predict",
        &format!("model={}", model_path),
        &format!("source={}", image_path),
        "save=False",
        "verbose=True",
    ]);
    apply_proxy(&mut cmd, proxy);
    let output = cmd.output().ok()?;

    let text = String::from_utf8_lossy(&output.stdout).to_string()
        + &String::from_utf8_lossy(&output.stderr).to_string();

    for line in text.lines() {
        let plain: String = {
            let mut out = String::new();
            let mut in_escape = false;
            for ch in line.trim().chars() {
                if ch == '\x1b' { in_escape = true; continue; }
                if in_escape { if ch == 'm' { in_escape = false; } continue; }
                out.push(ch);
            }
            out
        };
        if let Some(rest) = plain.strip_prefix("image ") {
            let parts: Vec<&str> = rest.splitn(3, ' ').collect();
            if parts.len() < 3 { continue; }
            let after_res = parts[2].splitn(2, ' ').nth(1).unwrap_or("").trim();
            let tokens: Vec<&str> = after_res.split_whitespace().collect();
            let mut i = 0;
            while i + 1 < tokens.len() {
                let conf_candidate = tokens[i + 1].trim_end_matches(',');
                if let Ok(confidence) = conf_candidate.parse::<f32>() {
                    let label = tokens[i].trim_end_matches(',').to_string();
                    return Some((label, confidence));
                }
                i += 1;
            }
        }
    }
    None
}

#[tauri::command]
async fn run_classify_val(app: tauri::AppHandle, model_path: String, data_folder: String, proxy: String) -> Result<ValReport, String> {
    use std::fs;

    let image_exts = ["jpg", "jpeg", "png", "bmp", "webp", "tiff"];
    let mut total = 0usize;
    let mut correct = 0usize;
    let mut mismatches: Vec<ValMismatch> = Vec::new();

    let entries = fs::read_dir(&data_folder).map_err(|e| e.to_string())?;
    let mut class_dirs: Vec<(String, std::path::PathBuf)> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let class_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            class_dirs.push((class_name, path));
        }
    }

    if class_dirs.is_empty() {
        return Err("未找到任何子文件夹（每个子文件夹应为一个类别名称）".to_string());
    }

    class_dirs.sort_by(|a, b| a.0.cmp(&b.0));

    // Count total images first for progress display
    let mut all_images: Vec<(String, String)> = Vec::new(); // (class_name, img_path)
    for (class_name, class_path) in &class_dirs {
        let img_entries = fs::read_dir(class_path).map_err(|e| e.to_string())?;
        for img_entry in img_entries.flatten() {
            let img_path = img_entry.path();
            let ext = img_path.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if image_exts.contains(&ext.as_str()) {
                all_images.push((class_name.clone(), img_path.to_string_lossy().to_string()));
            }
        }
    }

    let grand_total = all_images.len();
    let _ = app.emit("val_log", format!("共找到 {} 张图片，开始验证...", grand_total));

    for (class_name, img_str) in &all_images {
        total += 1;
        let filename = std::path::Path::new(img_str)
            .file_name().unwrap_or_default().to_string_lossy().to_string();
        let _ = app.emit("val_log", format!("[{}/{}] {} / {}", total, grand_total, class_name, filename));

        if let Some((predicted, confidence)) = predict_single(&model_path, img_str, &proxy) {
            if predicted == *class_name {
                correct += 1;
            } else {
                let _ = app.emit("val_log", format!("  ✗ 预测为 {} ({:.1}%)", predicted, confidence * 100.0));
                mismatches.push(ValMismatch {
                    image_path: img_str.clone(),
                    expected: class_name.clone(),
                    predicted,
                    confidence,
                });
            }
        }
    }

    let _ = app.emit("val_log", format!("\n完成：{}/{} 正确，准确率 {:.1}%",
        correct, total, if total > 0 { correct as f32 / total as f32 * 100.0 } else { 0.0 }));

    Ok(ValReport { total, correct, mismatches })
}

#[tauri::command]
async fn run_yolo_export(model_path: String, format: String, proxy: String) -> Result<String, String> {
    let mut cmd = Command::new("yolo");
    cmd.args(["export", &format!("model={}", model_path), &format!("format={}", format)]);
    apply_proxy(&mut cmd, &proxy);
    let output = cmd.output().map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[derive(Serialize)]
struct PredictResult {
    image_path: String,
    label: String,
    confidence: f32,
}

#[tauri::command]
async fn run_yolo_predict(model_path: String, source_path: String, proxy: String) -> Result<Vec<PredictResult>, String> {
    let mut cmd = Command::new("yolo");
    cmd.args([
        "classify", "predict",
        &format!("model={}", model_path),
        &format!("source={}", source_path),
        "save=False",
        "verbose=True",
    ]);
    apply_proxy(&mut cmd, &proxy);
    let output = cmd.output().map_err(|e| e.to_string())?;

    let text = String::from_utf8_lossy(&output.stdout).to_string()
        + &String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() && text.trim().is_empty() {
        return Err(text);
    }

    // Parse lines like:
    // "image 1/1 /path/to/img.jpg: 224x224 cat 0.92, dog 0.05, 3.4ms"
    // After splitn(3,' '): parts[0]="1/1", parts[1]="/path/img.jpg:", parts[2]="224x224 cat 0.92, ..."
    let mut results: Vec<PredictResult> = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        // Strip ANSI codes before matching
        let plain: String = {
            let mut out = String::new();
            let mut in_escape = false;
            for ch in trimmed.chars() {
                if ch == '\x1b' { in_escape = true; continue; }
                if in_escape { if ch == 'm' { in_escape = false; } continue; }
                out.push(ch);
            }
            out
        };
        if let Some(rest) = plain.strip_prefix("image ") {
            let parts: Vec<&str> = rest.splitn(3, ' ').collect();
            if parts.len() < 3 { continue; }
            // parts[1] = "/path/img.jpg:" — strip trailing colon
            let image_path = parts[1].trim_end_matches(':').to_string();
            // parts[2] = "224x224 label conf, label conf, ... Xms"
            let after_res = parts[2].splitn(2, ' ').nth(1).unwrap_or("").trim();
            // Split by ", " to get each "label conf" pair, skip last token (speed "Xms")
            // Parse greedily: tokens alternate label conf
            let tokens: Vec<&str> = after_res.split_whitespace().collect();
            // Find first valid (label, float) pair
            let mut i = 0;
            while i + 1 < tokens.len() {
                let conf_candidate = tokens[i + 1].trim_end_matches(',');
                if let Ok(confidence) = conf_candidate.parse::<f32>() {
                    let label = tokens[i].trim_end_matches(',').to_string();
                    results.push(PredictResult { image_path: image_path.clone(), label, confidence });
                    break; // only top-1 per image
                }
                i += 1;
            }
        }
    }
    Ok(results)
}

const BUNDLED_MODEL: &str = "yolo26n-cls.pt";

#[tauri::command]
fn copy_bundled_model(app: tauri::AppHandle, dest_dir: String) -> Result<String, String> {
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join(BUNDLED_MODEL);

    if !resource_path.exists() {
        return Err(format!("内置模型文件不存在：{}", resource_path.display()));
    }

    let dest = std::path::Path::new(&dest_dir).join(BUNDLED_MODEL);
    fs::copy(&resource_path, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn set_ultralytics_weights_dir(weights_dir: String) -> Result<(), String> {
    // Ultralytics stores settings in platform app support dir
    let settings_path = dirs_next();
    let content = fs::read_to_string(&settings_path)
        .unwrap_or_else(|_| "{}".to_string());
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    json["weights_dir"] = serde_json::Value::String(weights_dir);
    fs::write(&settings_path, serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn dirs_next() -> std::path::PathBuf {
    // Ultralytics settings file location (same logic as ultralytics Python code)
    if let Some(home) = std::env::var_os("HOME") {
        let p = std::path::PathBuf::from(home)
            .join("Library/Application Support/Ultralytics/settings.json");
        if p.parent().map(|d| d.exists()).unwrap_or(false) {
            return p;
        }
    }
    // fallback: XDG on Linux
    let xdg = std::env::var("XDG_CONFIG_HOME")
        .unwrap_or_else(|_| format!("{}/.config", std::env::var("HOME").unwrap_or_default()));
    std::path::PathBuf::from(xdg).join("Ultralytics/settings.json")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![check_yolo_installed, scan_data_folder, run_yolo_train, run_classify_val, run_yolo_export, run_yolo_predict, open_folder, copy_bundled_model, set_ultralytics_weights_dir, list_local_models])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
