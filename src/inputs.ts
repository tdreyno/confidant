import { Manager, Task, TaskMaker } from "./task"

export class Inputs_<C, V> extends Task<C, V> {
  constructor(
    manager: Manager<C, any, Record<string, any>>,
    private keys: string[],
    private fn: (...values: any[]) => TaskMaker<C, V>,
  ) {
    super(manager)
  }

  initialize(): Promise<V> {
    return Promise.all(this.keys.map(key => this.manager.get(key))).then(
      results => this.fn(...results)(this.manager).get(),
    )
  }
}

export const Inputs = (...keys: string[]) => ({
  chain:
    <C, V>(fn: (...values: any[]) => TaskMaker<C, V>) =>
    (manager: Manager<C, any, Record<string, any>>) =>
      new Inputs_(manager, keys, fn),
})

export type Inputs<C, V> = Inputs_<C, V>
