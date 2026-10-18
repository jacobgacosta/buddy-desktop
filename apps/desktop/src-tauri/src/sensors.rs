use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use chrono::Timelike as _;
use chrono::Datelike as _;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub(crate) struct InputState {
    key_timestamps: Vec<u64>,
    mouse_events: u32,
    last_input_at: Option<u64>,
    pub(crate) mic_active: bool,
    pub(crate) mic_level: f32,
    pub(crate) mic_device_name: String,
    pub(crate) recording: bool,
    pub(crate) recording_buffer: Vec<f32>,
    pub(crate) recording_sample_rate: u32,
    pub(crate) recording_channels: u16,
    ambient_active_since: Option<u64>,
    ambient_silent_since: Option<u64>,
    // click-through: window position + UI state
    pub(crate) win_x: f64,
    pub(crate) win_y: f64,
    pub(crate) panels_open: bool,
    is_ignoring: bool,
}

/// Shared config for mic device switching — managed as Tauri state.
pub struct MicConfig {
    pub desired_device: Option<String>,
    pub restart: bool,
}

impl Default for MicConfig {
    fn default() -> Self {
        MicConfig { desired_device: None, restart: false }
    }
}

#[derive(Serialize, Clone)]
pub struct SensorPayload {
    pub timestamp: u64,
    pub mic_active: bool,
    pub mic_level: f32,
    pub mic_device_name: String,
    pub key_rate: f32,
    pub mouse_distance: f32,
    pub input_level: String,
    pub idle_duration_ms: u64,
    pub hour: u8,
    pub is_night: bool,
    pub is_weekend: bool,
    pub ambient_type: String,       // "silence" | "speech" | "music"
    pub ambient_duration_s: u64,
}

#[derive(Serialize, Clone)]
pub struct MicLevelPayload {
    pub level: f32,
    pub active: bool,
}

pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Starts sensors and returns the mic config Arc for device switching commands,
/// and the shared InputState Arc for VAD/voice recording.
pub fn launch_sensors(app: AppHandle) -> (Arc<Mutex<MicConfig>>, Arc<Mutex<InputState>>) {
    let state = Arc::new(Mutex::new(InputState::default()));
    let mic_config = Arc::new(Mutex::new(MicConfig::default()));

    // rdev: global keyboard + mouse hook
    let state_input = Arc::clone(&state);
    let app_rdev = app.clone();
    std::thread::spawn(move || {
        let _ = rdev::listen(move |event| {
            let mut s = state_input.lock().unwrap();
            match event.event_type {
                rdev::EventType::KeyPress(_) => {
                    let t = now_ms();
                    s.key_timestamps.push(t);
                    s.last_input_at = Some(t);
                }
                rdev::EventType::MouseMove { x, y } => {
                    s.mouse_events += 1;
                    s.last_input_at = Some(now_ms());

                    // click-through: ignore cursor events on transparent margins
                    const OFF_X: f64 = 30.0;
                    const SPRITE: f64 = 200.0;
                    let in_avatar = x >= s.win_x + OFF_X && x < s.win_x + OFF_X + SPRITE
                                 && y >= s.win_y          && y < s.win_y + SPRITE;
                    let should_ignore = !in_avatar && !s.panels_open;
                    if should_ignore != s.is_ignoring {
                        s.is_ignoring = should_ignore;
                        if let Some(win) = app_rdev.get_webview_window("buddy") {
                            let _ = win.set_ignore_cursor_events(should_ignore);
                        }
                    }
                }
                _ => {}
            }
        });
    });

    // Snapshot emitter: every 5 seconds
    let state_emit = Arc::clone(&state);
    let app_emit = app.clone();
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

            let local_now = chrono::Local::now();
            let hour = local_now.hour() as u8;
            let day_of_week = local_now.weekday().num_days_from_sunday();

            // Ambient classification
            let (ambient_type, ambient_duration_s) = {
                let level = s.mic_level;
                if level < 0.005 {
                    let since = s.ambient_silent_since.unwrap_or(now);
                    s.ambient_silent_since = Some(since);
                    s.ambient_active_since = None;
                    let dur = now.saturating_sub(since) / 1000;
                    ("silence".to_string(), dur)
                } else {
                    let since = s.ambient_active_since.unwrap_or(now);
                    s.ambient_active_since = Some(since);
                    s.ambient_silent_since = None;
                    let dur = now.saturating_sub(since) / 1000;
                    if dur >= 4 {
                        ("music".to_string(), dur)
                    } else {
                        ("speech".to_string(), dur)
                    }
                }
            };

            SensorPayload {
                timestamp: now,
                mic_active: s.mic_active,
                mic_level: s.mic_level,
                mic_device_name: s.mic_device_name.clone(),
                key_rate,
                mouse_distance: mouse_events,
                input_level,
                idle_duration_ms: idle_ms,
                hour,
                is_night: hour < 6 || hour >= 22,
                is_weekend: day_of_week == 0 || day_of_week == 6,
                ambient_type,
                ambient_duration_s,
            }
        };

        let _ = app_emit.emit("sensor-snapshot", payload);
    });

    // cpal: mic with real-time level emit + device switching
    let state_mic = Arc::clone(&state);
    let mic_config_mic = Arc::clone(&mic_config);
    let app_mic = app.clone();
    std::thread::spawn(move || loop {
        let desired = {
            let mut c = mic_config_mic.lock().unwrap();
            c.restart = false;
            c.desired_device.clone()
        };
        if let Err(e) = run_mic(
            Arc::clone(&state_mic),
            desired,
            Arc::clone(&mic_config_mic),
            app_mic.clone(),
        ) {
            eprintln!("[buddy-sensors] mic disabled: {e}");
            std::thread::sleep(Duration::from_secs(5));
        }
    });

    (mic_config, state)
}

fn run_mic(
    state: Arc<Mutex<InputState>>,
    desired_device: Option<String>,
    mic_config: Arc<Mutex<MicConfig>>,
    app: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();

    let device = if let Some(ref name) = desired_device {
        host.input_devices()?
            .find(|d| d.name().map(|n| n == *name).unwrap_or(false))
            .ok_or_else(|| format!("device '{name}' not found"))?
    } else {
        host.default_input_device().ok_or("no audio input device")?
    };

    let config = device.default_input_config()?;
    let sample_rate = config.sample_rate().0;
    let channels = config.channels();
    let dev_name = device.name().unwrap_or_else(|_| "Unknown".into());
    {
        let mut s = state.lock().unwrap();
        s.mic_device_name = dev_name;
        s.recording_sample_rate = sample_rate;
        s.recording_channels = channels;
    }

    let state_cb = Arc::clone(&state);
    let app_cb = app.clone();
    let mut last_emit = Instant::now();

    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let rms = (data.iter().map(|&s| s * s).sum::<f32>() / data.len() as f32).sqrt();
            {
                let mut st = state_cb.lock().unwrap();
                st.mic_level  = rms;
                st.mic_active = rms > 0.01;
                if st.recording {
                    let ch = st.recording_channels as usize;
                    if ch <= 1 {
                        st.recording_buffer.extend_from_slice(data);
                    } else {
                        // downmix to mono: average all channels per frame
                        for frame in data.chunks_exact(ch) {
                            let mono = frame.iter().sum::<f32>() / ch as f32;
                            st.recording_buffer.push(mono);
                        }
                    }
                }
            }
            // Emit real-time level ~5 times/sec
            if last_emit.elapsed() >= Duration::from_millis(200) {
                last_emit = Instant::now();
                let _ = app_cb.emit("mic-level", MicLevelPayload { level: rms, active: rms > 0.01 });
            }
        },
        |err| eprintln!("[buddy-sensors] mic stream error: {err}"),
        None,
    )?;

    stream.play()?;

    // Hold stream alive; break out when a device switch is requested
    loop {
        std::thread::sleep(Duration::from_millis(500));
        if mic_config.lock().unwrap().restart {
            return Ok(());
        }
    }
}
