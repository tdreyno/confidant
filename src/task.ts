import { timeout } from "./util"

export class Confidant<C, V extends any, H extends Record<string, Task<C, V>>> {
  constructor(public context: C, private handlers: H) {}

  onInitialize<K extends keyof H>(
    key: K,
    fn: (value: TaskResult<H[K]>) => void,
  ) {
    this.handlers[key].onInitialize(fn as any)
  }

  get<V2 = unknown>(key: keyof H): Promise<V2> {
    if (!this.handlers.hasOwnProperty(key)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return Promise.reject(new Error(`Invalid key: ${key}`))
    }

    return this.handlers[key].get() as Promise<V2>
  }

  initializeTask(task: Task<C, V>): Promise<V> {
    return task.runInitialize()
  }
}

export abstract class Task<C, V> {
  private hasInitialized = false
  protected currentValue: V | undefined
  private listeners: Set<(value: V) => void> = new Set()

  constructor(
    protected manager: Confidant<C, V, Record<string, any>>,
    protected timeout = Infinity,
  ) {}

  abstract initialize(): Promise<V>

  public get(): Promise<V> {
    if (this.hasInitialized) {
      console.log("cached")
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
  manager: Confidant<C, any, Record<string, any>>,
) => Task<C, V>

export type TaskResult<T extends Task<any, any>> = T extends Task<any, infer V>
  ? V
  : never
