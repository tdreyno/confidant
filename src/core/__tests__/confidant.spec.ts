import { Confidant } from "../task"
import { Echo, DELAY, TIMEOUT } from "./echo"

describe("Confidant", () => {
  it("should only initialize once", async () => {
    const onInit = jest.fn()

    const confidant = new Confidant(null as any, {
      task: Echo(1),
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
      task: Echo(1),
    })

    confidant.onInitialize("task", onInit)

    const resultPromise = confidant.runInitialize("task")

    jest.advanceTimersByTime(DELAY)

    await resultPromise

    expect(onInit).toBeCalledWith(1)
  })

  it("should initialize all tasks at once", async () => {
    const confidant = new Confidant(null as any, {
      task1: Echo(1, 25),
      task2: Echo(2, 5),
      task3: Echo(3, 15),
    })

    const resultPromise = confidant.initialize()

    jest.advanceTimersByTime(25)

    const results = await resultPromise

    expect(results).toMatchObject({
      task1: 1,
      task2: 2,
      task3: 3,
    })
  })

  it("should get the value eventually on first run", async () => {
    const confidant = new Confidant(null as any, {
      task: Echo(1),
    })

    const resultPromise = confidant.get("task")

    void confidant.runInitialize("task")

    jest.advanceTimersByTime(DELAY)

    const result = await resultPromise

    expect(result).toBe(1)
  })

  it("should get the value immediately when available", async () => {
    const confidant = new Confidant(null as any, {
      task: Echo(1),
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
      task: Echo(TIMEOUT + 1),
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

  it("should error when getting an invalid key", async () => {
    const confidant = new Confidant(null as any, {})

    await expect(() => (confidant.get as any)("fake")).rejects.toBeInstanceOf(
      Error,
    )
  })

  it("should run callbacks onUpdate", async () => {
    const onUpdate = jest.fn()

    const confidant = new Confidant(null as any, {
      task1: Echo(5),
    })

    confidant.onUpdate("task1", onUpdate)

    const resultPromise = confidant.runInitialize("task1")

    jest.advanceTimersByTime(DELAY)

    await resultPromise

    confidant.tasks.task1.update(n => n * 2)

    const result = await confidant.get("task1")

    expect(result).toBe(10)
    expect(onUpdate).toBeCalledWith(10)
  })
})
