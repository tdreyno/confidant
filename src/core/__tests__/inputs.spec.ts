import { Confidant } from "../task"
import { Inputs } from "../inputs"
import { Echo } from "./echo"

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
})
