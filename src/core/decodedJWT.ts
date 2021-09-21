import { decode } from "jsonwebtoken"
import { Confidant, Task, TaskMaker } from "./task"
import { EmptyContext } from "../util/emptyContext"

class DecodedJWT_<T> extends Task<EmptyContext, T> {
  constructor(
    confidant: Confidant<EmptyContext, Record<string, any>>,
    public jwt_: string,
    public validator_: (jwt: unknown) => T,
  ) {
    super(confidant)
  }

  async initialize(): Promise<T> {
    return this.validator_(decode(this.jwt_))
  }
}

export const DecodedJWT =
  <T>(validator: (jwt: unknown) => T) =>
  (jwt: string): TaskMaker<EmptyContext, T> =>
  manager =>
    new DecodedJWT_(manager, jwt, validator)

export type DecodedJWT<T> = DecodedJWT_<T>
