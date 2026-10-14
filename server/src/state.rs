#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub mood_url: String,
    pub whisper_url: String,
    pub piper_url: String,
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
            whisper_url: std::env::var("WHISPER_URL")
                .unwrap_or_else(|_| "http://localhost:8080".into()),
            piper_url: std::env::var("PIPER_URL")
                .unwrap_or_else(|_| "http://localhost:5000".into()),
            avatars_dir: std::env::var("AVATARS_DIR").unwrap_or_else(|_| "avatars".into()),
            http: reqwest::Client::new(),
        }
    }
}
