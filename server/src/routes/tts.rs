use axum::{extract::State, Json, http::StatusCode, response::Response};
use axum::http::header;
use serde::Deserialize;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct TtsRequest {
    pub text: String,
}

pub async fn tts(
    State(state): State<AppState>,
    Json(req): Json<TtsRequest>,
) -> Result<Response<axum::body::Body>, StatusCode> {
    if let Some(api_key) = &state.elevenlabs_api_key {
        if let Ok(resp) = elevenlabs_tts(&state.http, api_key, &state.elevenlabs_voice_id, &req.text).await {
            return Ok(resp);
        }
    }
    piper_tts(&state.http, &state.piper_url, &req.text).await
}

async fn elevenlabs_tts(
    http: &reqwest::Client,
    api_key: &str,
    voice_id: &str,
    text: &str,
) -> Result<Response<axum::body::Body>, StatusCode> {
    let resp = http
        .post(format!("https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"))
        .header("xi-api-key", api_key)
        .json(&serde_json::json!({
            "text": text,
            "model_id": "eleven_v4",
            "output_format": "mp3_44100_128"
        }))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let bytes = resp.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "audio/mpeg")
        .body(axum::body::Body::from(bytes))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
}

async fn piper_tts(
    http: &reqwest::Client,
    piper_url: &str,
    text: &str,
) -> Result<Response<axum::body::Body>, StatusCode> {
    let resp = http
        .post(format!("{piper_url}/tts"))
        .json(&serde_json::json!({ "text": text }))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let bytes = resp.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "audio/wav")
        .body(axum::body::Body::from(bytes))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
}
