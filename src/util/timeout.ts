export const timeout = (ms: number, errorOnComplete = true) =>
  new Promise((resolve, reject) => {
    if (!isFinite(ms)) {
      return
    }

    const fn = errorOnComplete ? reject : resolve

    setTimeout(() => fn(`Timed out in ${ms}ms`), ms)
  })

export const wait = (ms: number) => timeout(ms, false)
