import { Confidant, Task, TaskMaker } from "./task"

export class Inputs_<C, V> extends Task<C, V> {
  constructor(
    confidant: Confidant<C, Record<string, any>>,
    private keys: string[],
    private fn: (...values: any[]) => TaskMaker<C, V>,
  ) {
    super(confidant)
  }

  initialize(): Promise<V> {
    return Promise.all(this.keys.map(key => this.manager.get(key))).then(
      results => this.fn(...results)(this.manager).initialize(),
    )
  }
}

export const Inputs = (...keys: string[]) => ({
  chain:
    <C, V>(fn: (...values: any[]) => TaskMaker<C, V>) =>
    (manager: Confidant<C, Record<string, any>>) =>
      new Inputs_(manager, keys, fn),
})

export type Inputs<C, V> = Inputs_<C, V>
