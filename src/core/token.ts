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
    public cacheKey_: string,
    public tokenManager_: TokenManager,
    public retry_: AsyncRetry.Options = {},
  ) {
    super(confidant)

    this.tokenManager_.setLogger(this.confidant_.logger)
  }

  initialize(): Promise<string> {
    if (this.state !== TaskState.PENDING) {
      throw new Error(`JWT Task (${this.name}) has already initialized`)
    }

    return this.retryFetchToken_()
  }

  onDestroy_(): void {
    this.tokenManager_.remove(this.cacheKey_)
  }

  async retryFetchToken_(): Promise<string> {
    if (this.state === TaskState.DESTROYED) {
      throw new Error(`JWT Task (${this.name}) has been destroyed`)
    }

    const hit = this.tokenManager_.get(this.cacheKey_)

    if (hit) {
      // this.logger.debug(`JWT cache hit: ${this.name} - ${this.cacheKey}`)
      return hit
    }

    try {
      this.logger.debug(`JWT Fetching (${this.name})`)
      const jwt = await retry(() => this.fetchToken(), this.retry_)
      this.logger.debug(`JWT Received (${this.name}): ${shorten(jwt)}`)

      this.tokenManager_.set(
        this.cacheKey_,
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
      this.tokenManager_.remove(this.cacheKey_)

      throw e
    }
  }

  abstract fetchToken(): Promise<string>

  async invalidate(path?: string): Promise<void> {
    if (path && path.length > 0) {
      return
    }

    if (this.state === TaskState.DESTROYED) {
      throw new Error("Task has been destroyed")
    }

    if (this.state === TaskState.UPDATING) {
      return
    }

    this.tokenManager_.remove(this.cacheKey_)

    this.state = TaskState.UPDATING
    const newValue = await this.retryFetchToken_()

    this.set(newValue)
  }

  nextRefreshTime(data: string, refetchBufferTimeMs = 0): number {
    return nextRefreshTime(data, refetchBufferTimeMs)
  }
}

// Backwards compat
export const JWT = Token
