use std::sync::{Arc, Mutex};
use std::time::Duration;
use base64::Engine as _;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::sensors::InputState;

#[derive(Serialize, Clone)]
pub struct VoiceCapturedPayload {
    pub audio_b64: String,
    pub duration_ms: u64,
}

enum VadState {
    Idle,
    Recording { started_ms: u64 },
    Trailing { started_ms: u64, recording_started: u64 },
}

pub fn launch_voice(app: AppHandle, state: Arc<Mutex<InputState>>) {
    std::thread::spawn(move || {
        let mut vad = VadState::Idle;
        loop {
            std::thread::sleep(Duration::from_millis(50));
            let (level, now_ms) = {
                let s = state.lock().unwrap();
                (s.mic_level, crate::sensors::now_ms())
            };

            vad = match vad {
                VadState::Idle => {
                    if level >= 0.015 {
                        {
                            let mut s = state.lock().unwrap();
                            s.recording = true;
                            s.recording_buffer.clear();
                        }
                        VadState::Recording { started_ms: now_ms }
                    } else {
                        VadState::Idle
                    }
                }
                VadState::Recording { started_ms } => {
                    let elapsed = now_ms.saturating_sub(started_ms);
                    if level < 0.015 {
                        VadState::Trailing { started_ms: now_ms, recording_started: started_ms }
                    } else if elapsed > 30_000 {
                        finalize(&state, &app, started_ms, now_ms);
                        VadState::Idle
                    } else {
                        VadState::Recording { started_ms }
                    }
                }
                VadState::Trailing { started_ms, recording_started } => {
                    let silence_ms = now_ms.saturating_sub(started_ms);
                    let total_ms = now_ms.saturating_sub(recording_started);
                    if level >= 0.015 {
                        VadState::Recording { started_ms: recording_started }
                    } else if silence_ms >= 500 {
                        if total_ms >= 700 {
                            finalize(&state, &app, recording_started, now_ms);
                        } else {
                            let mut s = state.lock().unwrap();
                            s.recording = false;
                            s.recording_buffer.clear();
                        }
                        VadState::Idle
                    } else {
                        VadState::Trailing { started_ms, recording_started }
                    }
                }
            };
        }
    });
}

fn finalize(state: &Arc<Mutex<InputState>>, app: &AppHandle, started_ms: u64, ended_ms: u64) {
    let (pcm, sample_rate) = {
        let mut s = state.lock().unwrap();
        s.recording = false;
        let buf = std::mem::take(&mut s.recording_buffer);
        (buf, s.recording_sample_rate)
    };

    let wav = encode_wav(&pcm, sample_rate);
    let audio_b64 = base64::engine::general_purpose::STANDARD.encode(&wav);
    let _ = app.emit("voice-captured", VoiceCapturedPayload {
        audio_b64,
        duration_ms: ended_ms.saturating_sub(started_ms),
    });
}

fn encode_wav(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    let pcm_i16: Vec<i16> = samples.iter()
        .map(|&s| (s * 32767.0).clamp(-32768.0, 32767.0) as i16)
        .collect();
    let data_bytes = pcm_i16.len() * 2;
    let mut buf = Vec::with_capacity(44 + data_bytes);

    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&((36 + data_bytes) as u32).to_le_bytes());
    buf.extend_from_slice(b"WAVE");
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes());
    buf.extend_from_slice(&1u16.to_le_bytes());   // PCM
    buf.extend_from_slice(&1u16.to_le_bytes());   // mono
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&(sample_rate * 2).to_le_bytes()); // byte rate
    buf.extend_from_slice(&2u16.to_le_bytes());   // block align
    buf.extend_from_slice(&16u16.to_le_bytes());  // bits per sample
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&(data_bytes as u32).to_le_bytes());
    for s in &pcm_i16 {
        buf.extend_from_slice(&s.to_le_bytes());
    }
    buf
}
