import { decode } from "jsonwebtoken"
import ms from "ms"
import winston from "winston"
import { formatDistanceToNow } from "date-fns"
import { shorten } from "../util/shorten"

type KeyCache = {
  [key: string]: {
    jwt: string
    timeoutId?: NodeJS.Timeout | number
  }
}

export class JWTManager {
  public cache: KeyCache = {}
  private logger: winston.Logger
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

    this.logger = winston.createLogger({
      silent: true,
    })

    this.clear()
  }

  setLogger(logger: winston.Logger) {
    this.logger = logger
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
    notifyOnExpiry: () => true | undefined = () => void 0,
  ): void {
    const doNotify = () => {
      const result = notifyOnExpiry()

      // If a true was returned, stop the expiry checks
      if (result) {
        clearTimeout(this.cache[key].timeoutId as any)
        this.cache[key].timeoutId = undefined
      }
    }

    if (this.isExpired(jwt)) {
      this.logger.debug(
        "Tried to set a jwt that is already expired. Calling onExpiry immediately.",
      )

      doNotify()

      return
    }

    if (this.cache[key] && this.cache[key].timeoutId) {
      clearTimeout(this.cache[key].timeoutId as any)
      this.cache[key].timeoutId = undefined
    }

    this.cache[key] = { jwt }

    const delay = this.nextRefreshTime(jwt)
    if (isFinite(delay)) {
      this.logger.debug(
        `${shorten(jwt)}: nextRefreshTime is ${formatDistanceToNow(
          Date.now() + delay,
        )}`,
      )

      const timeoutId = setTimeout(() => {
        this.logger.debug(`${shorten(jwt)}: expired`)
        doNotify()
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

    const expiryMs = jwtData.exp * 1000
    const now = Date.now()
    const timeTilExpireMs = expiryMs - now
    return timeTilExpireMs - this.refetchBufferTimeMs
  }

  public isExpired(jwt: string): boolean {
    const delay = this.nextRefreshTime(jwt)

    return isFinite(delay) && delay <= 0
  }
}

const SINGLETON = new JWTManager()

export default SINGLETON
