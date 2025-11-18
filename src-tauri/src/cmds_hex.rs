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

impl HexState {
    fn push_section(&mut self, sections: &mut Vec<HexSection>) {
        if self.size == 0 {
            return;
        }

        sections.push(HexSection {
            address: self.address,
            size: self.size,
        });

        self.size = 0;
    }

    fn switch_extended(&mut self, sections: &mut Vec<HexSection>, next_extend: u32) {
        if self.address + self.size == next_extend {
            self.extended = next_extend;
        } else {
            self.push_section(sections);
            self.extended = next_extend;
            self.address = next_extend;
        }
    }
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
                    state.push_section(&mut sections);
                    state.address = address;
                }
                state.size += value.len() as u32;
            }
            Ok(Record::EndOfFile) => {
                state.push_section(&mut sections);
            }
            Ok(Record::ExtendedSegmentAddress(segment)) => {
                state.switch_extended(&mut sections, (segment as u32) << 4);
            }
            Ok(Record::ExtendedLinearAddress(segment)) => {
                state.switch_extended(&mut sections, (segment as u32) << 16);
            }
            _ => {}
        }
    }

    Ok(sections)
}
