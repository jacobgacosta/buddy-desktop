use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Default)]
struct InputState {
    key_timestamps: Vec<u64>,
    mouse_events: u32,
    last_input_at: Option<u64>,
    mic_active: bool,
    mic_level: f32,
}

#[derive(Serialize, Clone)]
pub struct SensorPayload {
    pub timestamp: u64,
    pub mic_active: bool,
    pub mic_level: f32,
    pub key_rate: f32,
    pub mouse_distance: f32,
    pub input_level: String,
    pub idle_duration_ms: u64,
    pub hour: u8,
    pub is_night: bool,
    pub is_weekend: bool,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn launch_sensors(app: AppHandle) {
    let state = Arc::new(Mutex::new(InputState::default()));

    // rdev: global keyboard + mouse hook
    let state_input = Arc::clone(&state);
    std::thread::spawn(move || {
        let _ = rdev::listen(move |event| {
            let mut s = state_input.lock().unwrap();
            match event.event_type {
                rdev::EventType::KeyPress(_) => {
                    let t = now_ms();
                    s.key_timestamps.push(t);
                    s.last_input_at = Some(t);
                }
                rdev::EventType::MouseMove { .. } => {
                    s.mouse_events += 1;
                    s.last_input_at = Some(now_ms());
                }
                _ => {}
            }
        });
    });

    // Snapshot emitter: every 5 seconds
    let state_emit = Arc::clone(&state);
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(5));

        let payload = {
            let mut s = state_emit.lock().unwrap();
            let now = now_ms();

            s.key_timestamps.retain(|&t| now - t < 60_000);
            let key_rate = s.key_timestamps.len() as f32;

            let idle_ms = match s.last_input_at {
                Some(t) => now.saturating_sub(t),
                None    => now,
            };

            let input_level = if idle_ms > 120_000 {
                "idle"
            } else if key_rate > 60.0 {
                "heavy"
            } else {
                "light"
            }
            .to_string();

            let mouse_events = s.mouse_events as f32;
            s.mouse_events = 0;

            let secs = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let hour = ((secs % 86400) / 3600) as u8;
            let day_of_week = (secs / 86400 + 4) % 7;

            SensorPayload {
                timestamp: now,
                mic_active: s.mic_active,
                mic_level: s.mic_level,
                key_rate,
                mouse_distance: mouse_events,
                input_level,
                idle_duration_ms: idle_ms,
                hour,
                is_night: hour < 6 || hour >= 22,
                is_weekend: day_of_week == 0 || day_of_week == 6,
            }
        };

        let _ = app.emit("sensor-snapshot", payload);
    });

    // cpal: mic volume (optional, graceful failure)
    let state_mic = Arc::clone(&state);
    std::thread::spawn(move || {
        if let Err(e) = run_mic(state_mic) {
            eprintln!("[buddy-sensors] mic disabled: {e}");
        }
    });
}

fn run_mic(state: Arc<Mutex<InputState>>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host   = cpal::default_host();
    let device = host.default_input_device().ok_or("no audio input device")?;
    let config = device.default_input_config()?;

    let state_cb = Arc::clone(&state);
    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let rms = (data.iter().map(|&s| s * s).sum::<f32>() / data.len() as f32).sqrt();
            let mut st = state_cb.lock().unwrap();
            st.mic_level  = rms;
            st.mic_active = rms > 0.01;
        },
        |err| eprintln!("[buddy-sensors] mic stream error: {err}"),
        None,
    )?;

    stream.play()?;
    loop { std::thread::sleep(Duration::from_secs(60)); }
}
