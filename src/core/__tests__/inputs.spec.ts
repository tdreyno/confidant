import { Confidant } from "../task"
import { Inputs } from "../inputs"
import { Echo } from "./echo"
import { wait } from "../../util/timeout"

describe("Inputs", () => {
  it("should initialize chained Task after inputs", async () => {
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
  })

  it("should rebuild chained Task after inputs update", async () => {
    const onEcho = jest.fn()

    const value = 5
    const delay = 500

    const confidant = Confidant(null as any, {
      waiting: Echo(value, delay),
      chained: Inputs("waiting").chain(v => Echo(v * 2, delay)),
    })

    confidant.onUpdate("chained", onEcho)

    await confidant.initialize()

    expect(onEcho).not.toHaveBeenCalled()

    await confidant.replaceKey("waiting", Echo(value * 2, delay))

    await wait(delay * 2)

    expect(onEcho).toHaveBeenCalledWith(value * 4)
  })

  it("should handle updates if missing from confidant", async () => {
    const waitValue = 5

    const confidant = Confidant(null as any, {
      waiting: Echo(waitValue, 10),
    })

    const task = Inputs("waiting").chain(v => Echo(v * 2, 10))(confidant)

    await confidant.initialize()

    await task.runInitialize()

    // Should not throw
    await (task as any).updateDownstream()
  })
})
