use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ContextConfig {
    pub memory_enabled: bool,
    pub memory_max_entries: u32,
    pub memory_path: String,
    pub screenshot_enabled: bool,
    pub screenshot_interval_secs: u32,
    pub screenshot_save_to_disk: bool,
    pub screenshot_save_path: String,
    pub screenshot_monitor: String,
    pub memory_inject_count: u32,
}

impl Default for ContextConfig {
    fn default() -> Self {
        ContextConfig {
            memory_enabled: true,
            memory_max_entries: 100,
            memory_path: "./buddy-memory.json".into(),
            screenshot_enabled: false,
            screenshot_interval_secs: 60,
            screenshot_save_to_disk: false,
            screenshot_save_path: "./screenshots".into(),
            screenshot_monitor: "buddy".into(),
            memory_inject_count: 5,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MemoryEntry {
    pub id: u64,
    pub timestamp: i64,
    pub source: String,
    pub avatar_id: String,
    pub summary: String,
}

#[derive(Default)]
pub struct MemoryStore {
    pub entries: Vec<MemoryEntry>,
    pub next_id: u64,
}

impl MemoryStore {
    pub fn load(path: &str) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str::<Vec<MemoryEntry>>(&s).ok())
            .map(|entries| {
                let next_id = entries.iter().map(|e| e.id).max().unwrap_or(0) + 1;
                MemoryStore { entries, next_id }
            })
            .unwrap_or_default()
    }

    pub fn save(&self, path: &str) {
        if let Ok(json) = serde_json::to_string(&self.entries) {
            std::fs::write(path, json).ok();
        }
    }

    pub fn add(&mut self, source: &str, avatar_id: String, summary: String, max_entries: u32, path: &str) {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.entries.push(MemoryEntry {
            id: self.next_id,
            timestamp: ts,
            source: source.into(),
            avatar_id,
            summary,
        });
        self.next_id += 1;
        // Trim oldest entries beyond max
        if self.entries.len() > max_entries as usize {
            let drain = self.entries.len() - max_entries as usize;
            self.entries.drain(0..drain);
        }
        self.save(path);
    }

    /// Returns up to `count` most recent entries, oldest-first (for prompt injection).
    pub fn recent(&self, count: u32) -> Vec<MemoryEntry> {
        let n = count as usize;
        let start = self.entries.len().saturating_sub(n);
        self.entries[start..].to_vec()
    }
}

#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub mood_url: String,
    pub whisper_url: String,
    pub piper_url: String,
    pub avatars_dir: String,
    pub elevenlabs_api_key: Option<String>,
    pub elevenlabs_voice_id: String,
    pub http: reqwest::Client,
    pub memory: Arc<RwLock<MemoryStore>>,
    pub context_config: Arc<RwLock<ContextConfig>>,
}

impl AppState {
    pub fn new() -> Self {
        let cfg: ContextConfig = std::fs::read_to_string("./buddy-context.json")
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        let store = MemoryStore::load(&cfg.memory_path);

        let ollama_url = std::env::var("OLLAMA_URL")
            .unwrap_or_else(|_| "http://localhost:11434".into());
        let mood_url = std::env::var("MOOD_URL").unwrap_or_else(|_| ollama_url.clone());

        AppState {
            ollama_url,
            mood_url,
            whisper_url: std::env::var("WHISPER_URL")
                .unwrap_or_else(|_| "http://localhost:8080".into()),
            piper_url: std::env::var("PIPER_URL")
                .unwrap_or_else(|_| "http://localhost:5000".into()),
            avatars_dir: std::env::var("AVATARS_DIR").unwrap_or_else(|_| "avatars".into()),
            elevenlabs_api_key: std::env::var("ELEVENLABS_API_KEY").ok(),
            elevenlabs_voice_id: std::env::var("ELEVENLABS_VOICE_ID")
                .unwrap_or_else(|_| "JBFqnCBsd6RMkjVDRZzb".into()),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            memory: Arc::new(RwLock::new(store)),
            context_config: Arc::new(RwLock::new(cfg)),
        }
    }
}
