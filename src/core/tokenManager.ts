import ms from "ms"
import { createLogger, Logger } from "winston"
import { formatDistanceToNow } from "date-fns"
import { shorten } from "../util/shorten"
import { nextRefreshTime } from "../util/jwtExpiry"

type KeyCache = {
  [key: string]: {
    jwt: string
    timeoutId?: NodeJS.Timeout | number
  }
}

export class TokenManager {
  cache: KeyCache = {}
  logger_: Logger
  refetchBufferTimeMs_: number

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
    this.refetchBufferTimeMs_ = ms(refetchBufferTimeMs)

    this.logger_ = createLogger({
      silent: true,
    })

    this.clear()
  }

  setLogger(logger: Logger) {
    this.logger_ = logger
  }

  clear(): void {
    Object.keys(this.cache).forEach(key => this.remove(key))
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
    expiresAt: (
      token: string,
      refetchBufferTimeMs?: number,
    ) => number = nextRefreshTime,
  ): void {
    const doNotify = () => {
      const result = notifyOnExpiry()

      // If a true was returned, stop the expiry checks
      if (result) {
        clearTimeout(this.cache[key].timeoutId as any)
        this.cache[key].timeoutId = undefined
      }
    }

    const delay = expiresAt(jwt, this.refetchBufferTimeMs_)

    const isExpired = isFinite(delay) && delay <= 0

    if (isExpired) {
      this.logger_.debug(
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

    this.logger_.debug(`Set JWT: ${shorten(jwt)}`)

    if (isFinite(delay)) {
      this.logger_.debug(
        `${shorten(jwt)}: nextRefreshTime is ${formatDistanceToNow(
          Date.now() + delay,
        )}`,
      )

      const timeoutId = setTimeout(() => {
        if (!this.cache[key]) {
          return
        }

        this.logger_.debug(`${shorten(jwt)}: expired`)
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
}

// Backwards compat
export const JWTManager = TokenManager
