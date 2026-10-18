use axum::{extract::{Query, State}, http::StatusCode, Json};
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::state::{AppState, ContextConfig, MemoryEntry};

#[derive(Deserialize)]
pub struct ScreenshotRequest {
    pub base64_image: String,
    pub avatar_id: Option<String>,
}

#[derive(Deserialize)]
pub struct MemoryRequest {
    pub avatar_id: String,
    pub user_message: String,
    pub assistant_message: String,
}

#[derive(Serialize)]
pub struct MemoriesResponse {
    pub entries: Vec<MemoryEntry>,
    pub total: usize,
}

pub async fn get_config(State(state): State<AppState>) -> Json<ContextConfig> {
    Json(state.context_config.read().unwrap().clone())
}

pub async fn put_config(
    State(state): State<AppState>,
    Json(cfg): Json<ContextConfig>,
) -> StatusCode {
    if cfg.screenshot_save_to_disk {
        std::fs::create_dir_all(&cfg.screenshot_save_path).ok();
    }

    // Reload memory store if path changed
    {
        let old_path = state.context_config.read().unwrap().memory_path.clone();
        if old_path != cfg.memory_path {
            let new_store = crate::state::MemoryStore::load(&cfg.memory_path);
            *state.memory.write().unwrap() = new_store;
        }
    }

    *state.context_config.write().unwrap() = cfg.clone();
    std::fs::write(
        "./buddy-context.json",
        serde_json::to_string_pretty(&cfg).unwrap_or_default(),
    )
    .ok();
    StatusCode::OK
}

pub async fn post_screenshot(
    State(state): State<AppState>,
    Json(req): Json<ScreenshotRequest>,
) -> StatusCode {
    let cfg = state.context_config.read().unwrap().clone();
    if !cfg.screenshot_enabled {
        return StatusCode::NO_CONTENT;
    }

    if cfg.screenshot_save_to_disk {
        std::fs::create_dir_all(&cfg.screenshot_save_path).ok();
        let ts = now_secs();
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(&req.base64_image) {
            std::fs::write(
                format!("{}/screenshot_{}.png", cfg.screenshot_save_path, ts),
                bytes,
            )
            .ok();
        }
    }

    let Ok(api_key) = std::env::var("ANTHROPIC_API_KEY") else {
        tracing::warn!("ANTHROPIC_API_KEY not set — screenshot analysis skipped");
        return StatusCode::SERVICE_UNAVAILABLE;
    };

    let body = serde_json::json!({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 200,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": req.base64_image
                    }
                },
                {
                    "type": "text",
                    "text": "En 1-2 frases en español, describe qué está haciendo el usuario en pantalla. Enfócate en la app activa y la tarea visible. Sé muy conciso."
                }
            ]
        }]
    });

    let Ok(resp) = state
        .http
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
    else {
        return StatusCode::BAD_GATEWAY;
    };

    if !resp.status().is_success() {
        tracing::warn!("Anthropic vision API error: {}", resp.status());
        return StatusCode::BAD_GATEWAY;
    }

    let Ok(val) = resp.json::<serde_json::Value>().await else {
        return StatusCode::BAD_GATEWAY;
    };
    let summary = val["content"][0]["text"].as_str().unwrap_or("").trim().to_string();
    if summary.is_empty() {
        return StatusCode::NO_CONTENT;
    }

    let avatar_id = req.avatar_id.unwrap_or_default();
    let max_entries = cfg.memory_max_entries;
    let memory_path = cfg.memory_path.clone();
    tokio::task::spawn_blocking(move || {
        state.memory.write().unwrap().add("screenshot", avatar_id, summary, max_entries, &memory_path);
    })
    .await
    .ok();

    StatusCode::CREATED
}

pub async fn post_memory(
    State(state): State<AppState>,
    Json(req): Json<MemoryRequest>,
) -> StatusCode {
    let cfg = state.context_config.read().unwrap().clone();
    if !cfg.memory_enabled {
        return StatusCode::NO_CONTENT;
    }
    let user_short: String = req.user_message.chars().take(120).collect();
    let ai_short: String = req.assistant_message.chars().take(200).collect();
    let summary = format!("Usuario: {} | Buddy: {}", user_short, ai_short);
    let max_entries = cfg.memory_max_entries;
    let memory_path = cfg.memory_path.clone();
    tokio::task::spawn_blocking(move || {
        state.memory.write().unwrap().add("conversation", req.avatar_id, summary, max_entries, &memory_path);
    })
    .await
    .ok();
    StatusCode::CREATED
}

pub async fn get_memories(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Json<MemoriesResponse> {
    let limit: usize = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(50);
    let store = state.memory.read().unwrap();
    let total = store.entries.len();
    let start = total.saturating_sub(limit);
    let entries = store.entries[start..].iter().cloned().rev().collect();
    Json(MemoriesResponse { entries, total })
}

pub async fn delete_memories(State(state): State<AppState>) -> StatusCode {
    let memory_path = state.context_config.read().unwrap().memory_path.clone();
    let mut store = state.memory.write().unwrap();
    store.entries.clear();
    store.save(&memory_path);
    StatusCode::NO_CONTENT
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
