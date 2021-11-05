import { createLogger } from "winston"
import Transport from "winston-transport"
import { emptyContext, EmptyContext } from "../../util/emptyContext"
import { Group } from "../group"
import { Inputs } from "../inputs"
import { Confidant, Task } from "../task"
import { Echo, TIMEOUT } from "./echo"

describe("Confidant", () => {
  it("should only initialize once", async () => {
    const onInit = jest.fn()

    const confidant = Confidant(emptyContext(), {
      task: Echo(1),
    })

    confidant.onInitialize("task", onInit)

    await confidant.runInitialize("task")

    await confidant.runInitialize("task")

    expect(onInit).toHaveBeenCalledTimes(1)
  })

  it("should run callbacks onInitialize", async () => {
    const onInit = jest.fn()

    const confidant = Confidant(emptyContext(), {
      task: Echo(1),
    })

    confidant.onInitialize("task", onInit)

    await confidant.runInitialize("task")

    expect(onInit).toBeCalledWith(1)
  })

  it("should initialize all tasks at once", async () => {
    const confidant = Confidant(emptyContext(), {
      task1: Echo(1, 25),
      task2: Echo(2, 5),
      task3: Echo(3, 15),
    })

    const results = await confidant.initialize()

    expect(results).toMatchObject({
      task1: 1,
      task2: 2,
      task3: 3,
    })
  })

  it("should get the value eventually on first run", async () => {
    const confidant = Confidant(emptyContext(), {
      task: Echo(1),
    })

    const resultPromise = confidant.get("task")

    void confidant.runInitialize("task")

    const result = await resultPromise

    expect(result).toBe(1)
  })

  it("should get the value immediately when available", async () => {
    const confidant = Confidant(emptyContext(), {
      task: Echo(1),
    })

    await confidant.runInitialize("task")

    const result = await confidant.get("task")

    expect(result).toBe(1)
  })

  it("should timeout the get request", async () => {
    const confidant = Confidant(
      emptyContext(),
      {
        task: Echo(true, 1000),
      },
      {
        timeout: `${TIMEOUT}ms`,
      },
    )

    const initPromise = confidant.runInitialize("task")

    expect.assertions(1)

    const onError = jest.fn()

    try {
      await initPromise
    } catch {
      onError()
    }

    expect(onError).toHaveBeenCalled()
  })

  it("should error when getting an invalid key", async () => {
    const confidant = Confidant(
      {},
      {
        task1: Echo(5),
      },
    )

    await expect(() => (confidant.get as any)("fake")).rejects.toBeInstanceOf(
      Error,
    )
  })

  it("should run callbacks onUpdate", async () => {
    const onUpdate = jest.fn()

    const confidant = Confidant(emptyContext(), {
      task1: Echo(5),
    })

    confidant.onUpdate("task1", onUpdate)

    await confidant.runInitialize("task1")

    confidant.tasks.task1.update(n => n * 2)

    const result = await confidant.get("task1")

    expect(result).toBe(10)
    expect(onUpdate).toBeCalledWith(10)
  })

  it("should utilize custom logger", async () => {
    const onLog = jest.fn()

    class CustomTransport extends Transport {
      log(info: any, next: () => void) {
        onLog(info.message)

        next()
      }
    }

    class CustomTask<T> extends Task<any, T> {
      constructor(
        confidant: Confidant<EmptyContext, Record<string, any>>,
        public value_: T,
      ) {
        super(confidant)
      }

      initialize(): Promise<T> {
        this.logger.info(this.value_)
        return Promise.resolve(this.value_)
      }
    }

    const confidant = Confidant(
      emptyContext(),
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        task: c => new CustomTask(c as any, 5),
      },
      {
        logger: createLogger({
          transports: [new CustomTransport()],
        }),
      },
    )

    await confidant.runInitialize("task")

    expect(onLog).toHaveBeenCalledWith(5)
  })

  it("should be able to replace a task by key", async () => {
    const onUpdate = jest.fn()

    const confidant = Confidant(emptyContext(), {
      task: Echo(1),
    })

    confidant.onUpdate("task", onUpdate)

    await confidant.replaceKey("task", Echo(5))

    expect(onUpdate).toHaveBeenCalledWith(5)
  })

  it("should lookup tasks", () => {
    const confidant = Confidant(emptyContext(), {
      task: Echo(1),
    })

    const key = confidant.keyForTask(confidant.tasks.task)

    expect(key).toBe("task")
  })

  it("should fail to lookup tasks", () => {
    const confidant = Confidant(
      {},
      {
        task1: Echo(5),
      },
    )

    const task = Echo(1)(confidant)

    const key = confidant.keyForTask(task)

    expect(key).toBeUndefined()
  })

  it("should be able to invalidate a task", async () => {
    const onUpdate = jest.fn()

    const confidant = Confidant(emptyContext(), {
      task1: Echo(5),
    })

    confidant.onUpdate("task1", onUpdate)

    await confidant.runInitialize("task1")

    await confidant.invalidate("task1")

    const result = await confidant.get("task1")

    expect(result).toBe(5)
  })

  it("should be able to invalidate a deeply nested task", async () => {
    const onUpdate = jest.fn()
    const newValue = 42

    const confidant = Confidant(emptyContext(), {
      domain: Group({
        a: Echo(3),
        b: Echo(6),
        combo: Inputs("a", "b").chain((a: number, b: number) =>
          Echo(a + b, 100, async t => {
            t.set(newValue)
            return
          }),
        ),
      }),
    })

    confidant.onUpdate("domain", onUpdate)

    await confidant.runInitialize("domain")

    await confidant.invalidate("domain.combo")

    const result = await confidant.get("domain")

    expect(result).toMatchObject({ combo: newValue })
  })
})
