import { timeout } from "../timeout"

describe("timeout", () => {
  it("should resolve after 100s timeout", async () => {
    const onTimeout = jest.fn()

    const promise = timeout(100).catch(e => (onTimeout(), Promise.reject(e)))

    jest.advanceTimersByTime(100)

    await expect(() => promise).rejects.toBe("Timed out in 100ms")

    expect(onTimeout).toHaveBeenCalled()
  })

  it("should resolve immediately after 0ms timeout", async () => {
    const onTimeout = jest.fn()

    const promise = timeout(0).catch(e => (onTimeout(), Promise.reject(e)))

    jest.advanceTimersToNextTimer()

    await expect(() => promise).rejects.toBe("Timed out in 0ms")

    expect(onTimeout).toHaveBeenCalled()
  })

  it("should never resolve after Infinite timeout", async () => {
    const onTimeout = jest.fn()

    void timeout(Infinity).then(onTimeout)

    jest.advanceTimersToNextTimer()

    expect(onTimeout).not.toHaveBeenCalled()
  })
})
