import { Command } from '@tauri-apps/plugin-shell';
import { type } from '@tauri-apps/plugin-os';

export async function revealFile(path: string): Promise<void> {
  switch (type()) {
    case 'windows':
      await Command.create('reveal-file-windows', [`/select,"${path}"`]).execute();
      break;
    case 'macos':
      await Command.create('reveal-file-macos', ['-R', path]).execute();
      break;
    case 'linux':
      await Command.create('reveal-file-linux', [
        '--print-reply',
        '--dest=org.freedesktop.FileManager1',
        '/org/freedesktop/FileManager1',
        'org.freedesktop.FileManager1.ShowItems',
        `array:string:"file://${path}"`,
        'string:""',
      ]).execute();
      break;
    default:
      // Not supported
      break;
  }
}
