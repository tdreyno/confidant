import { Hardcoded } from "../hardcoded"

describe("Hardcoded", () => {
  it("should contain a hardcoded value", async () => {
    const task = Hardcoded(5)(null as any)

    const resultPromise = task.runInitialize()

    jest.runAllTimers()

    const result = await resultPromise

    expect(result).toBe(5)
  })

  it("should resolve immediately", async () => {
    const task = Hardcoded(5)(null as any)

    const resultPromise = task.runInitialize()

    jest.advanceTimersByTime(1)

    const result = await resultPromise

    expect(result).toBe(5)
  })
})
