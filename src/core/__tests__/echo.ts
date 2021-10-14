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
    public onInvalidate_: (task: Echo<T>) => Promise<void>,
  ) {
    super(confidant, `${TIMEOUT}ms`)
  }

  async initialize(): Promise<T> {
    await wait(this.delay_)

    return this.value_
  }

  async invalidate(path?: string): Promise<void> {
    if (path && path.length > 0) {
      return
    }

    // console.log(`Echo invalidate`)
    await this.onInvalidate_(this)
  }
}

export const Echo =
  <T>(
    value: T,
    delay = DELAY,
    onInvalidate: (task: Echo<T>) => Promise<void> = async () => void 0,
  ): TaskMaker<EmptyContext, T> =>
  manager =>
    new Echo_(manager, value, delay, onInvalidate)

export type Echo<T> = Echo_<T>
