import { EmptyContext } from "../util/emptyContext"
import { Confidant, Task, TaskMaker } from "./task"

class Hardcoded_<T> extends Task<EmptyContext, T> {
  constructor(
    confidant: Confidant<EmptyContext, Record<string, any>>,
    private value: T,
  ) {
    super(confidant)
  }

  initialize(): Promise<T> {
    return Promise.resolve(this.value)
  }
}

export const Hardcoded =
  <T>(value: T): TaskMaker<EmptyContext, T> =>
  manager =>
    new Hardcoded_(manager, value)

export type Hardcoded<T> = Hardcoded_<T>
