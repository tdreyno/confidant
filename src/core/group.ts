import { Confidant, Task, TaskMaker, TaskMakerResult } from "./task"

export class Group_<
  C,
  V extends {
    [key: string]: any
  },
> extends Task<C, V> {
  private nestedConfidant: Confidant<C, Record<string, any>>
  private unsubs: Array<() => void> = []

  constructor(
    confidant: Confidant<C, Record<string, any>>,
    public tasks: Record<string, TaskMaker<C, any>>,
  ) {
    super(confidant)

    this.nestedConfidant = Confidant(this.confidant.context, this.tasks)
  }

  async initialize(): Promise<V> {
    const results: V = await this.nestedConfidant.initialize()

    this.unsubs = Object.keys(this.tasks).map(key =>
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

export const Group = <
  C,
  Ms extends { [key: string]: TaskMaker<any, any> },
  R extends {
    [K in keyof Ms]: TaskMakerResult<Ms[K]>
  },
>(
  nested: Ms,
) => {
  const createTask = (manager: Confidant<C, Record<string, any>>) =>
    new Group_<C, R>(manager, nested)

  createTask.tasks = nested

  return createTask
}

export type Group<
  C,
  R extends {
    [key: string]: any
  },
> = Group_<C, R>
