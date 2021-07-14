import { timeout } from "../util/timeout"

export class Confidant<
  C extends any,
  Ms extends Record<string, TaskMaker<C, any>>,
> {
  tasks: { [K in keyof Ms]: Task<C, TaskMakerResult<Ms[K]>> }

  constructor(public context: C, taskMakers: Ms) {
    this.tasks = Object.entries(taskMakers).reduce((acc: any, [key, maker]) => {
      acc[key] = maker(this)
      return acc
    }, {})
  }

  onInitialize<K extends keyof Ms>(
    key: K,
    fn: (value: TaskMakerResult<Ms[K]>) => void,
  ) {
    this.tasks[key].onInitialize(fn as any)
  }

  get<K extends keyof Ms>(key: K): Promise<TaskMakerResult<Ms[K]>> {
    if (!this.tasks.hasOwnProperty(key)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return Promise.reject(new Error(`Invalid key: ${key}`))
    }

    return this.tasks[key].get()
  }

  initialize(): void {
    Object.keys(this.tasks).map(key => this.tasks[key].runInitialize())
  }

  runInitialize<K extends keyof Ms>(key: K): Promise<TaskMakerResult<Ms[K]>> {
    return this.tasks[key].runInitialize()
  }
}

export abstract class Task<C, V> {
  private hasInitialized = false
  protected currentValue: V | undefined
  private listeners: Set<(value: V) => void> = new Set()

  constructor(
    protected manager: Confidant<C, Record<string, any>>,
    protected timeout = Infinity,
  ) {}

  abstract initialize(): Promise<V>

  public get(): Promise<V> {
    if (this.hasInitialized) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Promise.resolve(this.currentValue!)
    }

    return new Promise(resolve => {
      this.onInitialize(v => resolve(v))
    })
  }

  public onInitialize(fn: (value: V) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onUpdate(newValue: V) {
    if (this.currentValue === newValue) {
      return
    }

    this.currentValue = newValue
    // TODO: Notify
  }

  public runInitialize(): Promise<V> {
    if (this.hasInitialized) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Promise.resolve(this.currentValue!)
    }

    return Promise.race([timeout<V>(this.timeout), this.initialize()]).then(
      value => {
        this.didInitialize(value)

        return value
      },
    )
  }

  private didInitialize(value: V) {
    this.hasInitialized = true
    this.currentValue = value
    this.listeners.forEach(listener => listener(value))
  }
}

export const isTask = <C, V>(s: Task<C, V> | unknown): s is Task<C, V> =>
  s instanceof Task

export type TaskMaker<C, V> = (
  manager: Confidant<C, Record<string, any>>,
) => Task<C, V>

export type TaskMakerResult<T extends TaskMaker<any, any>> =
  T extends TaskMaker<any, infer V> ? V : never

export type TaskResult<T extends Task<any, any>> = T extends Task<any, infer V>
  ? V
  : never