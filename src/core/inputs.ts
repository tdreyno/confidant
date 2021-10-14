import { Confidant, Task, TaskMaker } from "./task"

export class Inputs_<C, V> extends Task<C, V> {
  unsubs_: Array<() => void> = []
  nestedTask_?: Task<C, V>

  constructor(
    confidant: Confidant<C, Record<string, any>>,
    public keys_: string[],
    public fn_: (...values: any[]) => TaskMaker<C, V>,
  ) {
    super(confidant)
  }

  async initialize(): Promise<V> {
    const results = await this.getResults_()

    this.unsubs_ = this.keys_.map(key =>
      this.confidant_.onUpdate(key, () => {
        void this.updateDownstream_()
      }),
    )

    this.nestedTask_ = this.fn_(...results)(this.confidant_)

    return this.nestedTask_.runInitialize()
  }

  onDestroy_() {
    this.unsubs_.forEach(unsub => unsub())

    if (this.nestedTask_) {
      this.nestedTask_.destroy()
    }
  }

  getResults_(): Promise<unknown[]> {
    return Promise.all(this.keys_.map(key => this.confidant_.get(key)))
  }

  async updateDownstream_() {
    const key = this.confidant_.keyForTask(this)

    if (key) {
      const results = await this.getResults_()
      void this.confidant_.replaceKey(key, this.fn_(...results))
    }
  }

  async invalidate(path?: string): Promise<void> {
    if (path && path.length > 0) {
      return
    }

    // console.log(`Input invalidate`)

    if (this.nestedTask_) {
      await this.nestedTask_.invalidate()
      this.set(await this.nestedTask_.get())
    }
  }
}

export const Inputs = (...keys: string[]) => ({
  chain:
    <C, V>(fn: (...values: any[]) => TaskMaker<C, V>): TaskMaker<C, V> =>
    confidant =>
      new Inputs_(confidant, keys, fn),
})

export type Inputs<C, V> = Inputs_<C, V>
