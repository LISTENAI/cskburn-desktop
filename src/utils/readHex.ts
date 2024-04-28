import { readTextFile } from '@tauri-apps/api/fs';
import { UserError } from '@/userError';

export interface ISection {
  address: number;
  size: number;
}

enum IRecordType {
  DATA = 0x00,
  END_OF_FILE = 0x01,
  EXTENDED_SEGMENT_ADDRESS = 0x02,
  START_SEGMENT_ADDRESS = 0x03,
  EXTENDED_LINEAR_ADDRESS = 0x04,
  START_LINEAR_ADDRESS = 0x05,
}

export async function readHex(path: string): Promise<ISection[]> {
  const sections: ISection[] = [];

  const state = {
    extended: 0,
    address: 0,
    size: 0,
  };

  function next(next: { extended?: number, address?: number }): void {
    if (state.size > 0) {
      sections.push({
        address: state.address,
        size: state.size,
      });
    }
    Object.assign(state, { ...next, size: 0 });
  }

  const content = await readTextFile(path);
  for (const line of content.split(/\r?\n/)) {
    if (!line) continue;
    if (!line.match(/^:[0-9A-Fa-f]+$/) || line.length % 2 != 1) {
      throw new UserError('该文件不是一个合法的 HEX', `无效的行: "${line}"`);
    }

    const buffer = Uint8Array.from(line.substring(1).match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

    // verify byte_count
    if (1 + 2 + 1 + buffer[0] + 1 != buffer.length) {
      throw new UserError('该文件不是一个合法的 HEX', `行长度不匹配: "${line}"`);
    }

    // verify checksum
    if (buffer.reduce((prev, curr) => (prev + curr) & 0xFF, 0x00) != 0x00) {
      throw new UserError('该文件不是一个合法的 HEX', `行校验不匹配: "${line}"`);
    }

    const address = (buffer[1] << 8) | buffer[2];
    const recordType = buffer[3] as IRecordType;
    const data = buffer.slice(4, buffer.length - 1);

    if (recordType == IRecordType.END_OF_FILE) {
      next({ extended: 0, address: 0 });
      break;
    }

    switch (recordType) {
      case IRecordType.DATA: {
        if (state.address + state.size != state.extended + address) {
          next({ address: state.extended + address });
        }
        state.size += data.length;
        break;
      }
      case IRecordType.EXTENDED_SEGMENT_ADDRESS: {
        if (data.length != 2) {
          throw new UserError('该文件不是一个合法的 HEX', `数据长度不匹配: "${line}"`);
        }
        const nextExtend = ((data[0] << 8) | data[1]) << 4;
        if (state.address + state.size == nextExtend) {
          state.extended = nextExtend;
        } else {
          next({ extended: nextExtend, address: nextExtend });
        }
        break;
      }
      case IRecordType.EXTENDED_LINEAR_ADDRESS: {
        if (data.length != 2) {
          throw new UserError('该文件不是一个合法的 HEX', `数据长度不匹配: "${line}"`);
        }
        const nextExtend = ((data[0] << 8) | data[1]) << 16;
        if (state.address + state.size == nextExtend) {
          state.extended = nextExtend;
        } else {
          next({ extended: nextExtend, address: nextExtend });
        }
        break;
      }
      case IRecordType.START_SEGMENT_ADDRESS:
      case IRecordType.START_LINEAR_ADDRESS:
        break;
      default:
        console.warn(`Ignored unsupported record type 0x${(recordType as number).toString(16)}, line: "${line}"`);
        break;
    }
  }

  return sections;
}
