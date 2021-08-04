import { wait } from "../timeout"

describe("wait", () => {
  it("should resolve after 100s timeout", async () => {
    const result = await wait(100)
    expect(result).toBe("Timed out in 100ms")
  })

  it("should resolve immediately after 0ms timeout", async () => {
    const result = await wait(0)
    expect(result).toBe("Timed out in 0ms")
  })

  it("should never resolve after Infinite timeout", async () => {
    const onTimeout = jest.fn()

    void wait(Infinity).then(onTimeout)

    expect(onTimeout).not.toHaveBeenCalled()
  })
})
