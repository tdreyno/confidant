import { decode } from "jsonwebtoken"
import ms from "ms"

type KeyCache = {
  [key: string]: {
    jwt: string
    timeoutId?: NodeJS.Timeout | number
  }
}

export class JWTManager {
  public cache: KeyCache = {}
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

  get(key: string): string | undefined {
    if (!this.cache[key]) {
      return
    }

    return this.cache[key].jwt
  }

  set(
    key: string,
    jwt: string,
    notifyOnExpiry: () => void = () => void 0,
  ): void {
    if (this.isExpired(jwt)) {
      // console.warn("Do not add expired JWTs")

      notifyOnExpiry()

      return
    }

    if (this.cache[key] && this.cache[key].timeoutId) {
      clearTimeout(this.cache[key].timeoutId as any)
      this.cache[key].timeoutId = undefined
    }

    this.cache[key] = { jwt }

    const delay = this.nextRefreshTime(jwt)

    if (isFinite(delay)) {
      const timeoutId = setTimeout(() => {
        notifyOnExpiry()
      }, delay)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.cache[key]!.timeoutId = timeoutId
    }
  }

  remove(key: string): void {
    if (!this.cache[key]) {
      return
    }

    if (this.cache[key].timeoutId) {
      clearTimeout(this.cache[key].timeoutId as any)
      this.cache[key].timeoutId = undefined
    }

    delete this.cache[key]
  }

  private nextRefreshTime(data: string): number {
    const jwtData = decode(data) as unknown as { exp?: number }

    if (!jwtData.exp) {
      return Infinity
    }

    const now = Date.now()
    const timeTilExpireSeconds = jwtData.exp * 1000 - now
    return timeTilExpireSeconds - this.refetchBufferTimeMs
  }

  public isExpired(jwt: string): boolean {
    const delay = this.nextRefreshTime(jwt)

    return isFinite(delay) && delay <= 0
  }
}

const SINGLETON = new JWTManager()

export default SINGLETON
