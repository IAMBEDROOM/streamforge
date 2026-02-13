use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

// ---------------------------------------------------------------------------
// Managed State
// ---------------------------------------------------------------------------

/// Holds the port number reported by the sidecar server.
/// `None` means the port hasn't been received yet.
/// Wrapped in Arc so we can share it with the background reader thread.
struct ServerPort(Arc<Mutex<Option<u16>>>);

/// Holds the sidecar child process handle so we can kill it on exit.
struct SidecarProcess(Mutex<Option<CommandChild>>);

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// Returns the sidecar server port to the frontend.
/// Errors if the port hasn't been received from the sidecar yet.
#[tauri::command]
fn get_server_port(state: tauri::State<'_, ServerPort>) -> Result<u16, String> {
    let port = state
        .0
        .lock()
        .map_err(|e| format!("Failed to read server port: {}", e))?;

    port.ok_or_else(|| "Server port not available yet".to_string())
}

// ---------------------------------------------------------------------------
// Sidecar Management
// ---------------------------------------------------------------------------

/// Spawns the sidecar binary and wires up stdout parsing + state storage.
fn start_sidecar(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shell = app.shell();

    let command = shell.sidecar("binaries/streamforge-server").map_err(|e| {
        format!(
            "Failed to create sidecar command: {}. \
             Make sure the binary exists in src-tauri/binaries/",
            e
        )
    })?;

    let (mut rx, child) = command.spawn().map_err(|e| {
        format!(
            "Failed to spawn sidecar process: {}. \
             The binary may be missing or not executable.",
            e
        )
    })?;

    // Store the child handle so we can kill it on app exit
    let sidecar_state = app.state::<SidecarProcess>();
    {
        let mut handle = sidecar_state.0.lock().unwrap();
        *handle = Some(child);
    }

    // Clone the inner Mutex (via Arc-like managed state) for the background thread
    let port_state = app.state::<ServerPort>().inner().0.clone();

    // Spawn a background thread to read sidecar stdout/stderr lines
    std::thread::spawn(move || {
        use tauri_plugin_shell::process::CommandEvent;

        // Block on the receiver -- it yields until the sidecar exits
        while let Some(event) = rx.blocking_recv() {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    let trimmed = text.trim();

                    // Parse the port announcement line
                    if let Some(port_str) = trimmed.strip_prefix("SERVER_PORT=") {
                        if let Ok(port) = port_str.parse::<u16>() {
                            if let Ok(mut p) = port_state.lock() {
                                *p = Some(port);
                            }
                            println!("[Tauri] Sidecar server port: {}", port);
                        } else {
                            eprintln!("[Tauri] Failed to parse port from sidecar: {:?}", port_str);
                        }
                    } else {
                        // Forward other sidecar stdout for debugging
                        println!("[Sidecar] {}", trimmed);
                    }
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    eprintln!("[Sidecar:err] {}", text.trim());
                }
                CommandEvent::Terminated(payload) => {
                    println!(
                        "[Tauri] Sidecar process terminated (code: {:?}, signal: {:?})",
                        payload.code, payload.signal
                    );
                    break;
                }
                CommandEvent::Error(err) => {
                    eprintln!("[Tauri] Sidecar command error: {}", err);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// App Entry Point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ServerPort(Arc::new(Mutex::new(None))))
        .manage(SidecarProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_server_port])
        .setup(|app| {
            if let Err(e) = start_sidecar(app) {
                eprintln!("[Tauri] Sidecar startup failed: {}", e);
                // Don't crash the app -- the frontend will show an error
                // when it can't get the port.
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building StreamForge");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // Gracefully kill the sidecar when the app exits
            let state = app_handle.state::<SidecarProcess>();
            let mut child_opt = match state.0.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };
            if let Some(child) = child_opt.take() {
                println!("[Tauri] Shutting down sidecar...");
                if let Err(e) = child.kill() {
                    eprintln!("[Tauri] Failed to kill sidecar: {}", e);
                }
                // Give the sidecar a moment to clean up
                std::thread::sleep(Duration::from_millis(500));
            }
        }
    });
}
