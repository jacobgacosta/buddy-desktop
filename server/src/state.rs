#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub avatars_dir: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            ollama_url: std::env::var("OLLAMA_URL")
                .unwrap_or_else(|_| "http://localhost:11434".into()),
            avatars_dir: std::env::var("AVATARS_DIR")
                .unwrap_or_else(|_| "avatars".into()),
        }
    }
}
