use ihex::{Reader, Record};
use std::fs::read_to_string;

#[derive(serde::Serialize)]
pub struct HexSection {
    address: u32,
    size: u32,
}

struct HexState {
    extended: u32,
    address: u32,
    size: u32,
}

#[tauri::command]
pub fn read_hex(path: String) -> crate::Result<Vec<HexSection>> {
    let content = read_to_string(path).map_err(|e| crate::Error::Io(e))?;
    let reader = Reader::new(&content);

    let mut sections = Vec::new();
    let mut state = HexState {
        extended: 0,
        address: 0,
        size: 0,
    };

    for record in reader {
        match record {
            Ok(Record::Data { offset, value }) => {
                let address = state.extended + offset as u32;
                if state.address + state.size != address {
                    if state.size > 0 {
                        sections.push(HexSection {
                            address: state.address,
                            size: state.size,
                        });
                    }
                    state.address = address;
                    state.size = 0;
                }
                state.size += value.len() as u32;
            }
            Ok(Record::EndOfFile) => {
                if state.size > 0 {
                    sections.push(HexSection {
                        address: state.address,
                        size: state.size,
                    });
                }
            }
            Ok(Record::ExtendedSegmentAddress(segment)) => {
                let next_extend = (segment as u32) << 4;
                if state.address + state.size == next_extend {
                    state.extended = next_extend;
                } else {
                    if state.size > 0 {
                        sections.push(HexSection {
                            address: state.address,
                            size: state.size,
                        });
                    }
                    state.extended = next_extend;
                    state.address = next_extend;
                    state.size = 0;
                }
            }
            Ok(Record::ExtendedLinearAddress(segment)) => {
                let next_extend = (segment as u32) << 16;
                if state.address + state.size == next_extend {
                    state.extended = next_extend;
                } else {
                    if state.size > 0 {
                        sections.push(HexSection {
                            address: state.address,
                            size: state.size,
                        });
                    }
                    state.extended = next_extend;
                    state.address = next_extend;
                    state.size = 0;
                }
            }
            _ => {}
        }
    }

    Ok(sections)
}
