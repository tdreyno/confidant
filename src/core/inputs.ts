import { Confidant, Task, TaskMaker } from "./task"

export class Inputs_<C, V> extends Task<C, V> {
  private unsubs: Array<() => void> = []

  constructor(
    confidant: Confidant<C, Record<string, any>>,
    private keys: string[],
    private fn: (...values: any[]) => TaskMaker<C, V>,
  ) {
    super(confidant)
  }

  async initialize(): Promise<V> {
    const results = await this.getResults()

    this.unsubs = this.keys.map(key =>
      this.confidant.onUpdate(key, () => {
        void this.updateDownstream()
      }),
    )

    return this.fn(...results)(this.confidant).runInitialize()
  }

  onDestroy() {
    this.unsubs.forEach(unsub => unsub())
  }

  private getResults(): Promise<unknown[]> {
    return Promise.all(this.keys.map(key => this.confidant.get(key)))
  }

  public async updateDownstream() {
    const key = this.confidant.keyForTask(this)

    if (key) {
      const results = await this.getResults()
      void this.confidant.replaceKey(key, this.fn(...results))
    }
  }
}

export const Inputs = (...keys: string[]) => ({
  chain:
    <C, V>(fn: (...values: any[]) => TaskMaker<C, V>) =>
    (manager: Confidant<C, Record<string, any>>) =>
      new Inputs_(manager, keys, fn),
})

export type Inputs<C, V> = Inputs_<C, V>
