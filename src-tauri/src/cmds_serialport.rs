use serialport::available_ports;

#[tauri::command]
pub fn list_ports() -> Vec<String> {
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
