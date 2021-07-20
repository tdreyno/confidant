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
    protected manager = Singleton,
  ) {
    super(confidant)
  }

  initialize(): Promise<V> {
    return this.fetchJWTAndDecode()
  }

  protected async fetchJWTAndDecode(): Promise<V> {
    const jwt = await this.fetchJWT()

    const data = this.decodeJWT(jwt)

    return this.validateJWTData(data)
  }

  abstract fetchJWT(): Promise<string>

  protected decodeJWT(jwt: string): Record<string, unknown> {
    return decode(jwt) as Record<string, unknown>
  }

  validateJWTData(data: Record<string, unknown>): V {
    return data as unknown as V
  }
}
