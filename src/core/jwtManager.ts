import fetch from "node-fetch"
import { decode } from "jsonwebtoken"
import retry from "async-retry"
import AsyncRetry from "async-retry"
import ms from "ms"

type ThreeLevelCache = {
  [url: string]: {
    [username: string]: {
      [password: string]: {
        jwt: string
        timeoutId?: NodeJS.Timeout
      }
    }
  }
}

export class JWTManager {
  public cache: ThreeLevelCache = {}
  private refetchBufferTimeMs: number

  /**
   * https://github.com/vercel/ms
   * ms('2 days')  // 172800000
   * ms('1d')      // 86400000
   * ms('10h')     // 36000000
   * ms('2.5 hrs') // 9000000
   * ms('2h')      // 7200000
   * ms('1m')      // 60000
   * ms('5s')      // 5000
   * ms('1y')      // 31557600000
   * ms('100')     // 100
   * ms('-3 days') // -259200000
   * ms('-1h')     // -3600000
   * ms('-200')    // -200
   **/
  constructor(refetchBufferTimeMs = "5m") {
    this.refetchBufferTimeMs = ms(refetchBufferTimeMs)
    this.clear()
  }

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

    return this.cache[url][username][password].jwt
  }

  set(
    url: string,
    username: string,
    password: string,
    jwt: string,
    notifyOnExpiry?: () => void,
  ): void {
    if (this.isExpired(jwt)) {
      // console.warn("Do not add expired JWTs")

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

    if (this.cache[url][username][password]) {
      if (this.cache[url][username][password].timeoutId) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        clearTimeout(this.cache[url][username][password].timeoutId!)
        this.cache[url][username][password].timeoutId = undefined
      }
    }

    this.cache[url][username][password] = { jwt }

    if (notifyOnExpiry) {
      const delay = this.nextRefreshTime(jwt)

      const timeoutId = setTimeout(() => {
        notifyOnExpiry()
      }, delay)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.cache[url][username][password]!.timeoutId = timeoutId
    }
  }

  remove(url: string, username: string, password: string): void {
    if (!this.cache[url] || !this.cache[url][username]) {
      return
    }

    if (this.cache[url][username][password].timeoutId) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      clearTimeout(this.cache[url][username][password].timeoutId!)
      this.cache[url][username][password].timeoutId = undefined
    }

    delete this.cache[url][username][password]
  }

  private nextRefreshTime(data: string): number {
    const jwtData = decode(data) as unknown as { exp?: number }

    if (!jwtData.exp) {
      return Infinity
    }

    const now = Date.now()
    const timeTilExpireSeconds = jwtData.exp * 1000 - now
    const bufferTime = this.refetchBufferTimeMs ?? 0
    return timeTilExpireSeconds - bufferTime
  }

  public isExpired(jwt: string): boolean {
    const delay = this.nextRefreshTime(jwt)

    return isFinite(delay) && delay <= 0
  }
}

const SINGLETON = new JWTManager()

export const requestJWT = async (
  url: string,
  username: string,
  password: string,
  manager: JWTManager | false = SINGLETON,
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
    const jwt = await retry(executeFetch, options.retry)

    if (jwt === "") {
      return Promise.reject(new Error("Empty JWT"))
    }

    if (manager) {
      manager.set(url, username, password, jwt, options.notifyOnExpiry)
    }

    return jwt
  } catch (e) {
    if (manager) {
      manager.remove(url, username, password)
    }

    return Promise.reject(e)
  }
}

export default SINGLETON
