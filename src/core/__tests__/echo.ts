import { Confidant, Task, TaskMaker } from "../task"
import { wait } from "../../util/timeout"
import { EmptyContext } from "../../util/emptyContext"

export const DELAY = 100
export const TIMEOUT = 1000

class Echo_<T> extends Task<EmptyContext, T> {
  constructor(
    confidant: Confidant<EmptyContext, Record<string, any>>,
    public value_: T,
    public delay_: number,
  ) {
    super(confidant, `${TIMEOUT}ms`)
  }

  async initialize(): Promise<T> {
    await wait(this.delay_)

    return this.value_
  }
}

export const Echo =
  <T>(value: T, delay = DELAY): TaskMaker<EmptyContext, T> =>
  manager =>
    new Echo_(manager, value, delay)

export type Echo<T> = Echo_<T>
