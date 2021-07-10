import { Task, TaskMaker } from "./task"

type PrimativeContext = any

class Primative_<T> extends Task<PrimativeContext, T> {
  constructor(manager: PrimativeContext, private value: T) {
    super(manager)
  }

  initialize(): Promise<T> {
    return Promise.resolve(this.value)
  }
}

export const Primative =
  <T>(value: T): TaskMaker<PrimativeContext, T> =>
  manager =>
    new Primative_(manager, value)

export type Primative<T> = Primative_<T>
