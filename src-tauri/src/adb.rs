use std::{
    fs::File,
    io::{self, Read},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::{sleep, spawn},
    time::Duration,
};

use adb_client::{
    is_adb_device, ADBDeviceExt, ADBServer, ADBUSBDevice, RustADBError, USBTransport,
};
use rusb::GlobalContext;

pub struct ADBDevice {
    identifier: String,
    device: rusb::Device<GlobalContext>,
}

impl ADBDevice {
    pub fn list() -> Vec<ADBDevice> {
        let Ok(devices) = rusb::devices() else {
            return Vec::new();
        };

        devices
            .iter()
            .filter_map(|device| ADBDevice::try_from(device).ok())
            .collect()
    }

    pub fn find(identifier: &str) -> Option<ADBDevice> {
        Self::list()
            .into_iter()
            .find(|d| d.identifier == identifier)
    }

    pub fn identifier(&self) -> &str {
        &self.identifier
    }

    fn adb_once(&self) -> Result<ADBUSBDevice, RustADBError> {
        let transport = USBTransport::new_from_device(self.device.clone());
        ADBUSBDevice::new_from_transport(transport, None)
    }

    pub fn adb(&self) -> Result<ADBUSBDevice, RustADBError> {
        match self.adb_once() {
            Ok(adb) => Ok(adb),
            Err(RustADBError::UsbError(rusb::Error::Access)) => {
                let mut server = ADBServer::default();
                server.kill()?;
                sleep(Duration::from_millis(500));
                self.adb_once()
            }
            Err(e) => Err(e),
        }
    }

    pub fn push<F: ADBDeviceTransferEventHandler>(
        &self,
        local_path: &str,
        remote_path: &str,
        event_handler: F,
    ) -> Result<ADBDevicePushTransfer, RustADBError> {
        let mut transfer = ADBDevicePushTransfer::new(event_handler);
        transfer.push(self, local_path, remote_path)?;
        Ok(transfer)
    }
}

impl TryFrom<rusb::Device<GlobalContext>> for ADBDevice {
    type Error = rusb::Error;

    fn try_from(device: rusb::Device<GlobalContext>) -> Result<Self, Self::Error> {
        let desc = device.device_descriptor()?;

        let handle = device.open()?;
        let serial = handle.read_serial_number_string_ascii(&desc)?;

        if !is_adb_device(&device, &desc) {
            return Err(rusb::Error::NotFound);
        }

        Ok(ADBDevice {
            identifier: serial,
            device,
        })
    }
}

struct ProgressReader<R: Read, F: FnMut(usize, usize)> {
    inner: R,
    total_size: usize,
    read_size: usize,
    cancelled: Arc<AtomicBool>,
    on_progress: F,
}

impl<R: Read, F: FnMut(usize, usize)> ProgressReader<R, F> {
    fn new(inner: R, total_size: usize, cancelled: Arc<AtomicBool>, on_progress: F) -> Self {
        Self {
            inner,
            total_size,
            read_size: 0,
            cancelled,
            on_progress,
        }
    }
}

impl<R: Read, F: FnMut(usize, usize)> Read for ProgressReader<R, F> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if self.cancelled.load(Ordering::Relaxed) {
            return Err(io::Error::new(io::ErrorKind::Interrupted, "cancelled"));
        }

        let bytes_read = self.inner.read(buf)?;
        if bytes_read == 0 {
            return Ok(0);
        }

        self.read_size += bytes_read;
        (self.on_progress)(self.read_size, self.total_size);
        Ok(bytes_read)
    }
}

pub trait ADBDeviceTransferEventHandler: Send + 'static {
    fn on_progress(&mut self, read_size: usize, total_size: usize);
    fn on_complete(&mut self);
    fn on_error(&mut self, error: RustADBError);
}

pub struct ADBDevicePushTransfer {
    cancelled: Arc<AtomicBool>,
    event_handler: Arc<Mutex<dyn ADBDeviceTransferEventHandler>>,
}

impl ADBDevicePushTransfer {
    pub fn new<F: ADBDeviceTransferEventHandler>(event_handler: F) -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
            event_handler: Arc::new(Mutex::new(event_handler)),
        }
    }

    pub fn push(
        &mut self,
        device: &ADBDevice,
        local_path: &str,
        remote_path: &str,
    ) -> Result<(), RustADBError> {
        let cancelled = self.cancelled.clone();
        let event_handler = self.event_handler.clone();

        cancelled.store(false, Ordering::Relaxed);

        let mut device = device.adb()?;
        let local_file = File::open(Path::new(local_path))?;
        let total_size = local_file.metadata()?.len() as usize;
        let remote_path = remote_path.to_string();

        spawn(move || {
            let mut reader = ProgressReader::new(
                local_file,
                total_size,
                cancelled,
                |read_size, total_size| {
                    let mut event_handler = event_handler.lock().unwrap();
                    event_handler.on_progress(read_size, total_size);
                },
            );

            match device.push(&mut reader, &remote_path) {
                Ok(_) => {
                    let mut event_handler = event_handler.lock().unwrap();
                    event_handler.on_complete();
                }
                Err(e) => {
                    let mut event_handler = event_handler.lock().unwrap();
                    event_handler.on_error(e);
                }
            }
        });

        Ok(())
    }

    pub fn cancel(&mut self) -> () {
        self.cancelled.store(true, Ordering::Relaxed);
    }
}
