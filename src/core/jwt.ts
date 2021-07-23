import retry from "async-retry"
import AsyncRetry from "async-retry"
import { decode } from "jsonwebtoken"
import Singleton from "./jwtManager"
import { Confidant, Task } from "./task"

type JWTContext = any

export abstract class JWT<V extends { exp: number }> extends Task<
  JWTContext,
  V
> {
  constructor(
    confidant: Confidant<JWTContext, Record<string, any>>,
    protected cacheKey: string,
    protected manager = Singleton,
    protected retry: AsyncRetry.Options = {},
  ) {
    super(confidant)
  }

  initialize(): Promise<V> {
    return this.fetchJWTAndDecode()
  }

  protected async fetchJWTAndDecode(): Promise<V> {
    let jwt = this.manager.get(this.cacheKey)

    if (!jwt) {
      try {
        jwt = await retry(() => this.fetchJWT(), this.retry)

        this.manager.set(this.cacheKey, jwt, this.notifyOnExpiry.bind(this))
      } catch (e) {
        this.manager.remove(this.cacheKey)

        throw e
      }
    }

    const data = this.decodeJWT(jwt)

    return this.validateJWTData(data)
  }

  abstract fetchJWT(): Promise<string>

  notifyOnExpiry() {
    return
  }

  protected decodeJWT(jwt: string): Record<string, unknown> {
    return decode(jwt) as Record<string, unknown>
  }

  validateJWTData(data: Record<string, unknown>): V {
    return data as unknown as V
  }
}
