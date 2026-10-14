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
    let resp = state.http
        .post(format!("{}/tts", state.piper_url))
        .json(&serde_json::json!({ "text": req.text }))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let bytes = resp.bytes().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "audio/wav")
        .body(axum::body::Body::from(bytes))
        .unwrap())
}
