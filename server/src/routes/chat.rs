use axum::{extract::State, http::StatusCode, response::sse::{Event, KeepAlive, Sse}, Json};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub avatar_id: String,
    pub personality: String,
    pub history: Vec<HistoryMessage>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub avatar_id: String,
}

fn build_system_prompt(state: &AppState, personality: &str) -> String {
    let cfg = state.context_config.read().unwrap().clone();
    if !cfg.memory_enabled || cfg.memory_inject_count == 0 {
        return personality.to_string();
    }
    let memories = state.memory.read().unwrap().recent(cfg.memory_inject_count);
    if memories.is_empty() {
        return personality.to_string();
    }
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let lines = memories
        .iter()
        .map(|m| format!("- [{}]: {}", ago_label(now_ms - m.timestamp), m.summary))
        .collect::<Vec<_>>()
        .join("\n");
    format!("{}\n\n[Contexto reciente]\n{}", personality, lines)
}

pub async fn chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, StatusCode> {
    let system_prompt = build_system_prompt(&state, &req.personality);

    let mut messages = vec![HistoryMessage { role: "system".into(), content: system_prompt }];
    messages.extend(req.history.clone());
    messages.push(HistoryMessage { role: "user".into(), content: req.message.clone() });

    let model = std::env::var("LLM_MODEL")
        .or_else(|_| std::env::var("OLLAMA_MODEL"))
        .unwrap_or_else(|_| "llama3.2:3b".into());

    let resp = state
        .http
        .post(format!("{}/v1/chat/completions", state.ollama_url))
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": false,
            "enable_thinking": false
        }))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        tracing::warn!("LLM backend returned status: {}", resp.status());
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: serde_json::Value = resp.json().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let raw = body["choices"][0]["message"]["content"].as_str().ok_or_else(|| {
        tracing::error!("Unexpected LLM response structure: {:?}", body);
        StatusCode::BAD_GATEWAY
    })?;

    let content = strip_think(raw);

    // Auto-save memory (non-blocking fire-and-forget)
    {
        let cfg = state.context_config.read().unwrap().clone();
        if cfg.memory_enabled {
            let memory = state.memory.clone();
            let user_short: String = req.message.chars().take(120).collect();
            let ai_short: String = content.chars().take(200).collect();
            let summary = format!("Usuario: {} | Buddy: {}", user_short, ai_short);
            let avatar_id = req.avatar_id.clone();
            tokio::spawn(tokio::task::spawn_blocking(move || {
                memory.write().unwrap().add("conversation", avatar_id, summary, cfg.memory_max_entries, &cfg.memory_path);
            }));
        }
    }

    Ok(Json(ChatResponse { content, avatar_id: req.avatar_id }))
}

pub async fn chat_stream(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<ReceiverStream<Result<Event, Infallible>>>, StatusCode> {
    let system_prompt = build_system_prompt(&state, &req.personality);

    let mut messages = vec![HistoryMessage { role: "system".into(), content: system_prompt }];
    messages.extend(req.history.clone());
    messages.push(HistoryMessage { role: "user".into(), content: req.message.clone() });

    let model = std::env::var("LLM_MODEL")
        .or_else(|_| std::env::var("OLLAMA_MODEL"))
        .unwrap_or_else(|_| "llama3.2:3b".into());

    let upstream = state
        .http
        .post(format!("{}/v1/chat/completions", state.ollama_url))
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": true,
            "enable_thinking": false
        }))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !upstream.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(64);

    // Clone what we need for memory save after streaming completes
    let memory = state.memory.clone();
    let cfg = state.context_config.read().unwrap().clone();
    let user_msg = req.message.clone();
    let avatar_id = req.avatar_id.clone();

    tokio::spawn(async move {
        let mut byte_stream = upstream.bytes_stream();
        let mut buf = String::new();
        let mut in_think = false;
        let mut full_response = String::new();

        while let Some(chunk) = byte_stream.next().await {
            let bytes = match chunk { Ok(b) => b, Err(_) => break };
            buf.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(nl) = buf.find('\n') {
                let line = buf[..nl].trim().to_string();
                buf = buf[nl + 1..].to_string();

                let Some(data) = line.strip_prefix("data: ") else { continue };
                let data = data.trim();

                if data == "[DONE]" {
                    let _ = tx.send(Ok(Event::default().data("[DONE]"))).await;
                    // Save to memory after stream completes
                    if cfg.memory_enabled && !full_response.is_empty() {
                        let user_short: String = user_msg.chars().take(120).collect();
                        let ai_short: String = full_response.chars().take(200).collect();
                        let summary = format!("Usuario: {} | Buddy: {}", user_short, ai_short);
                        tokio::task::spawn_blocking(move || {
                            memory.write().unwrap().add("conversation", avatar_id, summary, cfg.memory_max_entries, &cfg.memory_path);
                        });
                    }
                    return;
                }

                let Ok(val) = serde_json::from_str::<serde_json::Value>(data) else { continue };
                let Some(delta) = val["choices"][0]["delta"]["content"].as_str() else { continue };

                let (out, new_think) = strip_think_delta(delta, in_think);
                in_think = new_think;
                if !out.is_empty() {
                    full_response.push_str(&out);
                    let payload = serde_json::json!({ "delta": out }).to_string();
                    if tx.send(Ok(Event::default().data(payload))).await.is_err() {
                        return;
                    }
                }
            }
        }
        // Stream ended without [DONE] — save whatever we got
        let _ = tx.send(Ok(Event::default().data("[DONE]"))).await;
        if cfg.memory_enabled && !full_response.is_empty() {
            let user_short: String = user_msg.chars().take(120).collect();
            let ai_short: String = full_response.chars().take(200).collect();
            let summary = format!("Usuario: {} | Buddy: {}", user_short, ai_short);
            tokio::task::spawn_blocking(move || {
                memory.write().unwrap().add("conversation", avatar_id, summary, cfg.memory_max_entries, &cfg.memory_path);
            });
        }
    });

    Ok(Sse::new(ReceiverStream::new(rx)).keep_alive(KeepAlive::default()))
}

fn ago_label(delta_ms: i64) -> String {
    let secs = (delta_ms / 1000).max(0);
    if secs < 60 { "hace un momento".into() }
    else if secs < 3600 { format!("hace {} min", secs / 60) }
    else { format!("hace {} h", secs / 3600) }
}

fn strip_think(raw: &str) -> String {
    let mut s = raw.to_string();
    while let (Some(start), Some(end)) = (s.find("<think>"), s.find("</think>")) {
        if start < end { s.replace_range(start..=end + 8, ""); } else { break; }
    }
    s.trim().to_string()
}

fn strip_think_delta(delta: &str, in_think: bool) -> (String, bool) {
    let mut out = String::new();
    let mut state = in_think;
    let mut remaining = delta;
    loop {
        if state {
            if let Some(end) = remaining.find("</think>") {
                remaining = &remaining[end + 8..];
                state = false;
            } else { break; }
        } else {
            if let Some(start) = remaining.find("<think>") {
                out.push_str(&remaining[..start]);
                remaining = &remaining[start + 7..];
                state = true;
            } else {
                out.push_str(remaining);
                break;
            }
        }
    }
    (out, state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chat_response_serializes_correctly() {
        let resp = ChatResponse { content: "Hola!".into(), avatar_id: "fox".into() };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("Hola!"));
        assert!(json.contains("fox"));
    }
}
