// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // -----------------------------------------------------------------------
    // System Tray — Phase 8
    //
    // TODO: Implement system tray integration here. Planned features:
    //   - Tray icon with StreamForge branding
    //   - Right-click context menu: Show/Hide window, Start/Stop server, Quit
    //   - Minimise-to-tray behaviour (close button hides to tray)
    //   - Tray icon badge/indicator for server connection status
    //   - Native notifications for stream events (new follower, sub, etc.)
    //
    // Tauri v2 tray API:
    //   use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
    //   let tray = TrayIconBuilder::new()
    //       .icon(app.default_window_icon().unwrap().clone())
    //       .menu(&menu)
    //       .on_menu_event(|app, event| { ... })
    //       .on_tray_icon_event(|tray, event| { ... })
    //       .build(app)?;
    //
    // See: https://v2.tauri.app/learn/system-tray/
    // -----------------------------------------------------------------------

    streamforge_lib::run()
}
