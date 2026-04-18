use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use futures_util::StreamExt;
use tauri::async_runtime::{spawn, JoinHandle};

use super::{SerialPortEventHandler, SerialPortWatcher};

// macOS USB-to-serial drivers create the tty node a short moment after the
// raw USB device is enumerated, so the hotplug event fires before
// `available_ports()` reports the new port. Re-query once more after this
// delay so attach events are picked up without needing a second trigger.
const ATTACH_SETTLE_DELAY: Duration = Duration::from_millis(500);

pub struct SerialPortHotplugWatcher {
    event_handler: Arc<Mutex<dyn SerialPortEventHandler>>,
    task: Option<JoinHandle<()>>,
}

impl SerialPortWatcher for SerialPortHotplugWatcher {
    fn new<F: SerialPortEventHandler>(event_handler: F) -> Self {
        Self {
            event_handler: Arc::new(Mutex::new(event_handler)),
            task: None,
        }
    }

    fn watch(&mut self) {
        if self.task.is_some() {
            return;
        }

        let event_handler = self.event_handler.clone();

        let handle = spawn(async move {
            trigger(&event_handler);

            let mut watch = match nusb::watch_devices() {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("nusb::watch_devices failed: {e}");
                    return;
                }
            };

            while watch.next().await.is_some() {
                trigger(&event_handler);
                tokio::time::sleep(ATTACH_SETTLE_DELAY).await;
                trigger(&event_handler);
            }
        });

        self.task = Some(handle);
    }

    fn unwatch(&mut self) {
        if let Some(handle) = self.task.take() {
            handle.abort();
        }
    }
}

fn trigger(event_handler: &Arc<Mutex<dyn SerialPortEventHandler>>) {
    let mut h = event_handler.lock().unwrap();
    h.handle_event();
}

impl Drop for SerialPortHotplugWatcher {
    fn drop(&mut self) {
        self.unwatch();
    }
}
