import { Confidant, Task, TaskMaker } from "./task"

export class Inputs_<C, V> extends Task<C, V> {
  constructor(
    confidant: Confidant<C, Record<string, any>>,
    private keys: string[],
    private fn: (...values: any[]) => TaskMaker<C, V>,
  ) {
    super(confidant)
  }

  async initialize(): Promise<V> {
    const results = await Promise.all(
      this.keys.map(key => this.confidant.get(key)),
    )

    return this.fn(...results)(this.confidant).runInitialize()
  }
}

export const Inputs = (...keys: string[]) => ({
  chain:
    <C, V>(fn: (...values: any[]) => TaskMaker<C, V>) =>
    (manager: Confidant<C, Record<string, any>>) =>
      new Inputs_(manager, keys, fn),
})

export type Inputs<C, V> = Inputs_<C, V>
