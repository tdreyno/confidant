import { timeout } from "../util/timeout"
import { createLogger, Logger } from "winston"
import ms from "ms"
import { U } from "ts-toolbelt"

class Confidant_<
  C extends Record<string, any>,
  Ms extends Record<string, TaskMaker<C, any>>,
> {
  tasks: { [K in keyof Ms]: Task<C, TaskMakerResult<Ms[K]>> }
  globalTimeout: number
  timeout: string
  logger: Logger

  constructor(
    public context: C,
    taskMakers: Ms,
    options: {
      logger: Logger
      timeout: string
    },
  ) {
    this.timeout = options.timeout
    this.globalTimeout = ms(options.timeout)
    this.logger = options.logger

    this.tasks = Object.entries(taskMakers).reduce((acc: any, [key, maker]) => {
      acc[key] = maker(this as any)
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

    const task = taskMaker(this as any)

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

  invalidate<K extends keyof Ms>(key: K): Promise<TaskMakerResult<Ms[K]>> {
    return this.tasks[key].invalidate()
  }
}

type ValueOf<T> = T[keyof T]

type KeyToContext<
  O extends {
    [key: string]: TaskMaker<any, any>
  },
> = {
  [K in keyof O]: TaskMakerContext<O[K]>
}

export type GetContext<
  O extends {
    [key: string]: TaskMaker<any, any>
  },
> = Omit<U.Merge<ValueOf<KeyToContext<O>>>, "__empty">

export const Confidant = <
  Ms extends {
    [key: string]: TaskMaker<any, any>
  },
  Cs extends GetContext<Ms>,
>(
  context: Cs,
  taskMakers: Ms,
  options?: {
    logger?: Logger
    timeout?: string
  },
) =>
  new Confidant_(context, taskMakers, {
    logger:
      (options && options.logger) ||
      createLogger({
        silent: true,
      }),
    timeout: (options && options.timeout) || "30s",
  })

export type Confidant<
  C extends Record<string, any>,
  Ms extends Record<string, TaskMaker<C, any>>,
> = Confidant_<C, Ms>

export enum TaskState {
  PENDING = "PENDING",
  INITIALIZED = "INITIALIZED",
  UPDATING = "UPDATING",
  DESTROYED = "DESTROYED",
}

export class Task<C, V> {
  state: TaskState = TaskState.PENDING
  currentValue_: V | undefined
  timeout_: number
  initListeners: Set<(value: V) => void> = new Set()
  updateListeners: Set<(value: V) => void> = new Set()

  constructor(
    public confidant_: Confidant<C, Record<string, any>>,
    timeout?: string,
  ) {
    if (
      !(confidant_ instanceof Confidant_) &&
      !(confidant_ as any).confidantMock_
    ) {
      throw new Error("Invalid confidant object")
    }

    if (!this.validateContext_()) {
      throw new Error("Invalid confidant object context")
    }

    this.timeout_ = timeout
      ? ms(timeout)
      : this.confidant_
      ? this.confidant_.globalTimeout
      : ms("30s")
  }

  validateContext_(): boolean {
    return true
  }

  get logger() {
    return this.confidant_.logger
  }

  initialize(): Promise<V> {
    throw new Error("Must be overridden in class")
  }

  get(): Promise<V> {
    // this.logger.debug(`Current task state: ${this.state}`)

    if (this.state === TaskState.DESTROYED) {
      return Promise.reject("Task has been destroyed")
    }

    if (this.state === TaskState.INITIALIZED) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Promise.resolve(this.currentValue_!)
    }

    if (this.state === TaskState.UPDATING) {
      return new Promise(resolve => {
        const unSub = this.onUpdate(v => {
          resolve(v)
          unSub()
        })
      })
    }

    return new Promise(resolve => {
      const unSub = this.onInitialize(v => {
        resolve(v)
        unSub()
      })
    })
  }

  onInitialize(fn: (value: V) => void): () => void {
    this.initListeners.add(fn)
    return () => this.initListeners.delete(fn)
  }

  onUpdate(fn: (value: V) => void): () => void {
    this.updateListeners.add(fn)
    return () => this.updateListeners.delete(fn)
  }

  set(value: V): void {
    if (this.state === TaskState.DESTROYED) {
      throw new Error("Task has been destroyed")
    }

    if (this.state === TaskState.PENDING) {
      throw new Error("Cannot set Task value before initialization")
    }

    if (this.currentValue_ === value) {
      return
    }

    this.currentValue_ = value

    this.updateListeners.forEach(listener => listener(value))

    this.state = TaskState.INITIALIZED
  }

  update(fn: (currentValue: V) => V): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.set(fn(this.currentValue_!))
  }

  async runInitialize(): Promise<V> {
    if (this.state === TaskState.DESTROYED) {
      throw new Error("Task has been destroyed")
    }

    if (this.state === TaskState.INITIALIZED) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.currentValue_!
    }

    const value = await Promise.race([
      timeout(this.timeout_) as Promise<V>,
      this.initialize(),
    ])

    this.state = TaskState.INITIALIZED
    this.currentValue_ = value
    this.initListeners.forEach(listener => listener(value))

    return value
  }

  destroy() {
    this.initListeners = new Set()
    this.updateListeners = new Set()

    this.onDestroy_()

    this.state = TaskState.DESTROYED
  }

  onDestroy_() {
    return
  }

  async invalidate(): Promise<V> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.currentValue_!
  }
}

export type TaskMaker<C extends Record<string, any>, V> = (
  confidant: Confidant<C, Record<string, any>>,
) => Task<C, V>

export type TaskMakerResult<T extends TaskMaker<any, any>> =
  T extends TaskMaker<any, infer V> ? V : never

export type TaskMakerContext<T extends TaskMaker<Record<string, any>, any>> =
  T extends TaskMaker<infer C, any> ? C : never

export type TaskResult<T extends Task<any, any>> = T extends Task<any, infer V>
  ? V
  : never
