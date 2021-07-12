import { Task, TaskMaker } from "./task"

type HardcodedContext = any

class Hardcoded_<T> extends Task<HardcodedContext, T> {
  constructor(manager: HardcodedContext, private value: T) {
    super(manager)
  }

  initialize(): Promise<T> {
    return Promise.resolve(this.value)
  }
}

export const Hardcoded =
  <T>(value: T): TaskMaker<HardcodedContext, T> =>
  manager =>
    new Hardcoded_(manager, value)

export type Hardcoded<T> = Hardcoded_<T>
