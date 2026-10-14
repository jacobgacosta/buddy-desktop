use axum::{extract::State, Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use base64::Engine as _;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct TranscribeRequest {
    pub audio_b64: String,
}

#[derive(Serialize)]
pub struct TranscribeResponse {
    pub transcript: String,
}

pub async fn transcribe(
    State(state): State<AppState>,
    Json(req): Json<TranscribeRequest>,
) -> Result<Json<TranscribeResponse>, StatusCode> {
    let wav_bytes = base64::engine::general_purpose::STANDARD
        .decode(&req.audio_b64)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let lang = std::env::var("WHISPER_LANG").unwrap_or_else(|_| "es".into());

    let file_part = reqwest::multipart::Part::bytes(wav_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let prompt = std::env::var("WHISPER_PROMPT")
        .unwrap_or_else(|_| "buddy".into());

    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-1")
        .text("language", lang)
        .text("prompt", prompt)
        .text("vad_filter", "true")
        .part("file", file_part);

    let resp = state.http
        .post(format!("{}/v1/audio/transcriptions", state.whisper_url))
        .multipart(form)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let transcript = body["text"]
        .as_str()
        .ok_or(StatusCode::BAD_GATEWAY)?
        .trim()
        .to_string();

    Ok(Json(TranscribeResponse { transcript }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transcribe_response_serializes() {
        let r = TranscribeResponse { transcript: "hola buddy".into() };
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("hola buddy"));
    }
}
