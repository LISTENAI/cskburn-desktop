use std::sync::Mutex;

use serialport::available_ports;
use tauri::{ipc::Channel, Manager, Resource, ResourceId, Runtime, Webview};

use crate::serialport_watcher::{SerialPortEventHandler, SerialPortWatcher, SerialPortWatcherImpl};

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

struct WatcherHandler {
    on_event: Channel,
    last_ports: Vec<String>,
}

impl SerialPortEventHandler for WatcherHandler {
    fn handle_event(&mut self) {
        let current_ports = list_ports();
        if current_ports != self.last_ports {
            let _ = self.on_event.send(current_ports.clone());
            self.last_ports = current_ports;
        }
    }
}

pub struct InnerWatcher {
    watcher: SerialPortWatcherImpl,
}

pub struct WatcherResource(Mutex<InnerWatcher>);
impl WatcherResource {
    pub fn new(watcher: SerialPortWatcherImpl) -> Self {
        Self(Mutex::new(InnerWatcher { watcher }))
    }

    fn with_lock<R, F: FnMut(&mut InnerWatcher) -> R>(&self, mut f: F) -> R {
        let mut watcher = self.0.lock().unwrap();
        f(&mut watcher)
    }
}

impl Resource for WatcherResource {}

#[tauri::command]
pub async fn watch_ports<R: Runtime>(webview: Webview<R>, on_event: Channel) -> ResourceId {
    let event_handler = WatcherHandler {
        on_event,
        last_ports: Vec::new(),
    };

    let mut watcher = SerialPortWatcherImpl::new(event_handler);
    watcher.watch();

    webview.resources_table().add(WatcherResource::new(watcher))
}

#[tauri::command]
pub async fn unwatch_ports<R: Runtime>(webview: Webview<R>, rid: ResourceId) -> () {
    let watcher = webview
        .resources_table()
        .take::<WatcherResource>(rid)
        .unwrap();

    WatcherResource::with_lock(&watcher, |watcher| {
        watcher.watcher.unwatch();
    });
}
