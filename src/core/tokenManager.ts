import fetch from "node-fetch"
import jwt from "jsonwebtoken"
import retry from "async-retry"
import AsyncRetry from "async-retry"

function getSecondsTilJwtExpires(exp: number): number {
  return Math.floor((exp * 1000 - Date.now()) / 1000)
}

type ThreeLevelCache = {
  [url: string]: {
    [username: string]: {
      [password: string]: string
    }
  }
}

export class TokenManager {
  private cache: ThreeLevelCache = {}

  constructor(
    private tokenRefetchBufferTimeSeconds = 5 * 60, // 5 Minutes
  ) {}

  clear(): void {
    this.cache = {}
  }

  get(url: string, username: string, password: string): string | undefined {
    if (
      !this.cache[url] ||
      !this.cache[url][username] ||
      !this.cache[url][username][password]
    ) {
      return
    }

    return this.cache[url][username][password]
  }

  set(
    url: string,
    username: string,
    password: string,
    token: string,
    notifyOnExpiry?: () => void,
  ): void {
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

  remove(url: string, username: string, password: string): void {
    if (!this.cache[url] || !this.cache[url][username]) {
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

    return isFinite(delay) && delay < 0
  }
}

const SINGLETON = new TokenManager()

export const requestJWT = async (
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
      return hit
    }
  }

  const executeFetch = async () => {
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
  }

  try {
    const token = await retry(executeFetch, options.retry)

    if (token === "") {
      return Promise.reject(new Error("Empty token"))
    }

    if (manager) {
      manager.set(url, username, password, token, options.notifyOnExpiry)
    }

    return token
  } catch (e) {
    if (manager) {
      manager.remove(url, username, password)
    }

    return Promise.reject(e)
  }
}

export default SINGLETON
