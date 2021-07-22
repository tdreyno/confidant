import { Confidant } from "../task"
import { Inputs } from "../inputs"
import { Echo } from "./echo"
import { timeout } from "../../util/timeout"

describe("Inputs", () => {
  it("should initialize chained Task after inputs", async () => {
    jest.useRealTimers()

    const onWait = jest.fn()
    const onEcho = jest.fn()

    const waitValue = 5

    const confidant = Confidant(null as any, {
      waiting: Echo(waitValue, 10),
      chained: Inputs("waiting").chain(v => Echo(v * 2, 10)),
    })

    confidant.onInitialize("waiting", onWait)
    confidant.onInitialize("chained", onEcho)

    expect(onEcho).not.toHaveBeenCalled()

    const waitingPromise = confidant.runInitialize("waiting")
    const taskPromise = confidant.runInitialize("chained")

    await waitingPromise

    expect(onWait).toHaveBeenCalledWith(waitValue)
    expect(onEcho).not.toHaveBeenCalled()

    await taskPromise

    expect(onEcho).toHaveBeenCalledWith(waitValue * 2)

    jest.useFakeTimers()
  })

  it("should rebuild chained Task after inputs update", async () => {
    jest.useRealTimers()

    const onEcho = jest.fn()

    const waitValue = 5

    const confidant = Confidant(null as any, {
      waiting: Echo(waitValue, 10),
      chained: Inputs("waiting").chain(v => Echo(v * 2, 10)),
    })

    confidant.onUpdate("chained", onEcho)

    await confidant.initialize()

    expect(onEcho).not.toHaveBeenCalled()

    await confidant.replaceKey("waiting", Echo(waitValue * 2, 10))

    try {
      await timeout(11)
    } catch (e) {
    } finally {
      expect(onEcho).toHaveBeenCalledWith(waitValue * 4)
    }

    jest.useFakeTimers()
  })

  it("should handle updates if missing from confidant", async () => {
    jest.useRealTimers()

    const waitValue = 5

    const confidant = Confidant(null as any, {
      waiting: Echo(waitValue, 10),
    })

    const task = Inputs("waiting").chain(v => Echo(v * 2, 10))(confidant)

    await confidant.initialize()

    await task.runInitialize()

    // Should not throw
    await task.updateDownstream()

    jest.useFakeTimers()
  })
})
