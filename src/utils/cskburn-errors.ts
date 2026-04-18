export interface IErrorInfo {
  title: string;
  hints: string[];
}

// Only error codes that can actually surface from this GUI are listed here.
// The GUI pre-validates alignment / overlap / flash size and never invokes
// NAND, RAM, --read, --erase, --verify or custom --burner code paths, so the
// corresponding upstream codes are intentionally omitted.
const ERROR_CATALOG: Record<string, IErrorInfo> = {
  'E1001': {
    title: '参数不合法',
    hints: ['工具内部错误，请将完整日志反馈给维护者。'],
  },

  'E2001': {
    title: '读取烧录文件失败',
    hints: ['文件可能已被移动、删除，或当前用户没有读取权限。'],
  },
  'E2003': {
    title: 'HEX 文件解析失败',
    hints: ['请确认是合法的 Intel HEX 文件，或改用 .bin 烧录。'],
  },

  'E3001': {
    title: '串口设备不存在',
    hints: [
      '串口可能已被拔出，请在端口下拉中重新选择。',
      '确认 USB 转串口驱动已安装（CH34x / CP210x / FTDI 等）。',
    ],
  },
  'E3002': {
    title: '没有访问串口的权限',
    hints: [
      'Linux 下将当前用户加入 dialout 组：sudo usermod -aG dialout $USER，重新登录后生效。',
      'macOS 请检查系统安全设置是否拦截了串口访问。',
    ],
  },
  'E3003': {
    title: '串口被其他程序占用',
    hints: [
      '关闭占用该串口的串口终端、IDE 监视器或其他烧录工具。',
      '也可能是本工具被重复打开。',
    ],
  },
  'E3004': {
    title: '打开串口失败',
    hints: [
      '重新插拔设备。',
      '更换数据线或 USB 口，避开 USB Hub。',
    ],
  },
  'E3005': {
    title: '串口参数配置失败',
    hints: [
      '更换数据线。',
      '重新安装 USB 转串口驱动。',
    ],
  },

  'E4001': {
    title: '复位后芯片未响应',
    hints: [
      '按住 BOOT（或下载）键的同时复位芯片，确保进入下载模式。',
      '检查 TX/RX 是否交叉、GND 是否接通，以及 DTR/RTS 是否连接（自动复位与拉 BOOT 都依赖这两根线）。',
      '确认顶部下拉中选择的芯片与实际硬件一致。',
      '确认开发板供电正常，外接模组时尤其注意。',
    ],
  },
  'E4002': {
    title: '控制 RTS / DTR 失败',
    hints: ['USB 转串口设备状态异常，重新插拔或更换。'],
  },

  'E5001': {
    title: '切换波特率被设备拒绝',
    hints: [
      '在「设置」中降低串口波特率（例如 1500000 或 921600）。',
      '确认 USB 转串口芯片支持当前波特率。',
    ],
  },
  'E5002': {
    title: '切换波特率后通信失步',
    hints: [
      '在「设置」中降低串口波特率。',
      '更换更优质的 USB 数据线，避开 USB Hub。',
    ],
  },
  'E5003': {
    title: '向 RAM 加载烧录器失败',
    hints: [
      '在「设置」中降低串口波特率。',
      '检查数据线和 USB 口的稳定性。',
    ],
  },
  'E5004': {
    title: '烧录器加载完成后未启动',
    hints: ['顶部下拉中选择的芯片可能与实际硬件不一致。'],
  },
  'E5005': {
    title: '切换波特率被烧录器拒绝',
    hints: [
      '在「设置」中降低串口波特率。',
      '确认 USB 转串口芯片支持当前波特率。',
    ],
  },
  'E5006': {
    title: '切换波特率后与烧录器失步',
    hints: [
      '在「设置」中降低串口波特率。',
      '更换更优质的 USB 数据线，避开 USB Hub。',
    ],
  },

  'E6001': {
    title: '读取芯片 ID 失败',
    hints: [
      '连接不稳定，请检查数据线接触是否良好。',
      '在「设置」中降低串口波特率。',
    ],
  },
  'E6002': {
    title: '读取 Flash ID 失败',
    hints: [
      '连接不稳定，请检查数据线接触是否良好。',
      '在「设置」中降低串口波特率。',
    ],
  },
  'E6003': {
    title: '未检测到 Flash',
    hints: ['Flash 焊接不良、未供电或型号不支持，需从硬件层面排查。'],
  },

  'E7001': {
    title: '读取 Flash 失败',
    hints: [
      '在「设置」中降低串口波特率。',
      '检查数据线和 USB 口的稳定性。',
    ],
  },
  'E7002': {
    title: '擦除 Flash 失败',
    hints: [
      '检查目标 Flash 是否启用了写保护。',
      '确认设备供电稳定。',
    ],
  },
  'E7003': {
    title: '写入 Flash 失败',
    hints: [
      '在「设置」中降低串口波特率。',
      '确认设备供电稳定，必要时直连主板 USB 口。',
    ],
  },

  'E8001': {
    title: '设备端 MD5 计算失败',
    hints: [
      '设备通信异常，在「设置」中降低串口波特率。',
      '检查数据线接触是否良好，并确认设备供电稳定。',
    ],
  },
  'E8002': {
    title: '本地 MD5 计算失败',
    hints: ['极少见，通常是系统状态异常，重启工具或主机后重试。'],
  },
  'E8003': {
    title: '校验失败（MD5 不匹配）',
    hints: [
      '先重新烧录一次，排除偶发因素。',
      '若稳定复现，多为 Flash 坏块、擦除不彻底或电源噪声引起的位翻转，需从硬件层面排查。',
    ],
  },
};

const CATEGORY_CATALOG: Record<string, IErrorInfo> = {
  'E2': {
    title: '本地文件读写失败',
    hints: ['烧录文件可能已被移动、删除或没有读取权限。'],
  },
  'E3': {
    title: '串口打开 / 配置失败',
    hints: [
      '确认设备已被系统识别，并装好了 USB 转串口驱动。',
      '关闭其他可能占用串口的程序，必要时重新插拔设备。',
    ],
  },
  'E4': {
    title: '设备探测或复位失败',
    hints: [
      '按住 BOOT 键并复位，确保设备进入下载模式。',
      '检查 USB 数据线、TX/RX/GND/DTR/RTS 接线是否正确。',
      '确认顶部下拉中选择的芯片与实际硬件一致。',
    ],
  },
  'E5': {
    title: '进入更新模式失败',
    hints: [
      '在「设置」中降低串口波特率。',
      '更换更优质的 USB 数据线，避开 USB Hub。',
    ],
  },
  'E6': {
    title: '设备 / Flash 信息读取失败',
    hints: [
      '连接不稳定，请检查数据线接触是否良好。',
      '在「设置」中降低串口波特率。',
    ],
  },
  'E7': {
    title: 'Flash 读写擦除失败',
    hints: [
      '在「设置」中降低串口波特率。',
      '确认设备供电稳定，必要时直连主板 USB 口。',
    ],
  },
  'E8': {
    title: '校验失败',
    hints: [
      '先重新烧录一次，排除偶发因素。',
      '若稳定复现，多为 Flash 坏块、擦除不彻底或电源不稳。',
    ],
  },
  'D': {
    title: '设备端返回错误',
    hints: [
      '通常是 Flash 繁忙、擦除异常或供电不稳引起。',
      '反复出现请将完整日志反馈给维护者。',
    ],
  },
};

export function lookupErrorInfo(code: string | null | undefined): IErrorInfo | null {
  if (!code) return null;
  if (ERROR_CATALOG[code]) return ERROR_CATALOG[code];
  if (code.startsWith('D')) return CATEGORY_CATALOG['D'];
  const prefix = code.slice(0, 2);
  return CATEGORY_CATALOG[prefix] ?? null;
}
