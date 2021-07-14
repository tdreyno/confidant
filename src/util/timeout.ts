export const timeout = <V>(ms: number) =>
  new Promise<V>((_, reject) => {
    if (!isFinite(ms)) {
      return
    }

    setTimeout(() => reject(`Timed out in ${ms}ms`), ms)
  })
