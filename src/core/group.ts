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
  nestedConfidant_: Confidant<C, Record<string, any>>
  unsubs_: Array<() => void> = []

  constructor(confidant: Confidant<C, Record<string, any>>, public tasks: Ms) {
    super(confidant)

    this.nestedConfidant_ = Confidant(this.confidant_.context, this.tasks, {
      logger: this.confidant_.logger,
      timeout: this.confidant_.timeout,
    })
  }

  async initialize(): Promise<V> {
    const results: V = await this.nestedConfidant_.initialize()

    this.unsubs_ = Object.keys(this.tasks).map(key =>
      this.nestedConfidant_.onUpdate(key, () => {
        void this.updateDownstream_(key)
      }),
    )

    return results
  }

  async updateDownstream_(key: string) {
    const updated = await this.nestedConfidant_.get(key)

    this.update(current => {
      return {
        ...current,
        [key]: updated,
      }
    })
  }

  onDestroy_() {
    this.unsubs_.forEach(unsub => unsub())
  }

  async invalidate(path?: string): Promise<void> {
    if (!path || path.length <= 0) {
      return
    }

    // console.log(`Group invalidate ${path}`)

    const [head, ...tail] = path.split(".")

    await this.nestedConfidant_.tasks[head].invalidate(tail.join("."))
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
