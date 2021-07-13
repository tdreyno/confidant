import { timeout } from "../util/index"

export class Confidant<C extends any, H extends Record<string, Task<C, any>>> {
  constructor(public context: C, private handlers: H) {}

  onInitialize<K extends keyof H>(
    key: K,
    fn: (value: TaskResult<H[K]>) => void,
  ) {
    this.handlers[key].onInitialize(fn as any)
  }

  get<K extends keyof H>(key: K): Promise<TaskResult<H[K]>> {
    if (!this.handlers.hasOwnProperty(key)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return Promise.reject(new Error(`Invalid key: ${key}`))
    }

    return this.handlers[key].get() as Promise<TaskResult<H[K]>>
  }

  runInitialize<K extends keyof H>(key: K): Promise<TaskResult<H[K]>> {
    return this.handlers[key].runInitialize() as Promise<TaskResult<H[K]>>
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

export type TaskResult<T extends Task<any, any>> = T extends Task<any, infer V>
  ? V
  : never
