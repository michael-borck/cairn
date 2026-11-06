use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(serde::Deserialize)]
struct OllamaResponse {
    response: String,
}

fn local_base_url(base_url: &str) -> Result<String, String> {
    let url = reqwest::Url::parse(base_url).map_err(|error| error.to_string())?;
    let host = url.host_str().unwrap_or("");
    if !matches!(host, "127.0.0.1" | "localhost" | "::1") {
        return Err("AI is local-only in v0.1. Use a localhost Ollama URL.".into());
    }
    Ok(base_url.trim_end_matches('/').to_string())
}

#[tauri::command]
fn health() -> &'static str {
    "ok"
}

#[tauri::command]
async fn ollama_chat(
    base_url: String,
    model: String,
    system: String,
    prompt: String,
) -> Result<String, String> {
    let base = local_base_url(&base_url)?;
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{base}/api/generate"))
        .json(&serde_json::json!({
            "model": model,
            "system": system,
            "prompt": prompt,
            "stream": false,
        }))
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Ollama returned {}", response.status()));
    }
    let body: OllamaResponse = response.json().await.map_err(|error| error.to_string())?;
    let text = body.response.trim().to_string();
    if text.is_empty() {
        return Err("Ollama returned an empty response.".into());
    }
    Ok(text)
}

fn read_json(dir: &Path, name: &str) -> Result<Value, String> {
    let base = dir.canonicalize().map_err(|error| error.to_string())?;
    let path = base.join(name);
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("{name}: {error}"))?;
    if !canonical.starts_with(&base) {
        return Err(format!("pack entry escapes the pack directory: {name}"));
    }
    let text = fs::read_to_string(&canonical).map_err(|error| format!("{name}: {error}"))?;
    serde_json::from_str(&text).map_err(|error| format!("{name}: {error}"))
}

#[tauri::command]
fn read_pack_dir(path: String) -> Result<Value, String> {
    let dir = PathBuf::from(path);
    let manifest = read_json(&dir, "manifest.json")?;
    let (curriculum, items, rubrics, misconceptions, labs, policy) = {
        let entries = manifest.get("entries").and_then(Value::as_object);
        let entry_name = |key: &str, fallback: &str| -> String {
            entries
                .and_then(|map| map.get(key))
                .and_then(Value::as_str)
                .unwrap_or(fallback)
                .to_string()
        };
        (
            entry_name("curriculum", "curriculum.json"),
            entry_name("items", "items.json"),
            entry_name("rubrics", "rubrics.json"),
            entry_name("misconceptions", "misconceptions.json"),
            entry_name("labs", "labs.json"),
            entry_name("policy", "policy.json"),
        )
    };

    Ok(serde_json::json!({
        "manifest": manifest,
        "curriculum": read_json(&dir, &curriculum)?,
        "items": read_json(&dir, &items)?,
        "rubrics": read_json(&dir, &rubrics)?,
        "misconceptions": read_json(&dir, &misconceptions)?,
        "labs": read_json(&dir, &labs)?,
        "policy": read_json(&dir, &policy)?,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![health, read_pack_dir, ollama_chat])
        .run(tauri::generate_context!())
        .expect("error while running the Cairn app");
}

#[cfg(test)]
mod tests {
    use super::read_pack_dir;
    use std::path::PathBuf;

    #[test]
    fn rejects_non_local_ai_urls() {
        assert!(super::local_base_url("http://127.0.0.1:11434").is_ok());
        assert!(super::local_base_url("http://localhost:11434").is_ok());
        assert!(super::local_base_url("https://example.com").is_err());
    }

    #[test]
    fn reads_the_docker_pack_directory() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../content-packs/docker-fundamentals");
        let pack = read_pack_dir(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(pack["manifest"]["id"], "docker-fundamentals");
        assert_eq!(pack["curriculum"]["skills"].as_array().unwrap().len(), 9);
        assert_eq!(pack["items"].as_array().unwrap().len(), 37);
    }
}
