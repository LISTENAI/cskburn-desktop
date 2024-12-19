use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use std::io::{Error, ErrorKind};
use std::path::PathBuf;
use tauri::path::{BaseDirectory, PathResolver};

#[derive(Clone, serde::Serialize)]
pub struct TmpFile {
    path: String,
    name: String,
    size: u32,
    mtime: u64,
}

fn ensure_tmp_dir<R: tauri::Runtime>(resolver: &PathResolver<R>) -> Result<PathBuf, Error> {
    let tmp_dir =
        PathResolver::resolve(resolver, "unpacked", BaseDirectory::AppCache).map_err(|e| {
            Error::new(
                ErrorKind::InvalidInput,
                format!("Failed to resolve tmp dir: {}", e),
            )
        })?;

    std::fs::create_dir_all(tmp_dir.clone())?;

    Ok(tmp_dir)
}

fn generate_tmp_file_name() -> String {
    let mut rng = thread_rng();
    let name: String = (0..10).map(|_| rng.sample(Alphanumeric) as char).collect();
    format!("{}.bin", name)
}

impl TmpFile {
    pub fn from<R: tauri::Runtime>(
        resolver: &PathResolver<R>,
        pseudo_path: String,
        content: Vec<u8>,
        mtime: u64,
    ) -> Result<Self, Error> {
        let tmp_dir = ensure_tmp_dir(resolver)?;

        let path = tmp_dir
            .join(generate_tmp_file_name())
            .to_str()
            .unwrap()
            .to_string();

        let name = PathBuf::from(pseudo_path)
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        let size = content.len() as u32;

        std::fs::write(path.clone(), content)?;

        Ok(Self {
            path,
            name,
            size,
            mtime,
        })
    }

    pub fn free(&self) -> Result<(), Error> {
        std::fs::remove_file(&self.path)
    }
}
