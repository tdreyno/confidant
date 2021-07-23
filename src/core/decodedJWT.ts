import { decode } from "jsonwebtoken"
import { Task, TaskMaker } from "./task"

type DecodedJWTContext = any

class DecodedJWT_<T> extends Task<DecodedJWTContext, T> {
  constructor(
    manager: DecodedJWTContext,
    private jwt: string,
    private validator: (jwt: unknown) => T,
  ) {
    super(manager)
  }

  async initialize(): Promise<T> {
    return this.validator(decode(this.jwt))
  }
}

export const DecodedJWT =
  <T>(validator: (jwt: unknown) => T) =>
  (jwt: string): TaskMaker<DecodedJWTContext, T> =>
  manager =>
    new DecodedJWT_(manager, jwt, validator)

export type DecodedJWT<T> = DecodedJWT_<T>
