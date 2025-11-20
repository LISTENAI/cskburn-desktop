use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Adb(#[from] adb_client::RustADBError),
    #[error(transparent)]
    Rusb(#[from] rusb::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error("Invalid LPK: {0}")]
    InvalidLpk(String),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
