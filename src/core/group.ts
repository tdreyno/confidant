import { Confidant, Task, TaskMaker, TaskMakerResult } from "./task"

export class Group_<
  C,
  V extends {
    [key: string]: any
  },
> extends Task<C, V> {
  private nestedConfidant: Confidant<C, Record<string, any>>
  private unsubs: Array<() => void> = []
  private keys: string[]

  constructor(
    confidant: Confidant<C, Record<string, any>>,
    nested: Record<string, TaskMaker<C, any>>,
  ) {
    super(confidant)

    this.keys = Object.keys(nested)
    this.nestedConfidant = Confidant(this.confidant.context, nested)
  }

  async initialize(): Promise<V> {
    const results: V = await this.nestedConfidant.initialize()

    this.unsubs = this.keys.map(key =>
      this.nestedConfidant.onUpdate(key, () => {
        void this.updateDownstream(key)
      }),
    )

    return results
  }

  private async updateDownstream(key: string) {
    const updated = await this.nestedConfidant.get(key)

    this.update(current => {
      return {
        ...current,
        [key]: updated,
      }
    })
  }

  onDestroy() {
    this.unsubs.forEach(unsub => unsub())
  }
}

export const Group =
  <
    C,
    Ms extends { [key: string]: TaskMaker<any, any> },
    R extends {
      [K in keyof Ms]: TaskMakerResult<Ms[K]>
    },
  >(
    nested: Ms,
  ) =>
  (manager: Confidant<C, Record<string, any>>) =>
    new Group_<C, R>(manager, nested)

export type Group<
  C,
  R extends {
    [key: string]: any
  },
> = Group_<C, R>
