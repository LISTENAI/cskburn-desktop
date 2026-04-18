export interface IFlashRegion {
  base: number;
  size: number;
}

interface IModelDefinition {
  name: string;
  brandName: string;
  match: (slug: string) => boolean;
  flashRegions: IFlashRegion[];
};

const FLASH_SIZE_128M = 128 * 1024 * 1024;

export const MODELS: IModelDefinition[] = [
  {
    name: 'venus',
    brandName: 'CSK6',
    match: (slug) => slug.toLowerCase() === 'venus' ||
      slug === '6' ||
      slug.toLowerCase().startsWith('csk6'),
    flashRegions: [
      { base: 0x68000000, size: FLASH_SIZE_128M },
      { base: 0x18000000, size: FLASH_SIZE_128M },
    ],
  },
  {
    name: 'arcs',
    brandName: 'LS26',
    match: (slug) => slug.toLowerCase() === 'arcs' ||
      slug.toLowerCase().startsWith('ls26'),
    flashRegions: [
      { base: 0x30000000, size: FLASH_SIZE_128M },
    ],
  },
];

export function normalizeModelName(slug: string): string | null {
  for (const model of MODELS) {
    if (model.match(slug)) {
      return model.name;
    }
  }

  return null;
}

export function resolveFlashOffset(addr: number, size: number): number | null {
  if (addr >= 0 && addr + size <= FLASH_SIZE_128M) {
    return addr;
  }
  for (const model of MODELS) {
    for (const region of model.flashRegions) {
      const end = region.base + region.size;
      if (addr >= region.base && addr + size <= end) {
        return addr - region.base;
      }
    }
  }
  return null;
}
