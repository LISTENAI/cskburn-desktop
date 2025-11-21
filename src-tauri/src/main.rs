// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cmds_adb;
mod cmds_hex;
mod cmds_lpk;
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
            cmds_adb::adb_list_devices,
            cmds_adb::adb_watch_devices,
            cmds_adb::adb_unwatch_devices,
            cmds_adb::adb_shell,
            cmds_adb::adb_push,
            cmds_string::decode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
