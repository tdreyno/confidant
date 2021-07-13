import { Confidant, Task } from "../task"
import { timeout } from "../../util/index"

const DELAY = 1000
const TIMEOUT = 5000

type C = any
class TestTask<T> extends Task<C, T> {
  constructor(
    manager: Confidant<C, any, Record<string, any>>,
    private value: T,
    private delay = DELAY,
  ) {
    super(manager, TIMEOUT)
  }

  async initialize(): Promise<T> {
    try {
      await timeout(this.delay)
    } finally {
      return this.value
    }
  }
}

describe("Confidant", () => {
  it("should only initialize once", async () => {
    const onInit = jest.fn()

    const confidant = new Confidant(null as any, {
      task: new TestTask(null as any, 1),
    })

    confidant.onInitialize("task", onInit)

    const resultPromiseA = confidant.runInitialize("task")
    jest.advanceTimersByTime(DELAY)
    await resultPromiseA

    const resultPromiseB = confidant.runInitialize("task")
    jest.advanceTimersByTime(DELAY)
    await resultPromiseB

    expect(onInit).toHaveBeenCalledTimes(1)
  })

  it("should run callbacks onInitialize", async () => {
    const onInit = jest.fn()

    const confidant = new Confidant(null as any, {
      task: new TestTask(null as any, 1),
    })

    confidant.onInitialize("task", onInit)

    const resultPromise = confidant.runInitialize("task")

    jest.advanceTimersByTime(DELAY)

    await resultPromise

    expect(onInit).toBeCalledWith(1)
  })

  it("should get the value eventually on first run", async () => {
    const confidant = new Confidant(null as any, {
      task: new TestTask(null as any, 1),
    })

    const resultPromise = confidant.get("task")

    void confidant.runInitialize("task")

    jest.advanceTimersByTime(DELAY)

    const result = await resultPromise

    expect(result).toBe(1)
  })

  it("should get the value immediately when available", async () => {
    const confidant = new Confidant(null as any, {
      task: new TestTask(null as any, 1),
    })

    const initPromise = confidant.runInitialize("task")

    jest.advanceTimersByTime(DELAY)

    await initPromise

    const resultPromise = confidant.get("task")

    jest.advanceTimersByTime(1)

    const result = await resultPromise

    expect(result).toBe(1)
  })

  it("should timeout the get request", async () => {
    const confidant = new Confidant(null as any, {
      task: new TestTask(null as any, 1, TIMEOUT + 1),
    })

    const initPromise = confidant.runInitialize("task")

    expect.assertions(1)

    const onError = jest.fn()

    try {
      jest.advanceTimersByTime(TIMEOUT)

      await initPromise
    } catch {
      onError()
    }

    expect(onError).toHaveBeenCalled()
  })
})
