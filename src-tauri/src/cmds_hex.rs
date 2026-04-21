use ihex::{Reader, Record};
use scopeguard::{guard, ScopeGuard};
use std::fs::{metadata, read_to_string};
use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::file::TmpFile;

const FLASH_ALIGN: u32 = 4 * 1024;

fn align_down(addr: u32, align: u32) -> u32 {
    addr - (addr % align)
}

#[derive(serde::Serialize)]
pub struct HexMeta {
    sections: Vec<SectionMeta>,
}

#[derive(serde::Serialize)]
pub struct SectionMeta {
    address: u32,
    name: String,
    size: u32,
    mtime: u64,
}

#[derive(serde::Serialize)]
pub struct ExtractedSection {
    address: u32,
    file: TmpFile,
}

struct RawSection {
    address: u32,
    data: Vec<u8>,
}

struct HexState {
    extended: u32,
    address: u32,
    buffer: Vec<u8>,
}

impl HexState {
    fn push_section(&mut self, sections: &mut Vec<RawSection>) {
        if self.buffer.is_empty() {
            return;
        }

        if let Some(last) = sections.last_mut() {
            let last_end = last.address + last.data.len() as u32;
            if align_down(self.address, FLASH_ALIGN) <= last_end {
                if self.address > last_end {
                    last.data.resize(
                        last.data.len() + (self.address - last_end) as usize,
                        0xFF,
                    );
                }
                last.data.append(&mut self.buffer);
                return;
            }
        }

        sections.push(RawSection {
            address: self.address,
            data: std::mem::take(&mut self.buffer),
        });
    }

    fn switch_extended(&mut self, sections: &mut Vec<RawSection>, next_extend: u32) {
        let current_end = self.address + self.buffer.len() as u32;
        if current_end == next_extend {
            self.extended = next_extend;
        } else {
            self.push_section(sections);
            self.extended = next_extend;
            self.address = next_extend;
        }
    }
}

fn parse_hex(path: &str) -> crate::Result<(Vec<RawSection>, u64, String)> {
    let basename = Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("hex")
        .to_string();
    let mtime = metadata(path)?
        .modified()?
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let content = read_to_string(path).map_err(crate::Error::Io)?;
    let reader = Reader::new(&content);

    let mut raw_sections: Vec<RawSection> = Vec::new();
    let mut state = HexState {
        extended: 0,
        address: 0,
        buffer: Vec::new(),
    };

    for record in reader {
        match record {
            Ok(Record::Data { offset, value }) => {
                let address = state.extended + offset as u32;
                let current_end = state.address + state.buffer.len() as u32;
                if current_end != address {
                    state.push_section(&mut raw_sections);
                    state.address = address;
                }
                state.buffer.extend_from_slice(&value);
            }
            Ok(Record::EndOfFile) => {
                state.push_section(&mut raw_sections);
            }
            Ok(Record::ExtendedSegmentAddress(segment)) => {
                state.switch_extended(&mut raw_sections, (segment as u32) << 4);
            }
            Ok(Record::ExtendedLinearAddress(segment)) => {
                state.switch_extended(&mut raw_sections, (segment as u32) << 16);
            }
            Ok(Record::StartSegmentAddress { .. }) | Ok(Record::StartLinearAddress(_)) => {
                // Start address records describe execution entry; irrelevant for flashing.
            }
            Err(e) => {
                return Err(crate::Error::InvalidHex(e.to_string()));
            }
        }
    }

    Ok((raw_sections, mtime, basename))
}

fn section_name(basename: &str, address: u32) -> String {
    format!("{}.{:08x}.bin", basename, address)
}

#[tauri::command]
pub fn inspect_hex(path: String) -> crate::Result<HexMeta> {
    let (raw_sections, mtime, basename) = parse_hex(&path)?;

    let sections = raw_sections
        .into_iter()
        .map(|raw| SectionMeta {
            address: raw.address,
            name: section_name(&basename, raw.address),
            size: raw.data.len() as u32,
            mtime,
        })
        .collect();

    Ok(HexMeta { sections })
}

#[tauri::command]
pub fn extract_hex<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    resolver: tauri::State<'_, tauri::path::PathResolver<R>>,
    path: String,
) -> crate::Result<Vec<ExtractedSection>> {
    let (raw_sections, mtime, basename) = parse_hex(&path)?;

    let mut tmp_files = Vec::new();
    let mut sections = Vec::with_capacity(raw_sections.len());

    for raw in raw_sections {
        let pseudo_name = section_name(&basename, raw.address);
        let file = TmpFile::from(&resolver, pseudo_name, raw.data, mtime)?;
        tmp_files.push(guard(file.clone(), |file| {
            let _ = file.free();
        }));
        sections.push(ExtractedSection {
            address: raw.address,
            file,
        });
    }

    for g in tmp_files {
        ScopeGuard::into_inner(g);
    }

    Ok(sections)
}
