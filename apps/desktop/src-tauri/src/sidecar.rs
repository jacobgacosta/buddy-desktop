use std::process::Child;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct SidecarProcess(pub Mutex<Option<Child>>);

pub fn launch_sidecar(app: &tauri::App) {
    let resource_path = app
        .path()
        .resource_dir()
        .expect("no resource dir");

    let sidecar_path = resource_path.join(binary_name());
    let avatars_dir = resource_path.join("avatars");

    let child = match std::process::Command::new(&sidecar_path)
        .env("PORT", "7788")
        .env("AVATARS_DIR", avatars_dir.to_str().unwrap_or("avatars"))
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[buddy] sidecar not launched ({e}): {sidecar_path:?} — start buddy-server manually");
            return;
        }
    };

    app.manage(SidecarProcess(Mutex::new(Some(child))));
}

pub fn kill_sidecar(app: &AppHandle) {
    if let Some(state) = app.try_state::<SidecarProcess>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[cfg(all(target_arch = "x86_64", target_os = "windows", target_env = "msvc"))]
fn binary_name() -> &'static str { "buddy-server-x86_64-pc-windows-msvc.exe" }
#[cfg(all(target_arch = "x86_64", target_os = "windows", target_env = "gnu"))]
fn binary_name() -> &'static str { "buddy-server-x86_64-pc-windows-gnu.exe" }
#[cfg(all(target_arch = "aarch64", target_os = "macos"))]
fn binary_name() -> &'static str { "buddy-server-aarch64-apple-darwin" }
#[cfg(all(target_arch = "x86_64", target_os = "macos"))]
fn binary_name() -> &'static str { "buddy-server-x86_64-apple-darwin" }
#[cfg(all(target_arch = "x86_64", target_os = "linux"))]
fn binary_name() -> &'static str { "buddy-server-x86_64-unknown-linux-gnu" }
#[cfg(all(target_arch = "aarch64", target_os = "linux"))]
fn binary_name() -> &'static str { "buddy-server-aarch64-unknown-linux-gnu" }
