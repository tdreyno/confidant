export const timeout = <V>(ms: number) =>
  new Promise<V>((_, reject) => setTimeout(reject, ms))
