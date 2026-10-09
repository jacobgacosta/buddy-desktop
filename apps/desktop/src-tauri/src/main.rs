#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod passthrough;
mod sidecar;

use tauri::Manager;

#[tauri::command]
fn move_window(window: tauri::Window, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn start_drag(window: tauri::Window) -> Result<(f64, f64), String> {
    // start_dragging blocks on Windows until the drag completes
    window.start_dragging().map_err(|e| e.to_string())?;
    // Return the new logical position after drag
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok((pos.x as f64 / scale, pos.y as f64 / scale))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            passthrough::set_ignore_cursor,
            move_window,
            start_drag,
        ])
        .setup(|app| {
            sidecar::launch_sidecar(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                sidecar::kill_sidecar(&window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
