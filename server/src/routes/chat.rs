use axum::{extract::State, Json, http::StatusCode};
use serde::{Deserialize, Serialize};
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

pub async fn chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, StatusCode> {
    let mut messages = vec![
        HistoryMessage {
            role: "system".into(),
            content: req.personality.clone(),
        }
    ];
    messages.extend(req.history.clone());
    messages.push(HistoryMessage {
        role: "user".into(),
        content: req.message.clone(),
    });

    let model = std::env::var("LLM_MODEL")
        .or_else(|_| std::env::var("OLLAMA_MODEL"))
        .unwrap_or_else(|_| "llama3.2:3b".into());

    let llm_req = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
        "enable_thinking": false
    });

    let resp = state.http
        .post(format!("{}/v1/chat/completions", state.ollama_url))
        .json(&llm_req)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        tracing::warn!("LLM backend returned status: {}", resp.status());
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let raw = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| {
            tracing::error!("Unexpected LLM response structure: {:?}", body);
            StatusCode::BAD_GATEWAY
        })?;

    // Strip <think>...</think> blocks that qwen3 emits in thinking mode
    let content = {
        let mut s = raw.to_string();
        while let (Some(start), Some(end)) = (s.find("<think>"), s.find("</think>")) {
            if start < end { s.replace_range(start..=end + 8, ""); } else { break; }
        }
        s.trim().to_string()
    };

    Ok(Json(ChatResponse {
        content,
        avatar_id: req.avatar_id,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chat_response_serializes_correctly() {
        let resp = ChatResponse {
            content: "Hola!".into(),
            avatar_id: "fox".into(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("Hola!"));
        assert!(json.contains("fox"));
    }
}
