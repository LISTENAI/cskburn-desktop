export class UserError extends Error {
  constructor(
    public readonly summary: string,
    public readonly details?: string
  ) {
    super(details ? `${summary}: ${details}` : summary);
  }
}
