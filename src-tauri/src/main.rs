// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serialport::available_ports;

#[tauri::command]
fn list_ports() -> Vec<String> {
    match available_ports() {
        Ok(ports) => ports
            .into_iter()
            .map(|p| p.port_name)
            .filter(|p| {
                if cfg!(target_os = "linux") {
                    p.starts_with("/dev/ttyUSB") || p.starts_with("/dev/ttyACM")
                } else if cfg!(target_os = "macos") {
                    p.starts_with("/dev/cu.usb")
                } else {
                    true
                }
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_ports])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
