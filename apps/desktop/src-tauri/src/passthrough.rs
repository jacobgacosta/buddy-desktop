use tauri::{command, AppHandle, Manager};

/// Activa/desactiva el passthrough de mouse.
/// Llamado desde JS cuando el cursor entra/sale del sprite.
#[command]
pub fn set_ignore_cursor(app: AppHandle, ignore: bool) {
    if let Some(window) = app.get_webview_window("buddy") {
        let _ = window.set_ignore_cursor_events(ignore);
    }
}
