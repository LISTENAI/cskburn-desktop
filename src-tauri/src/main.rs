// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serialport::available_ports;

#[cfg(target_os = "windows")]
use codepage::to_encoding;
#[cfg(target_os = "windows")]
use windows::Win32::Globalization::GetACP;

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

#[tauri::command]
fn decode(data: Vec<u8>) -> String {
    #[cfg(target_os = "windows")]
    {
        let code_page = unsafe { GetACP() as u32 };
        if let Some(encoding) = to_encoding(code_page.try_into().unwrap()) {
            let (decoded, _, had_errors) = encoding.decode(&data);
            if !had_errors {
                return decoded.into_owned();
            }
        }
    }

    String::from_utf8_lossy(&data).to_string()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_ports, decode])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
