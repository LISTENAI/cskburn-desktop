use std::{fs::File, sync::Mutex};

use adb_client::{ADBDeviceExt, ADBServer};
use tauri::{
    async_runtime::spawn_blocking, ipc::Channel, Manager, Resource, ResourceId, Runtime, Webview,
};

use crate::serialport_watcher::{SerialPortEventHandler, SerialPortWatcher, SerialPortWatcherImpl};

#[derive(serde::Serialize, PartialEq, Eq, Clone)]
pub struct Device {
    identifier: String,
    state: DeviceState,
}

#[derive(serde::Serialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeviceState {
    Offline,
    Device,
    NoDevice,
    Authorizing,
    Unauthorized,
    Connecting,
    NoPerm,
    Detached,
    Bootloader,
    Host,
    Recovery,
    Sideload,
    Rescue,
}

impl From<adb_client::DeviceState> for DeviceState {
    fn from(state: adb_client::DeviceState) -> Self {
        match state {
            adb_client::DeviceState::Offline => DeviceState::Offline,
            adb_client::DeviceState::Device => DeviceState::Device,
            adb_client::DeviceState::NoDevice => DeviceState::NoDevice,
            adb_client::DeviceState::Authorizing => DeviceState::Authorizing,
            adb_client::DeviceState::Unauthorized => DeviceState::Unauthorized,
            adb_client::DeviceState::Connecting => DeviceState::Connecting,
            adb_client::DeviceState::NoPerm => DeviceState::NoPerm,
            adb_client::DeviceState::Detached => DeviceState::Detached,
            adb_client::DeviceState::Bootloader => DeviceState::Bootloader,
            adb_client::DeviceState::Host => DeviceState::Host,
            adb_client::DeviceState::Recovery => DeviceState::Recovery,
            adb_client::DeviceState::Sideload => DeviceState::Sideload,
            adb_client::DeviceState::Rescue => DeviceState::Rescue,
        }
    }
}

#[tauri::command]
pub fn adb_list_devices() -> Vec<Device> {
    let mut server = ADBServer::default();
    server
        .devices()
        .unwrap_or_default()
        .iter()
        .map(|d| Device {
            identifier: d.identifier.clone(),
            state: if d.identifier.starts_with("BOOT-") {
                DeviceState::Recovery
            } else {
                d.state.clone().into()
            },
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
        let mut server = ADBServer::default();
        let mut device = server.get_device_by_name(identifier.as_str())?;

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

#[tauri::command]
pub async fn adb_push(identifier: String, local: String, remote: String) -> crate::Result<()> {
    spawn_blocking(move || {
        let mut device = ADBServer::default().get_device_by_name(identifier.as_str())?;

        let file = File::open(local)?;
        device.push(file, remote)?;

        Ok(())
    })
    .await
    .map_err(|e| crate::Error::from(e))?
}
