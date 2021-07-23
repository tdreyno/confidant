import { timeout } from "../util/timeout"
import winston from "winston"
import ms from "ms"

class Confidant_<C extends any, Ms extends Record<string, TaskMaker<C, any>>> {
  tasks: { [K in keyof Ms]: Task<C, TaskMakerResult<Ms[K]>> }
  public globalTimeout: number
  public logger: winston.Logger

  constructor(
    public context: C,
    taskMakers: Ms,
    options: {
      logger: winston.Logger
      timeout: string
    },
  ) {
    this.globalTimeout = ms(options.timeout)
    this.logger = options.logger

    this.tasks = Object.entries(taskMakers).reduce((acc: any, [key, maker]) => {
      acc[key] = maker(this)
      return acc
    }, {})
  }

  onInitialize<K extends keyof Ms>(
    key: K,
    fn: (value: TaskMakerResult<Ms[K]>) => void,
  ): () => void {
    return this.tasks[key].onInitialize(fn)
  }

  onUpdate<K extends keyof Ms>(
    key: K,
    fn: (value: TaskMakerResult<Ms[K]>) => void,
  ): () => void {
    return this.tasks[key].onUpdate(fn)
  }

  async replaceKey<K extends keyof Ms>(
    key: K,
    taskMaker: Ms[K],
  ): Promise<void> {
    const oldTask = this.tasks[key]

    const task = taskMaker(this)

    task.updateListeners = new Set([...oldTask.updateListeners])

    const value = await task.runInitialize()

    oldTask.destroy()

    this.tasks[key] = task

    task.updateListeners.forEach(listener => listener(value))
  }

  keyForTask(task: Task<any, any>): string | undefined {
    for (const [key, value] of Object.entries(this.tasks)) {
      if (value === task) {
        return key
      }
    }
  }

  get<K extends keyof Ms>(key: K): Promise<TaskMakerResult<Ms[K]>> {
    if (!this.tasks.hasOwnProperty(key)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return Promise.reject(new Error(`Invalid key: ${key}`))
    }

    return this.tasks[key].get()
  }

  async initialize<
    R extends {
      [K in keyof Ms]: TaskMakerResult<Ms[K]>
    },
  >(): Promise<R> {
    const results = await Promise.all(
      Object.values(this.tasks).map(task => task.runInitialize()),
    )

    return Object.keys(this.tasks).reduce((acc, key: keyof Ms, i) => {
      acc[key] = results[i]
      return acc
    }, {} as R)
  }

  runInitialize<K extends keyof Ms>(key: K): Promise<TaskMakerResult<Ms[K]>> {
    return this.tasks[key].runInitialize()
  }
}

export const Confidant = <
  Ms extends {
    [key: string]: TaskMaker<any, any>
  },
  C = Ms extends {
    [key: string]: TaskMaker<infer PossibleC, any>
  }
    ? PossibleC
    : never,
>(
  context: C,
  taskMakers: Ms,
  options?: {
    logger?: winston.Logger
    timeout?: string
  },
) =>
  new Confidant_(context, taskMakers, {
    logger:
      (options && options.logger) ||
      winston.createLogger({
        silent: true,
      }),
    timeout: (options && options.timeout) || "30s",
  })

export type Confidant<
  C extends any,
  Ms extends Record<string, TaskMaker<C, any>>,
> = Confidant_<C, Ms>

export abstract class Task<C, V> {
  private hasInitialized = false
  protected currentValue: V | undefined
  protected timeout: number
  public initListeners: Set<(value: V) => void> = new Set()
  public updateListeners: Set<(value: V) => void> = new Set()

  constructor(
    protected confidant: Confidant_<C, Record<string, any>>,
    timeout?: string,
  ) {
    this.timeout = timeout
      ? ms(timeout)
      : this.confidant
      ? this.confidant.globalTimeout
      : ms("30s")
  }

  get logger() {
    return this.confidant.logger
  }

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
    this.initListeners.add(fn)
    return () => this.initListeners.delete(fn)
  }

  public onUpdate(fn: (value: V) => void): () => void {
    this.updateListeners.add(fn)
    return () => this.updateListeners.delete(fn)
  }

  set(value: V): void {
    if (!this.hasInitialized) {
      throw new Error("Cannot set Task value before initialization")
    }

    if (this.currentValue === value) {
      return
    }

    this.currentValue = value

    this.updateListeners.forEach(listener => listener(value))
  }

  update(fn: (currentValue: V) => V): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.set(fn(this.currentValue!))
  }

  public async runInitialize(): Promise<V> {
    if (this.hasInitialized) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.currentValue!
    }

    const value = await Promise.race([
      timeout<V>(this.timeout),
      this.initialize(),
    ])

    this.hasInitialized = true
    this.currentValue = value
    this.initListeners.forEach(listener => listener(value))

    return value
  }

  destroy() {
    this.initListeners = new Set()
    this.updateListeners = new Set()

    this.onDestroy()
  }

  protected onDestroy() {
    return
  }
}

export type TaskMaker<C, V> = (
  manager: Confidant_<C, Record<string, any>>,
) => Task<C, V>

export type TaskMakerResult<T extends TaskMaker<any, any>> =
  T extends TaskMaker<any, infer V> ? V : never

export type TaskMakerContext<T extends TaskMaker<any, any>> =
  T extends TaskMaker<infer C, any> ? C : never

export type TaskResult<T extends Task<any, any>> = T extends Task<any, infer V>
  ? V
  : never
