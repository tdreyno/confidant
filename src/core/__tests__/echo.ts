import { Confidant, Task, TaskMaker } from "../task"
import { timeout } from "../../util/timeout"

export const DELAY = 10
export const TIMEOUT = 50

type EchoContext = any
class Echo_<T> extends Task<EchoContext, T> {
  constructor(
    manager: Confidant<EchoContext, Record<string, any>>,
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

export const Echo =
  <T>(value: T, delay = DELAY): TaskMaker<EchoContext, T> =>
  manager =>
    new Echo_(manager, value, delay)

export type Echo<T> = Echo_<T>
