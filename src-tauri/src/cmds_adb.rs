use std::{fs::File, io::Read, path::Path, sync::Mutex};

use adb_client::{ADBDeviceExt, ADBServer};
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

struct ProgressReader<R: Read, F: FnMut(usize, usize)> {
    inner: R,
    total_size: usize,
    read_size: usize,
    on_progress: F,
}

impl<R: Read, F: FnMut(usize, usize)> ProgressReader<R, F> {
    fn new(inner: R, total_size: usize, on_progress: F) -> Self {
        Self {
            inner,
            total_size,
            read_size: 0,
            on_progress,
        }
    }
}

impl<R: Read, F: FnMut(usize, usize)> Read for ProgressReader<R, F> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let bytes_read = self.inner.read(buf)?;
        self.read_size += bytes_read;
        (self.on_progress)(self.read_size, self.total_size);
        Ok(bytes_read)
    }
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
pub async fn adb_kill_server() -> crate::Result<()> {
    spawn_blocking(move || {
        let mut server = ADBServer::default();
        server.kill()?;
        Ok(())
    })
    .await
    .map_err(|e| crate::Error::from(e))?
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

#[tauri::command]
pub fn adb_push(identifier: &str, local: &str, remote: &str) -> crate::Result<()> {
    let mut device = ADBDevice::find(identifier)
        .ok_or(crate::Error::Rusb(rusb::Error::NoDevice))?
        .adb()?;

    let file = File::open(Path::new(local))?;
    let total_size = file.metadata()?.len() as usize;

    let mut reader = ProgressReader::new(file, total_size, |read_size, total_size| {
        println!("Pushed {}/{} bytes", read_size, total_size);
    });

    println!(
        "Pushing file to device {} {:?}: {} -> {}",
        identifier, device, local, remote
    );

    device.push(&mut reader, &remote)?;

    Ok(())
}
