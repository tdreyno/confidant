import retry from "async-retry"
import AsyncRetry from "async-retry"
import { shorten } from "../util/shorten"
import { nextRefreshTime } from "../util/jwtExpiry"
import { TokenManager } from "./tokenManager"
import { Confidant, Task, TaskState } from "./task"
import { EmptyContext } from "../util/emptyContext"

export abstract class Token extends Task<EmptyContext, string> {
  constructor(
    confidant: Confidant<EmptyContext, Record<string, any>>,
    public name: string,
    protected cacheKey: string,
    protected tokenManager: TokenManager,
    protected retry: AsyncRetry.Options = {},
  ) {
    super(confidant)

    this.tokenManager.setLogger(this.confidant.logger)
  }

  initialize(): Promise<string> {
    if (this.state !== TaskState.PENDING) {
      throw new Error(`JWT Task (${this.name}) has already initialized`)
    }

    return this.retryFetchToken()
  }

  onDestroy(): void {
    this.tokenManager.remove(this.cacheKey)
  }

  protected async retryFetchToken(): Promise<string> {
    if (this.state === TaskState.DESTROYED) {
      throw new Error(`JWT Task (${this.name}) has been destroyed`)
    }

    const hit = this.tokenManager.get(this.cacheKey)

    if (hit) {
      // this.logger.debug(`JWT cache hit: ${this.name} - ${this.cacheKey}`)
      return hit
    }

    try {
      this.logger.debug(`JWT Fetching (${this.name})`)
      const jwt = await retry(() => this.fetchToken(), this.retry)
      this.logger.debug(`JWT Received (${this.name}): ${shorten(jwt)}`)

      this.tokenManager.set(
        this.cacheKey,
        jwt,
        () => {
          if (this.state === TaskState.DESTROYED) {
            return true // unsubscribe
          }

          this.logger.debug(`JWT expired (${this.name})`)
          void this.invalidate()
        },
        this.nextRefreshTime.bind(this),
      )

      return jwt
    } catch (e) {
      this.tokenManager.remove(this.cacheKey)

      throw e
    }
  }

  abstract fetchToken(): Promise<string>

  async invalidate(): Promise<string> {
    if (this.state === TaskState.DESTROYED) {
      throw new Error("Task has been destroyed")
    }

    if (this.state === TaskState.UPDATING) {
      return this.get()
    }

    this.tokenManager.remove(this.cacheKey)

    this.state = TaskState.UPDATING
    const newValue = await this.retryFetchToken()

    this.set(newValue)

    return newValue
  }

  nextRefreshTime(data: string, refetchBufferTimeMs = 0): number {
    return nextRefreshTime(data, refetchBufferTimeMs)
  }
}

// Backwards compat
export const JWT = Token
