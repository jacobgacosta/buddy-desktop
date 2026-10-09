use tauri::Manager;

pub fn launch_sidecar(app: &tauri::App) {
    let resource_path = app
        .path()
        .resource_dir()
        .expect("no resource dir");

    let sidecar_path = resource_path.join("buddy-server");
    let avatars_dir = resource_path.join("avatars");

    std::thread::spawn(move || {
        let _ = std::process::Command::new(&sidecar_path)
            .env("PORT", "7788")
            .env("AVATARS_DIR", avatars_dir.to_str().unwrap_or("avatars"))
            .spawn();
    });
}
