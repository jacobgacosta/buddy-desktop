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

    let ollama_req = serde_json::json!({
        "model": std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "llama3.2:3b".into()),
        "messages": messages,
        "stream": false
    });

    let resp = state.http
        .post(format!("{}/api/chat", state.ollama_url))
        .json(&ollama_req)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        tracing::warn!("Ollama returned status: {}", resp.status());
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let content = body["message"]["content"]
        .as_str()
        .ok_or_else(|| {
            tracing::error!("Unexpected Ollama response structure: {:?}", body);
            StatusCode::BAD_GATEWAY
        })?
        .to_string();

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
