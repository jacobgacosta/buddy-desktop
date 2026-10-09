use axum::{extract::State, Json, http::StatusCode};
use serde_json::Value;
use std::fs;
use crate::state::AppState;

pub async fn list_avatars(
    State(state): State<AppState>,
) -> Result<Json<Vec<Value>>, StatusCode> {
    let dir = fs::read_dir(&state.avatars_dir)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let avatars: Vec<Value> = dir
        .filter_map(|entry| entry.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
        .filter_map(|e| fs::read_to_string(e.path()).ok())
        .filter_map(|s| serde_json::from_str(&s).ok())
        .collect();

    Ok(Json(avatars))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use axum::{Router, routing::get};
    use std::fs;

    #[tokio::test]
    async fn list_avatars_returns_json_array() {
        // crear directorio temporal con un avatar de prueba
        let dir = std::env::temp_dir().join("buddy_test_avatars");
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("test.json"),
            r#"{"id":"test","name":"Test","riveFile":"test.riv","stateMachine":"SM","personality":"test","voice":{"system":"es"},"palette":[],"size":"small"}"#
        ).unwrap();

        let state = AppState {
            ollama_url: "http://localhost:11434".into(),
            avatars_dir: dir.to_str().unwrap().into(),
        };

        let app = Router::new()
            .route("/avatars", get(list_avatars))
            .with_state(state);

        let server = TestServer::new(app).unwrap();
        let response = server.get("/avatars").await;
        response.assert_status_ok();
        let body: Vec<Value> = response.json();
        assert!(!body.is_empty());
        assert_eq!(body[0]["id"], "test");
        fs::remove_dir_all(&dir).unwrap_or_default();
    }
}
