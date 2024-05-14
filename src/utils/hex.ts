export function toHex(value: number): string {
  return `0x${value.toString(16).padStart(8, '0')}`;
}

export function fromHex(value: string): number | undefined {
  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    return parseInt(value, 16);
  } else if (/^[0-9]+$/.test(value)) {
    return parseInt(value, 10);
  }
}
