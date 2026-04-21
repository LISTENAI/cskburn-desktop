use chrono::{Local, NaiveDateTime, TimeZone};
use scopeguard::{guard, ScopeGuard};
use std::fs;
use std::io::{Cursor, Read};
use std::path::Path;
use zip::read::{ZipArchive, ZipFile};

use crate::file::TmpFile;

#[derive(serde::Serialize)]
pub struct LpkMeta {
    chip: String,
    partitions: Vec<PartitionMeta>,
}

#[derive(serde::Serialize)]
pub struct PartitionMeta {
    addr: u32,
    name: String,
    size: u32,
    mtime: u64,
    md5: String,
}

#[derive(serde::Serialize)]
pub struct ExtractedPartition {
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

fn entry_mtime<R: Read>(file: &ZipFile<'_, R>) -> crate::Result<u64> {
    file.last_modified()
        .and_then(|t| NaiveDateTime::try_from(t).ok())
        .and_then(|naive| Local.from_local_datetime(&naive).single())
        .map(|dt| dt.timestamp_millis() as u64)
        .ok_or_else(|| crate::Error::InvalidLpk(format!("Failed to get mtime for {}", file.name())))
}

fn entry_path(image: &Image) -> &str {
    &image.file[2..]
}

fn entry_name(image: &Image) -> String {
    let path = entry_path(image);
    Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string()
}

fn open_lpk(path: &str) -> crate::Result<(ZipArchive<Cursor<Vec<u8>>>, Manifest)> {
    let buffer = fs::read(path).map_err(crate::Error::Io)?;
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

    if manifest.images.is_empty() {
        return Err(crate::Error::InvalidLpk("No images found".to_string()));
    }

    Ok((zip, manifest))
}

#[tauri::command]
pub fn inspect_lpk(path: String) -> crate::Result<LpkMeta> {
    let (mut zip, manifest) = open_lpk(&path)?;

    let mut partitions = Vec::with_capacity(manifest.images.len());

    for image in &manifest.images {
        let addr = parse_addr(&image.addr).ok_or_else(|| {
            crate::Error::InvalidLpk(format!("Invalid address \"{}\"", image.addr))
        })?;

        let entry = zip
            .by_name(entry_path(image))
            .map_err(|_| crate::Error::InvalidLpk(format!("Failed to read {}", image.file)))?;

        let size = u32::try_from(entry.size()).map_err(|_| {
            crate::Error::InvalidLpk(format!("Entry {} is too large", image.file))
        })?;
        let mtime = entry_mtime(&entry)?;

        partitions.push(PartitionMeta {
            addr,
            name: entry_name(image),
            size,
            mtime,
            md5: image.md5.to_lowercase(),
        });
    }

    Ok(LpkMeta {
        chip: manifest.chip,
        partitions,
    })
}

#[tauri::command]
pub fn extract_lpk<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    resolver: tauri::State<'_, tauri::path::PathResolver<R>>,
    path: String,
) -> crate::Result<Vec<ExtractedPartition>> {
    let (mut zip, manifest) = open_lpk(&path)?;

    let mut partitions = Vec::with_capacity(manifest.images.len());
    let mut tmp_files = Vec::new();

    for image in manifest.images {
        let addr = parse_addr(&image.addr).ok_or_else(|| {
            crate::Error::InvalidLpk(format!("Invalid address \"{}\"", image.addr))
        })?;

        let entry_path = entry_path(&image).to_string();

        let (content, mtime) = {
            let mut file = zip
                .by_name(&entry_path)
                .map_err(|_| crate::Error::InvalidLpk(format!("Failed to read {}", image.file)))?;

            let mut content = Vec::new();
            file.read_to_end(&mut content)?;

            let mtime = entry_mtime(&file)?;

            (content, mtime)
        };

        let actual_md5 = format!("{:x}", md5::compute(&content));
        if actual_md5 != image.md5.to_lowercase() {
            return Err(crate::Error::InvalidLpk(format!(
                "MD5 mismatch for {}",
                image.file
            )));
        }

        let file = TmpFile::from(&resolver, entry_path, content, mtime)?;
        tmp_files.push(guard(file.clone(), |file| {
            let _ = file.free();
        }));

        partitions.push(ExtractedPartition { addr, file });
    }

    for guard in tmp_files {
        ScopeGuard::into_inner(guard);
    }

    Ok(partitions)
}
