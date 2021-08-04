import { getTestConfidant } from "./confidantStub"
import { Echo, TIMEOUT } from "./echo"

describe("Task", () => {
  it("should only initialize once", async () => {
    const onInit = jest.fn()

    const task = Echo(1)(getTestConfidant())

    task.onInitialize(onInit)

    await task.runInitialize()
    await task.runInitialize()

    expect(onInit).toHaveBeenCalledTimes(1)
  })

  it("should run callbacks onInitialize", async () => {
    const onInit = jest.fn()

    const task = Echo(1)(getTestConfidant())

    task.onInitialize(onInit)

    await task.runInitialize()

    expect(onInit).toBeCalledWith(1)
  })

  it("should get the value eventually on first run", async () => {
    const task = Echo(1)(getTestConfidant())

    const resultPromise = task.get()

    void task.runInitialize()

    const result = await resultPromise

    expect(result).toBe(1)
  })

  it("should get the value immediately when available", async () => {
    const task = Echo(1)(getTestConfidant())

    await task.runInitialize()

    const before = Date.now()
    await task.get()
    const after = Date.now()

    expect(after - before).toBeLessThan(10)
  })

  it("should timeout the get request", async () => {
    const task = Echo(1, TIMEOUT + 1)(getTestConfidant())

    const initPromise = task.runInitialize()

    expect.assertions(1)

    const onError = jest.fn()

    try {
      await initPromise
    } catch {
      onError()
    }

    expect(onError).toHaveBeenCalled()
  })

  it("should be able to set new value", async () => {
    const onUpdate = jest.fn()

    const task = Echo(1)(getTestConfidant())

    await task.runInitialize()

    task.onUpdate(onUpdate)
    task.set(5)

    expect(onUpdate).toBeCalledWith(5)
  })

  it("should not trigger callback if new values is the same as the old", async () => {
    const onUpdate = jest.fn()

    const task = Echo(1)(getTestConfidant())

    await task.runInitialize()

    task.onUpdate(onUpdate)
    task.set(1)

    expect(onUpdate).not.toBeCalledWith(5)
  })

  it("should be able to update new value", async () => {
    const onUpdate = jest.fn()

    const task = Echo(2)(getTestConfidant())

    await task.runInitialize()

    task.onUpdate(onUpdate)
    task.update(x => x * 5)

    expect(onUpdate).toBeCalledWith(10)
  })

  it("should not allow setting before initialization", async () => {
    const onUpdate = jest.fn()

    const task = Echo(2)(getTestConfidant())

    task.onUpdate(onUpdate)

    expect(() => task.set(5)).toThrowError(
      "Cannot set Task value before initialization",
    )

    expect(onUpdate).not.toHaveBeenCalled()
  })
})
