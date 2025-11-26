// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cmds_hex;
mod cmds_lpk;
mod cmds_md5;
mod cmds_serialport;
mod cmds_string;
mod error;
mod file;
mod serialport_watcher;

pub use error::Error;
type Result<T> = std::result::Result<T, Error>;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmds_hex::read_hex,
            cmds_lpk::read_lpk,
            cmds_serialport::list_ports,
            cmds_serialport::watch_ports,
            cmds_serialport::unwatch_ports,
            cmds_string::decode,
            cmds_md5::md5,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
