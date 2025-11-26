use std::{fs, io::Read};

#[tauri::command]
pub fn md5(path: String) -> crate::Result<String> {
    let mut file = fs::File::open(path)?;

    let mut content = Vec::new();
    file.read_to_end(&mut content)?;

    Ok(format!("{:x}", md5::compute(&content)))
}
