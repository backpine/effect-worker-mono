export const env = {
  HYPERDRIVE: {
    get connectionString(): string {
      throw new Error("This request should never read Hyperdrive")
    },
  },
}
