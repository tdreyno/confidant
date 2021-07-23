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
  }

  initialize(): Promise<string> {
    return this.retryFetchJWT()
  }

  protected async retryFetchJWT(): Promise<string> {
    const hit = this.manager.get(this.cacheKey)

    if (hit) {
      return hit
    }

    try {
      const jwt = await retry(() => this.fetchJWT(), this.retry)

      this.manager.set(this.cacheKey, jwt, this.notifyOnExpiry.bind(this))

      return jwt
    } catch (e) {
      this.manager.remove(this.cacheKey)

      throw e
    }
  }

  abstract fetchJWT(): Promise<string>

  notifyOnExpiry() {
    return
  }
}
