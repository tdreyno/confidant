import { Confidant, Task, TaskMaker } from "../task"
import { wait } from "../../util/timeout"

export const DELAY = 100
export const TIMEOUT = 1000

type EchoContext = any
class Echo_<T> extends Task<EchoContext, T> {
  constructor(
    manager: Confidant<EchoContext, Record<string, any>>,
    private value: T,
    private delay: number,
  ) {
    super(manager, `${TIMEOUT}ms`)
  }

  async initialize(): Promise<T> {
    await wait(this.delay)

    return this.value
  }
}

export const Echo =
  <T>(value: T, delay = DELAY): TaskMaker<EchoContext, T> =>
  manager =>
    new Echo_(manager, value, delay)

export type Echo<T> = Echo_<T>
