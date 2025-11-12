use adb_client::{is_adb_device, ADBUSBDevice, RustADBError, USBTransport};
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

    pub fn adb(&self) -> Result<ADBUSBDevice, RustADBError> {
        let transport = USBTransport::new_from_device(self.device.clone());
        ADBUSBDevice::new_from_transport(transport, None)
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
