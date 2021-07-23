import { rest } from "msw"
import { sign } from "jsonwebtoken"
import fetch from "node-fetch"
import Singleton from "../jwtManager"
import { JWT } from "../jwt"
import { Confidant } from "../task"
import { timeout } from "../../util/timeout"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require("../../__tests__/server")

describe("JWT", () => {
  beforeEach(() => {
    Singleton.clear()
  })

  it("should allow custom implementation of fetch", async () => {
    const URL = "http://test/get-jwt"

    const jwt = sign({ hello: "world" }, "secret", { expiresIn: "100ms" })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    type TestJWTData = any
    class TestJWT extends JWT<any> {
      constructor(confidant: Confidant<TestJWTData, Record<string, any>>) {
        super(confidant, "test-cache-key")
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })
        return res.text()
      }
    }

    const task = new TestJWT(null as any)
    const result = await task.runInitialize()
    // const result = 5
    expect(result).toMatchObject({ hello: "world" })
  })

  it.only("should pull token from cache if already fetched", async () => {
    jest.useRealTimers()

    const URL = "http://test/get-jwt"

    const jwt = sign({ hello: "world" }, "secret", { expiresIn: "10m" })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        try {
          await timeout(1000)
        } catch (e) {
        } finally {
          return res(ctx.status(200), ctx.text(jwt))
        }
      }),
    )

    type TestJWTData = any
    class TestJWT extends JWT<any> {
      constructor(
        confidant: Confidant<TestJWTData, Record<string, any>>,
        cacheKey: string,
      ) {
        super(confidant, cacheKey)
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        return res.text()
      }
    }

    const onInitB = jest.fn()
    const onResolve = jest.fn()

    const taskA = new TestJWT(null as any, "key1")

    const taskB = new TestJWT(null as any, "key1")
    taskB.onInitialize(onInitB)

    expect(onInitB).not.toHaveBeenCalled()

    await taskA.runInitialize()

    expect(onInitB).not.toHaveBeenCalled()

    const promise = taskB.runInitialize()

    void promise.then(() => onResolve())

    try {
      await timeout(1)
    } catch (e) {}

    expect(onResolve).toHaveBeenCalled()
    expect(onInitB).toHaveBeenCalled()

    jest.useFakeTimers()
  })

  it("should allow custom decoding of jwt string", async () => {
    const URL = "http://test/get-jwt"

    const jwt = sign({ num: "1" }, "secret", { expiresIn: "100ms" })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    type TestJWTData = { exp: number; num: number }
    class TestJWT extends JWT<TestJWTData> {
      constructor(confidant: Confidant<TestJWTData, Record<string, any>>) {
        super(confidant, "test-cache-key")
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })
        return await res.text()
      }

      validateJWTData(decoded: Record<string, unknown>): TestJWTData {
        return {
          ...decoded,
          num: parseInt((decoded.num as string) || "0", 10),
        } as TestJWTData
      }
    }

    const task = new TestJWT(null as any)
    const result = await task.runInitialize()
    expect(result).toMatchObject({ num: 1 })
  })

  it("should update when jwt expires", async () => {
    const URL = "http://test/get-jwt"

    const expiresIn = 600

    const getJWT = (num: string) => sign({ num }, "secret", { expiresIn })

    const values = ["1", "2"]

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const value = values.shift()!
        const jwt = getJWT(value)
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    type TestJWTData = any
    class TestJWT extends JWT<any> {
      constructor(confidant: Confidant<TestJWTData, Record<string, any>>) {
        super(confidant, "test-key")
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })
        return await res.text()
      }

      notifyOnExpiry() {
        this.manager.remove("test-key")

        void this.fetchJWTAndDecode().then(jwtData => {
          this.set(jwtData)
        })
      }
    }

    const task = new TestJWT(null as any)
    const resultA = await task.runInitialize()

    expect(resultA).toMatchObject({ num: "1" })

    const onUpdate = jest.fn()

    const promise = new Promise(resolve => {
      task.onUpdate(value => {
        resolve(value)
        onUpdate(value)
      })
    })

    jest.advanceTimersByTime(expiresIn * 1000)

    const resultB2 = await promise

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(resultB2).toMatchObject({ num: "2" })

    const resultB = await task.get()

    expect(resultB).toMatchObject({ num: "2" })
  })

  it("should retry failed requests", async () => {
    jest.useRealTimers()
    const URL = "http://test/get-jwt"

    const getJWT = (num: number) => sign({ num }, "secret")

    const values = [500, 400, 200]

    const on500 = jest.fn()
    const on400 = jest.fn()
    const on200 = jest.fn()
    const onRetry = jest.fn()

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const status = values.shift()!

        switch (status) {
          case 500:
            on500()
            break

          case 400:
            on400()
            break

          case 200:
            on200()
            break
        }

        return res(
          ctx.status(status),
          ctx.text(status === 200 ? getJWT(5) : "Error"),
        )
      }),
    )

    type TestJWTData = { exp: number; num: string }
    class TestJWT extends JWT<TestJWTData> {
      constructor(confidant: Confidant<TestJWTData, Record<string, any>>) {
        super(confidant, "test-cache-key", undefined, {
          randomize: false,
          minTimeout: 100,
          onRetry,
        })
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        if (res.status !== 200) {
          throw new Error("Error")
        }

        return res.text()
      }
    }

    const task = new TestJWT(null as any)
    const promiseA = task.runInitialize()

    const resultA = await promiseA
    expect(resultA).toMatchObject({ num: 5 })

    expect(on500).toHaveBeenCalledTimes(1)
    expect(on400).toHaveBeenCalledTimes(1)
    expect(on200).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledTimes(2)

    jest.useFakeTimers()
  })

  it("should retry failed requests but eventually fail", async () => {
    jest.useRealTimers()
    const URL = "http://test/get-jwt"

    const onRetry = jest.fn()

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(500), ctx.text("Error"))
      }),
    )

    type TestJWTData = any
    class TestJWT extends JWT<any> {
      constructor(confidant: Confidant<TestJWTData, Record<string, any>>) {
        super(confidant, "test-cache-key", undefined, {
          randomize: false,
          retries: 3,
          minTimeout: 100,
          onRetry,
        })
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        if (res.status !== 200) {
          throw new Error("Error")
        }

        return await res.text()
      }
    }

    const task = new TestJWT(null as any)
    const promiseA = task.runInitialize()

    await expect(() => promiseA).rejects.toBeInstanceOf(Error)
    expect(onRetry).toHaveBeenCalledTimes(3)

    jest.useFakeTimers()
  })
})
