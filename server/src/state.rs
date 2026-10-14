#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub mood_url: String,
    pub avatars_dir: String,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new() -> Self {
        let ollama_url = std::env::var("OLLAMA_URL")
            .unwrap_or_else(|_| "http://localhost:11434".into());
        let mood_url = std::env::var("MOOD_URL").unwrap_or_else(|_| ollama_url.clone());
        Self {
            ollama_url,
            mood_url,
            avatars_dir: std::env::var("AVATARS_DIR").unwrap_or_else(|_| "avatars".into()),
            http: reqwest::Client::new(),
        }
    }
}
