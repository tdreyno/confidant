import { Confidant, GetContext, Task, TaskMaker, TaskMakerResult } from "./task"

export class Group_<
  Ms extends {
    [key: string]: TaskMaker<any, any>
  },
  C extends GetContext<Ms>,
  V extends {
    [K in keyof Ms]: TaskMakerResult<Ms[K]>
  },
> extends Task<C, V> {
  private nestedConfidant: Confidant<C, Record<string, any>>
  private unsubs: Array<() => void> = []

  constructor(confidant: Confidant<C, Record<string, any>>, public tasks: Ms) {
    super(confidant)

    this.nestedConfidant = Confidant(this.confidant.context, this.tasks, {
      logger: confidant.logger,
      timeout: confidant.timeout,
    })
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
  Ms extends {
    [key: string]: TaskMaker<any, any>
  },
  C extends GetContext<Ms>,
  R extends {
    [K in keyof Ms]: TaskMakerResult<Ms[K]>
  },
>(
  nested: Ms,
): TaskMaker<C, R> & { tasks: Ms } => {
  const createTask = (confidant: Confidant<C, Record<string, any>>) =>
    new Group_<Ms, C, R>(confidant, nested)

  createTask.tasks = nested

  return createTask
}

export type Group<
  Ms extends {
    [key: string]: TaskMaker<any, any>
  },
  C extends GetContext<Ms>,
  R extends {
    [K in keyof Ms]: TaskMakerResult<Ms[K]>
  },
> = Group_<Ms, C, R>
