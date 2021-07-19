import fetch from "node-fetch"
import jwt from "jsonwebtoken"
import retry from "async-retry"
import AsyncRetry from "async-retry"

function getSecondsTilJwtExpires(exp: number): number {
  return Math.floor((exp * 1000 - Date.now()) / 1000)
}

export class TokenManager {
  private cache: {
    [url: string]: {
      [username: string]: {
        [password: string]: string
      }
    }
  } = {}

  constructor(
    private tokenRefetchBufferTimeSeconds = 5 * 60, // 5 Minutes
  ) {}

  clear() {
    this.cache = {}
  }

  get(url: string, username: string, password: string) {
    return this.cache[url]
      ? this.cache[url][username]
        ? this.cache[url][username][password]
        : null
      : null
  }

  set(
    url: string,
    username: string,
    password: string,
    token: string,
    notifyOnExpiry?: () => void,
  ) {
    if (this.isExpired(token)) {
      console.warn("Do not add expired tokens")

      if (notifyOnExpiry) {
        notifyOnExpiry()
      }

      return
    }

    if (!this.cache[url]) {
      this.cache[url] = {}
    }

    if (!this.cache[url][username]) {
      this.cache[url][username] = {}
    }

    this.cache[url][username][password] = token

    if (notifyOnExpiry) {
      const delay = this.nextRefreshTime(token)

      setTimeout(() => {
        notifyOnExpiry()
      }, delay)
    }
  }

  remove(url: string, username: string, password: string) {
    if (!this.cache[url]) {
      return
    }

    if (!this.cache[url][username]) {
      return
    }

    delete this.cache[url][username][password]
  }

  private nextRefreshTime(data: string): number {
    const token = jwt.decode(data) as unknown as { exp?: number }

    if (!token.exp) {
      return Infinity
    }

    const timeTilExpireSeconds = getSecondsTilJwtExpires(token.exp)
    const bufferTime = this.tokenRefetchBufferTimeSeconds ?? 0
    const delay = Math.max(timeTilExpireSeconds - bufferTime, 0) * 1000

    return delay
  }

  private isExpired(token: string): boolean {
    const delay = this.nextRefreshTime(token)

    if (!isFinite(delay)) {
      return false
    }

    return delay < 0
  }
}

const SINGLETON = new TokenManager()

export const requestJWT = (
  url: string,
  username: string,
  password: string,
  manager: TokenManager | false = SINGLETON,
  options: {
    notifyOnExpiry?: () => void
    retry?: AsyncRetry.Options
  } = {},
): Promise<string> => {
  if (manager) {
    const hit = manager.get(url, username, password)

    if (hit) {
      return Promise.resolve(hit)
    }
  }

  return retry(async () => {
    const res = await fetch(url, {
      method: "post",
      body: JSON.stringify({
        auth: { username, password },
      }),
      headers: { "Content-Type": "application/json" },
    })

    if (200 !== res.status) {
      throw new Error(`Error: ${res.status}`)
    }

    return res.text()
  }, options.retry)
    .then(token => {
      if (token === "") {
        return Promise.reject(new Error("Empty token"))
      }

      if (manager) {
        manager.set(url, username, password, token, options.notifyOnExpiry)
      }

      return token
    })
    .catch(e => {
      if (manager) {
        manager.remove(url, username, password)
      }

      return Promise.reject(e)
    })
}

export default SINGLETON
