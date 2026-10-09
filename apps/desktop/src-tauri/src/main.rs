#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod passthrough;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![passthrough::set_ignore_cursor])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
