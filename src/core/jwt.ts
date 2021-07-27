import retry from "async-retry"
import AsyncRetry from "async-retry"
import Singleton from "./jwtManager"
import { Confidant, Task } from "./task"

type JWTContext = any

export abstract class JWT extends Task<JWTContext, string> {
  constructor(
    confidant: Confidant<JWTContext, Record<string, any>>,
    protected cacheKey: string,
    protected manager = Singleton,
    protected retry: AsyncRetry.Options = {},
  ) {
    super(confidant)

    this.manager.setLogger(this.confidant.logger)
  }

  initialize(): Promise<string> {
    return this.retryFetchJWT()
  }

  protected async retryFetchJWT(): Promise<string> {
    const hit = this.manager.get(this.cacheKey)

    if (hit) {
      this.logger.debug(`JWT cache hit: ${this.cacheKey}`)
      return hit
    }

    try {
      this.logger.debug(`Fetching JWT: ${this.cacheKey}`)
      const jwt = await retry(() => this.fetchJWT(), this.retry)

      this.manager.set(this.cacheKey, jwt, () => {
        this.logger.debug(`JWT expired: ${this.cacheKey}`)
        void this.invalidate()
      })

      return jwt
    } catch (e) {
      this.manager.remove(this.cacheKey)

      throw e
    }
  }

  abstract fetchJWT(): Promise<string>

  async invalidate(): Promise<string> {
    this.manager.remove(this.cacheKey)

    const newValue = await this.retryFetchJWT()

    this.set(newValue)

    return newValue
  }
}
