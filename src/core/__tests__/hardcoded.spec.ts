import { Hardcoded } from "../hardcoded"
import { getTestConfidant } from "./confidantStub"

describe("Hardcoded", () => {
  it("should contain a hardcoded value", async () => {
    const task = Hardcoded(5)(getTestConfidant())

    const resultPromise = task.runInitialize()

    const result = await resultPromise

    expect(result).toBe(5)
  })

  it("should resolve immediately", async () => {
    const task = Hardcoded(5)(getTestConfidant())

    const resultPromise = task.runInitialize()

    const before = Date.now()
    await resultPromise
    const after = Date.now()

    expect(after - before).toBeLessThan(10)
  })
})
