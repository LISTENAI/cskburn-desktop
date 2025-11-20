use std::sync::Mutex;

use adb_client::ADBDeviceExt;
use tauri::{
    async_runtime::spawn_blocking, ipc::Channel, Manager, Resource, ResourceId, Runtime, Webview,
};

use crate::{
    adb::ADBDevice,
    serialport_watcher::{SerialPortEventHandler, SerialPortWatcher, SerialPortWatcherImpl},
};

#[derive(serde::Serialize, PartialEq, Eq, Clone)]
pub struct Device {
    identifier: String,
    state: DeviceState,
}

#[derive(serde::Serialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeviceState {
    Device,
    Recovery,
}

#[tauri::command]
pub fn adb_list_devices() -> Vec<Device> {
    ADBDevice::list()
        .iter()
        .map(|device| {
            let identifier = device.identifier();

            let state = if identifier.starts_with("BOOT-") {
                DeviceState::Recovery
            } else {
                DeviceState::Device
            };

            Device {
                identifier: identifier.into(),
                state,
            }
        })
        .collect()
}

struct WatcherHandler {
    on_event: Channel<Vec<Device>>,
    last_devices: Vec<Device>,
}

impl SerialPortEventHandler for WatcherHandler {
    fn handle_event(&mut self) {
        let current_devices = adb_list_devices();
        if current_devices != self.last_devices {
            let _ = self.on_event.send(current_devices.clone());
            self.last_devices = current_devices;
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
pub async fn adb_watch_devices<R: Runtime>(
    webview: Webview<R>,
    on_event: Channel<Vec<Device>>,
) -> ResourceId {
    let event_handler = WatcherHandler {
        on_event,
        last_devices: Vec::new(),
    };

    let mut watcher = SerialPortWatcherImpl::new(event_handler);
    watcher.watch();

    webview.resources_table().add(WatcherResource::new(watcher))
}

#[tauri::command]
pub async fn adb_unwatch_devices<R: Runtime>(webview: Webview<R>, rid: ResourceId) -> () {
    let watcher = webview
        .resources_table()
        .take::<WatcherResource>(rid)
        .unwrap();

    WatcherResource::with_lock(&watcher, |watcher| {
        watcher.watcher.unwatch();
    });
}

#[tauri::command]
pub async fn adb_shell(identifier: String, commands: Vec<String>) -> crate::Result<String> {
    spawn_blocking(move || {
        let mut device = ADBDevice::find(identifier.as_str())
            .ok_or(crate::Error::Rusb(rusb::Error::NoDevice))?
            .adb()?;

        let mut output = Vec::new();

        device.shell_command(
            &commands.iter().map(|s| s.as_str()).collect::<Vec<&str>>(),
            &mut output,
        )?;

        Ok(String::from_utf8_lossy(&output).to_string())
    })
    .await
    .map_err(|e| crate::Error::from(e))?
}
