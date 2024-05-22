use scopeguard::{guard, ScopeGuard};
use std::fs;
use std::io::{Cursor, Read};
use zip::read::ZipArchive;

use crate::file::TmpFile;

#[derive(serde::Serialize)]
pub struct Partition {
    addr: u32,
    file: TmpFile,
}

#[derive(serde::Deserialize)]
struct Manifest {
    chip: String,
    images: Vec<Image>,
}

#[derive(serde::Deserialize)]
struct Image {
    addr: String,
    file: String,
    md5: String,
}

fn parse_addr(addr: &str) -> Option<u32> {
    if addr.starts_with("0x") {
        if let Ok(parsed) = u32::from_str_radix(&addr[2..], 16) {
            return Some(parsed);
        }
    } else if let Ok(parsed) = addr.parse::<u32>() {
        return Some(parsed);
    }

    None
}

#[tauri::command]
pub fn read_lpk<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    resolver: tauri::State<'_, tauri::path::PathResolver<R>>,
    path: String,
) -> crate::Result<Vec<Partition>> {
    let buffer = fs::read(path).map_err(|e| crate::Error::Io(e))?;
    let mut zip = ZipArchive::new(Cursor::new(buffer))
        .map_err(|_| crate::Error::InvalidLpk("Failed to read archive".to_string()))?;

    let manifest: Manifest = {
        let mut file = zip
            .by_name("manifest.json")
            .map_err(|_| crate::Error::InvalidLpk("Missing manifest.json".to_string()))?;

        let mut content = Vec::new();
        file.read_to_end(&mut content)?;

        serde_json::from_slice(&content)
            .map_err(|_| crate::Error::InvalidLpk("Failed to parse manifest.json".to_string()))?
    };

    // TODO: check chip
    if !manifest.chip.to_lowercase().starts_with("csk6") {
        return Err(crate::Error::InvalidLpk("Chip unsupported".to_string()));
    }

    if manifest.images.is_empty() {
        return Err(crate::Error::InvalidLpk("No images found".to_string()));
    }

    let mut partitions = Vec::new();
    let mut tmp_files = Vec::new();

    for image in manifest.images {
        let addr = parse_addr(&image.addr).ok_or_else(|| {
            crate::Error::InvalidLpk(format!("Invalid address \"{}\"", image.addr))
        })?;

        let path = &image.file[2..];

        let file_content = {
            let mut file = zip
                .by_name(path)
                .map_err(|_| crate::Error::InvalidLpk(format!("Failed to read {}", image.file)))?;

            let mut content = Vec::new();
            file.read_to_end(&mut content)?;

            content
        };

        let actual_md5 = format!("{:x}", md5::compute(&file_content));
        if actual_md5 != image.md5.to_lowercase() {
            return Err(crate::Error::InvalidLpk(format!(
                "MD5 mismatch for {}",
                image.file
            )));
        }

        let file = TmpFile::from(&resolver, path.to_string(), file_content)?;
        tmp_files.push(guard(file.clone(), |file| {
            let _ = file.free();
        }));

        partitions.push(Partition { addr, file });
    }

    for guard in tmp_files {
        ScopeGuard::into_inner(guard);
    }

    Ok(partitions)
}
