#[cfg(target_os = "windows")]
use codepage::to_encoding;
#[cfg(target_os = "windows")]
use windows::Win32::Globalization::GetACP;

#[tauri::command]
pub fn decode(data: Vec<u8>) -> String {
    #[cfg(target_os = "windows")]
    {
        let code_page = unsafe { GetACP() as u32 };
        if let Some(encoding) = to_encoding(code_page.try_into().unwrap()) {
            let (decoded, _, had_errors) = encoding.decode(&data);
            if !had_errors {
                return decoded.into_owned();
            }
        }
    }

    String::from_utf8_lossy(&data).to_string()
}
