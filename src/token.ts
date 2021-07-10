import fetch from "node-fetch"
import retry from "async-retry"
import { Manager, Task } from "./task"

export const requestJWT = (
  url: string,
  username: string,
  password: string,
): Promise<string> =>
  fetch(url, {
    method: "post",
    body: JSON.stringify({
      auth: { username, password },
    }),
    headers: { "Content-Type": "application/json" },
  })
    .then(res => res.text())
    .then(token => {
      if (token === "") {
        return Promise.reject(new Error(`Bad token.`))
      }

      return token
    })

type TokenContext = any

export abstract class Token<V extends { exp: number }> extends Task<
  TokenContext,
  V
> {
  constructor(
    manager: Manager<TokenContext, any, Record<string, any>>,
    private tokenRefetchBufferTimeSeconds = 5 * 60, // 5 Minutes
  ) {
    super(manager)
  }

  initialize(): Promise<V> {
    return this.retryFetchToken().then(data => {
      const timeTilExpireSeconds = this.getSecondsTilJwtExpires()
      const bufferTime = this.tokenRefetchBufferTimeSeconds ?? 0
      const delay = Math.max(timeTilExpireSeconds - bufferTime, 0) * 1000

      setTimeout(() => {
        this.retryFetchToken().then(value => this.onUpdate(value))
      }, delay)

      return data
    })
  }

  private retryFetchToken() {
    return retry(() =>
      this.fetchToken().then((token: string) => this.decodeToken(token)),
    )
  }

  abstract fetchToken(): Promise<string>

  abstract decodeToken(token: string): V

  getSecondsTilJwtExpires(): number {
    const { exp } = this.currentValue!
    return Math.floor((exp * 1000 - Date.now()) / 1000)
  }
}
