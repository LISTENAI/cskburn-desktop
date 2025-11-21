interface IModelDefinition {
  name: string;
  brandName: string;
  match: (slug: string) => boolean;
};

export const MODELS: IModelDefinition[] = [
  {
    name: 'venus',
    brandName: 'CSK6',
    match: (slug) => slug.toLowerCase() == 'venus' ||
      slug == '6' ||
      slug.toLowerCase().startsWith('csk6'),
  },
  {
    name: 'arcs',
    brandName: 'LS26',
    match: (slug) => slug.toLowerCase() == 'arcs' ||
      slug.toLowerCase().startsWith('ls26'),
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
