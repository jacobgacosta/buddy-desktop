use tauri::{command, AppHandle, Manager};

#[command]
pub fn set_ignore_cursor(app: AppHandle, ignore: bool) -> Result<(), String> {
    app.get_webview_window("buddy")
        .ok_or_else(|| "Window 'buddy' not found".to_string())?
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}
