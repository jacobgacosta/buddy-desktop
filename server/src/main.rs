#![allow(unused_imports)]

mod routes;
mod state;

use axum::{Router, routing::{get, post}};
use state::AppState;
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let state = AppState::new();
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "7788".into())
        .parse::<u16>()
        .expect("PORT must be a number");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(routes::health::health))
        .route("/avatars", get(routes::avatars::list_avatars))
        .route("/chat", post(routes::chat::chat))
        .route("/mood", post(routes::mood::decide_mood))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("failed to bind");

    tracing::info!("buddy-server listening on :{port}");
    axum::serve(listener, app).await.expect("server error");
}
