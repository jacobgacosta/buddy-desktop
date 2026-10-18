#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod passthrough;
mod sidecar;
mod sensors;
mod voice;

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn move_window(
    window: tauri::Window,
    state: tauri::State<'_, Arc<Mutex<sensors::InputState>>>,
    x: f64,
    y: f64,
) -> Result<(), String> {
    {
        let mut s = state.lock().unwrap();
        s.win_x = x;
        s.win_y = y;
    }
    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_panels_open(
    state: tauri::State<'_, Arc<Mutex<sensors::InputState>>>,
    open: bool,
) {
    state.lock().unwrap().panels_open = open;
}

#[tauri::command]
fn set_z_order(window: tauri::Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_audio_devices() -> Vec<String> {
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    host.input_devices()
        .map(|devs| devs.filter_map(|d| d.name().ok()).collect())
        .unwrap_or_default()
}

#[tauri::command]
fn set_mic_device(
    config: tauri::State<'_, Arc<Mutex<sensors::MicConfig>>>,
    device_name: String,
) -> Result<(), String> {
    let mut c = config.lock().unwrap();
    c.desired_device = if device_name.is_empty() { None } else { Some(device_name) };
    c.restart = true;
    Ok(())
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
fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

#[tauri::command]
fn set_window_size(window: tauri::Window, w: f64, h: f64) -> Result<(), String> {
    window
        .set_size(tauri::LogicalSize::new(w, h))
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct ScreenInfo {
    index: usize,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    is_primary: bool,
}

fn list_screens_winapi() -> Vec<ScreenInfo> {
    use winapi::shared::minwindef::{BOOL, LPARAM};
    use winapi::shared::windef::{HDC, HMONITOR, LPRECT};
    use winapi::um::winuser::{EnumDisplayMonitors, GetMonitorInfoW, MONITORINFO, MONITORINFOF_PRIMARY};

    struct Col { screens: Vec<ScreenInfo>, idx: usize }

    unsafe extern "system" fn on_monitor(
        hmon: HMONITOR, _hdc: HDC, _rect: LPRECT, data: LPARAM,
    ) -> BOOL {
        let col = &mut *(data as *mut Col);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(hmon, &mut mi) != 0 {
            let r = mi.rcMonitor;
            col.screens.push(ScreenInfo {
                index: col.idx,
                width: (r.right - r.left) as u32,
                height: (r.bottom - r.top) as u32,
                x: r.left,
                y: r.top,
                is_primary: (mi.dwFlags & MONITORINFOF_PRIMARY) != 0,
            });
            col.idx += 1;
        }
        1
    }

    let mut col = Col { screens: Vec::new(), idx: 0 };
    unsafe {
        EnumDisplayMonitors(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            Some(on_monitor),
            &mut col as *mut Col as LPARAM,
        );
    }
    col.screens
}

fn do_capture(win_x: f64, win_y: f64, monitor: String) -> Result<String, String> {
    use winapi::um::wingdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDIBits, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };
    use winapi::um::winuser::{GetDC, ReleaseDC};

    let screens = list_screens_winapi();
    if screens.is_empty() {
        return Err("no screens".into());
    }

    let screen = if monitor == "buddy" {
        screens
            .iter()
            .find(|s| {
                win_x >= s.x as f64
                    && win_x < (s.x + s.width as i32) as f64
                    && win_y >= s.y as f64
                    && win_y < (s.y + s.height as i32) as f64
            })
            .or_else(|| screens.first())
    } else {
        monitor
            .parse::<usize>()
            .ok()
            .and_then(|i| screens.get(i))
            .or_else(|| screens.first())
    }
    .ok_or_else(|| "screen not found".to_string())?;

    let (sx, sy, sw, sh) = (screen.x, screen.y, screen.width as i32, screen.height as i32);
    let (ow, oh) = if sw > 1280 { (1280i32, sh * 1280 / sw) } else { (sw, sh) };

    let rgba = unsafe {
        let hdc_src = GetDC(std::ptr::null_mut());
        if hdc_src.is_null() {
            return Err("GetDC failed".into());
        }
        let hdc_dst = CreateCompatibleDC(hdc_src);
        if hdc_dst.is_null() {
            ReleaseDC(std::ptr::null_mut(), hdc_src);
            return Err("CreateCompatibleDC failed".into());
        }
        let hbmp = CreateCompatibleBitmap(hdc_src, sw, sh);
        if hbmp.is_null() {
            DeleteDC(hdc_dst);
            ReleaseDC(std::ptr::null_mut(), hdc_src);
            return Err("CreateCompatibleBitmap failed".into());
        }
        let prev = SelectObject(hdc_dst, hbmp as *mut _);
        BitBlt(hdc_dst, 0, 0, sw, sh, hdc_src, sx, sy, SRCCOPY);

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = sw;
        bmi.bmiHeader.biHeight = -sh;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut bgra = vec![0u8; (sw * sh * 4) as usize];
        GetDIBits(hdc_dst, hbmp, 0, sh as u32, bgra.as_mut_ptr() as *mut _, &mut bmi, DIB_RGB_COLORS);

        SelectObject(hdc_dst, prev);
        DeleteObject(hbmp as *mut _);
        DeleteDC(hdc_dst);
        ReleaseDC(std::ptr::null_mut(), hdc_src);

        if ow == sw && oh == sh {
            let mut v = bgra;
            for c in v.chunks_exact_mut(4) { c.swap(0, 2); c[3] = 255; }
            v
        } else {
            let mut v = vec![0u8; (ow * oh * 4) as usize];
            for oy in 0..oh as usize {
                for ox in 0..ow as usize {
                    let ix = ox * sw as usize / ow as usize;
                    let iy = oy * sh as usize / oh as usize;
                    let s = (iy * sw as usize + ix) * 4;
                    let d = (oy * ow as usize + ox) * 4;
                    v[d] = bgra[s + 2]; v[d + 1] = bgra[s + 1]; v[d + 2] = bgra[s]; v[d + 3] = 255;
                }
            }
            v
        }
    };

    let mut png_bytes = Vec::<u8>::new();
    {
        let mut enc = png::Encoder::new(std::io::Cursor::new(&mut png_bytes), ow as u32, oh as u32);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        let mut w = enc.write_header().map_err(|e| e.to_string())?;
        w.write_image_data(&rgba).map_err(|e| e.to_string())?;
    }

    use base64::Engine as _;
    Ok(base64::engine::general_purpose::STANDARD.encode(&png_bytes))
}

#[tauri::command]
fn get_screens() -> Vec<ScreenInfo> {
    list_screens_winapi()
}

#[tauri::command]
async fn capture_screen(
    state: tauri::State<'_, Arc<Mutex<sensors::InputState>>>,
    monitor: String,
) -> Result<String, String> {
    let (win_x, win_y) = {
        let s = state.lock().unwrap();
        (s.win_x, s.win_y)
    };
    tauri::async_runtime::spawn_blocking(move || do_capture(win_x, win_y, monitor))
        .await
        .map_err(|e| e.to_string())?
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("buddy") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            passthrough::set_ignore_cursor,
            move_window,
            set_window_size,
            open_devtools,
            get_monitor_bounds,
            set_anchor,
            set_z_order,
            get_audio_devices,
            set_mic_device,
            set_panels_open,
            get_screens,
            capture_screen,
        ])
        .setup(|app| {
            app.manage(Mutex::new(TrayState { is_anchored: false }));
            sidecar::launch_sidecar(app);
            let (mic_config, sensor_state) = sensors::launch_sensors(app.handle().clone());
            app.manage(mic_config);
            let sensor_state_voice = Arc::clone(&sensor_state);
            app.manage(sensor_state);
            voice::launch_voice(app.handle().clone(), sensor_state_voice);

            // Ctrl+Shift+Space → show window + open chat
            let shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::Space,
            );
            if let Err(e) = app.handle().global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(win) = app.get_webview_window("buddy") {
                        let _ = win.show();
                        let _ = win.set_focus();
                        let _ = app.emit("open-chat", ());
                    }
                }
            }) {
                eprintln!("[buddy] global shortcut register failed: {e}");
            }

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
