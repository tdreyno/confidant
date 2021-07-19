import jwt from "jsonwebtoken"
import Singleton from "./tokenManager"
import { Confidant, Task } from "./task"

type TokenContext = any

export abstract class Token<V extends { exp: number }> extends Task<
  TokenContext,
  V
> {
  constructor(
    confidant: Confidant<TokenContext, Record<string, any>>,
    protected manager = Singleton,
  ) {
    super(confidant)
  }

  initialize(): Promise<V> {
    return this.fetchTokenAndDecode()
  }

  protected fetchTokenAndDecode() {
    return this.fetchToken().then((token: string) => this.decodeToken(token))
  }

  abstract fetchToken(): Promise<string>

  decodeToken(token: string): V {
    return jwt.decode(token) as unknown as V
  }
}
