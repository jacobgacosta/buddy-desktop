use axum::{extract::State, Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct MoodRequest {
    pub hour: u8,
    pub is_night: bool,
    pub input_level: String,
    pub idle_duration_min: u32,
    pub mic_active: bool,
    pub current_mood: String,
}

#[derive(Serialize, Deserialize)]
pub struct MoodResponse {
    pub mood: String,
    pub energy: String,
    pub restlessness: String,
    pub z_order: String,
}

pub async fn decide_mood(
    State(state): State<AppState>,
    Json(req): Json<MoodRequest>,
) -> Result<Json<MoodResponse>, StatusCode> {
    let model = std::env::var("MOOD_MODEL")
        .unwrap_or_else(|_| "qwen2.5-3b-instruct".into());

    let prompt = format!(
        "You are deciding the mood for a small AI desktop companion. \
        Current context: hour={}, night={}, user_activity={}, idle_minutes={}, \
        voice_active={}, current_mood={}. \
        Pick the most appropriate mood given this context.",
        req.hour, req.is_night, req.input_level,
        req.idle_duration_min, req.mic_active, req.current_mood
    );

    let response_format = serde_json::json!({
        "type": "json_schema",
        "json_schema": {
            "name": "mood_decision",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "mood":         { "enum": ["playful","focused","tired","curious","calm","sleepy"] },
                    "energy":       { "enum": ["very_low","low","medium","high","very_high"] },
                    "restlessness": { "enum": ["still","slow","normal","active","restless"] },
                    "z_order":      { "enum": ["top","normal","behind"] }
                },
                "required": ["mood","energy","restlessness","z_order"],
                "additionalProperties": false
            }
        }
    });

    let llm_req = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": prompt }],
        "response_format": response_format,
        "stream": false
    });

    let resp = state.http
        .post(format!("{}/v1/chat/completions", state.mood_url))
        .json(&llm_req)
        .send()
        .await
        .map_err(|e| { tracing::warn!("mood LLM error: {e}"); StatusCode::BAD_GATEWAY })?;

    if !resp.status().is_success() {
        tracing::warn!("mood LLM status: {}", resp.status());
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or(StatusCode::BAD_GATEWAY)?;

    let mood: MoodResponse = serde_json::from_str(content)
        .map_err(|e| { tracing::warn!("mood parse error: {e} — content: {content}"); StatusCode::BAD_GATEWAY })?;

    Ok(Json(mood))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mood_response_serializes() {
        let r = MoodResponse {
            mood: "calm".into(),
            energy: "low".into(),
            restlessness: "slow".into(),
            z_order: "normal".into(),
        };
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("calm"));
        assert!(j.contains("z_order"));
    }
}
