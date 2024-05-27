use std::{
    sync::{Arc, Mutex},
    thread::{sleep, spawn},
    time::Duration,
};

use super::{SerialPortEventHandler, SerialPortWatcher};

pub struct SerialPortPollWatcher {
    polling: Arc<Mutex<bool>>,
    event_handler: Arc<Mutex<dyn SerialPortEventHandler>>,
}

impl SerialPortWatcher for SerialPortPollWatcher {
    fn new<F: SerialPortEventHandler>(event_handler: F) -> Self {
        Self {
            polling: Arc::new(Mutex::new(false)),
            event_handler: Arc::new(Mutex::new(event_handler)),
        }
    }

    fn watch(&mut self) -> () {
        let polling = self.polling.clone();
        let event_handler = self.event_handler.clone();

        spawn(move || {
            let mut is_polling = polling.lock().unwrap();
            *is_polling = true;
            drop(is_polling);

            loop {
                let is_polling = polling.lock().unwrap();
                if !*is_polling {
                    break;
                }
                drop(is_polling);

                let mut event_handler = event_handler.lock().unwrap();
                event_handler.handle_event();
                drop(event_handler);

                sleep(Duration::from_secs(1));
            }
        });
    }

    fn unwatch(&mut self) -> () {
        let mut polling = self.polling.lock().unwrap();
        *polling = false;
    }
}

impl Drop for SerialPortPollWatcher {
    fn drop(&mut self) {
        let _ = self.unwatch();
    }
}
