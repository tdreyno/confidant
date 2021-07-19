import jwt from "jsonwebtoken"
import Singleton from "./tokenManager"
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
    return this.fetchTokenAndDecode()
  }

  protected fetchTokenAndDecode() {
    return this.fetchToken()
      .then(token => this.decodeToken(token))
      .then(data => this.validateToken(data))
  }

  abstract fetchToken(): Promise<string>

  protected decodeToken(token: string): Record<string, unknown> {
    return jwt.decode(token) as Record<string, unknown>
  }

  validateToken(data: Record<string, unknown>): V {
    return data as unknown as V
  }
}
