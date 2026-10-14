#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod passthrough;
mod sidecar;
mod sensors;

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[tauri::command]
fn move_window(window: tauri::Window, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_z_order(window: tauri::Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_monitor_bounds(window: tauri::Window) -> Result<(f64, f64, f64, f64), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let sf = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();
    Ok((
        pos.x as f64 / sf,
        pos.y as f64 / sf,
        size.width as f64 / sf,
        size.height as f64 / sf,
    ))
}

struct TrayState {
    is_anchored: bool,
}

/// Genera un ícono 32×32 naranja (#FF6B35) sin necesitar archivo externo.
fn make_tray_icon() -> Image<'static> {
    const SIZE: u32 = 32;
    let mut rgba = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for _ in 0..SIZE * SIZE {
        rgba.extend_from_slice(&[0xFF, 0x6B, 0x35, 0xFF]);
    }
    Image::new_owned(rgba, SIZE, SIZE)
}

/// Reconstruye el menú del tray con los labels correctos según el estado actual.
fn update_tray_menu(app: &AppHandle, is_visible: bool, is_anchored: bool) {
    let show_text = if is_visible { "Ocultar" } else { "Mostrar" };
    let anchor_text = if is_anchored { "Desanclar" } else { "Anclar" };

    let Ok(show_hide) = MenuItem::with_id(app, "show_hide", show_text, true, None::<&str>) else { return };
    let Ok(anchor)    = MenuItem::with_id(app, "anchor", anchor_text, true, None::<&str>) else { return };
    let Ok(quit)      = MenuItem::with_id(app, "quit", "Cerrar Buddy", true, None::<&str>) else { return };
    let Ok(sep)       = PredefinedMenuItem::separator(app) else { return };

    if let Ok(menu) = Menu::with_items(app, &[&show_hide, &anchor, &sep, &quit]) {
        if let Some(tray) = app.tray_by_id("buddy-tray") {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

#[tauri::command]
fn set_anchor(app: tauri::AppHandle, anchored: bool) -> Result<(), String> {
    {
        let state = app.state::<Mutex<TrayState>>();
        state.lock().unwrap().is_anchored = anchored;
    }
    let visible = app.get_webview_window("buddy")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(true);
    update_tray_menu(&app, visible, anchored);
    Ok(())
}

/// Toggles the window visibility and updates the tray menu accordingly.
fn toggle_window_visibility(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("buddy") {
        let visible = win.is_visible().unwrap_or(true);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
        let anchored = app
            .state::<Mutex<TrayState>>()
            .lock().unwrap()
            .is_anchored;
        update_tray_menu(app, !visible, anchored);
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            passthrough::set_ignore_cursor,
            move_window,
            get_monitor_bounds,
            set_anchor,
            set_z_order,
        ])
        .setup(|app| {
            app.manage(Mutex::new(TrayState { is_anchored: false }));
            sidecar::launch_sidecar(app);
            sensors::launch_sensors(app.handle().clone());

            let icon = make_tray_icon();

            let show_hide = MenuItem::with_id(app, "show_hide", "Ocultar", true, None::<&str>)?;
            let anchor    = MenuItem::with_id(app, "anchor", "Anclar", true, None::<&str>)?;
            let quit      = MenuItem::with_id(app, "quit", "Cerrar Buddy", true, None::<&str>)?;
            let sep       = PredefinedMenuItem::separator(app)?;
            let menu      = Menu::with_items(app, &[&show_hide, &anchor, &sep, &quit])?;

            TrayIconBuilder::with_id("buddy-tray")
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_hide" => toggle_window_visibility(app),
                    "anchor" => {
                        let new_anchored = {
                            let state = app.state::<Mutex<TrayState>>();
                            let mut s = state.lock().unwrap();
                            s.is_anchored = !s.is_anchored;
                            s.is_anchored
                        };
                        let _ = app.emit("anchor-changed", new_anchored);
                        let visible = app.get_webview_window("buddy")
                            .and_then(|w| w.is_visible().ok())
                            .unwrap_or(true);
                        update_tray_menu(app, visible, new_anchored);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        toggle_window_visibility(app);
                    }
                })
                .build(app)?;

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
