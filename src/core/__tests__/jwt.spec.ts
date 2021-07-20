import { rest } from "msw"
import { sign } from "jsonwebtoken"
import Singleton, { requestJWT } from "../jwtManager"
import { JWT } from "../jwt"
import { Confidant } from "../task"
import { timeout } from "../../util/timeout"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require("../../__tests__/server")

describe("JWT", () => {
  beforeEach(() => {
    Singleton.clear()
  })

  it("should allow implementations to requestJWT", async () => {
    const URL = "http://test/get-jwt"

    const jwt = sign({ foo: "bar" }, "secret")

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    const result = await requestJWT(URL, "username", "password")

    expect(result).toBe(jwt)
  })

  it("should error when requestJWT returns an empty string", async () => {
    const URL = "http://test/get-jwt"

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(""))
      }),
    )

    expect.assertions(1)

    await expect(async () => {
      await requestJWT(URL, "username", "password")
    }).rejects.toBeInstanceOf(Error)
  })

  it("should allow custom implementation of fetch", async () => {
    const URL = "http://test/get-jwt"

    const jwt = sign({ hello: "world" }, "secret", { expiresIn: "100ms" })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    class TestJWT extends JWT<any> {
      fetchJWT(): Promise<string> {
        return requestJWT(URL, "username", "password")
      }
    }

    const task = new TestJWT(null as any)
    const result = await task.runInitialize()
    expect(result).toMatchObject({ hello: "world" })
  })

  it("should pull token from cache if already fetched", async () => {
    jest.useRealTimers()

    const URL = "http://test/get-jwt"

    const jwt = sign({ hello: "world" }, "secret", { expiresIn: "10m" })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        try {
          await timeout(1000)
        } finally {
          return res(ctx.status(200), ctx.text(jwt))
        }
      }),
    )

    class TestJWT extends JWT<any> {
      fetchJWT(): Promise<string> {
        return requestJWT(URL, "username", "password", this.manager)
      }
    }

    const onInit = jest.fn()
    const onResolve = jest.fn()

    const taskA = new TestJWT(null as any)

    const taskB = new TestJWT(null as any)
    taskB.onInitialize(onInit)

    expect(onInit).not.toHaveBeenCalled()

    await taskA.runInitialize()

    expect(onInit).not.toHaveBeenCalled()

    const promise = taskB.runInitialize()

    void promise.then(() => onResolve())

    try {
      await timeout(1)
    } catch (e) {}

    expect(onResolve).toHaveBeenCalled()
    expect(onInit).toHaveBeenCalled()

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
      fetchJWT(): Promise<string> {
        return requestJWT(URL, "username", "password")
      }

      validateJWTData(decoded: Record<string, unknown>): TestJWTData {
        return {
          ...decoded,
          num: parseInt((decoded.num as string) ?? "0", 10),
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

    class TestJWT extends JWT<any> {
      fetchJWT(): Promise<string> {
        const notifyOnExpiry = () => {
          this.manager.remove(URL, "username", "password")

          void this.fetchJWTAndDecode().then(jwtData => {
            this.set(jwtData)
          })
        }

        return requestJWT(URL, "username", "password", this.manager, {
          notifyOnExpiry,
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
      constructor(manager: Confidant<TestJWTData, Record<string, any>>) {
        super(manager)
      }

      fetchJWT(): Promise<string> {
        return requestJWT(URL, "username", "password", this.manager, {
          retry: {
            randomize: false,
            minTimeout: 100,
            onRetry,
          },
        })
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

    class TestJWT extends JWT<any> {
      fetchJWT(): Promise<string> {
        return requestJWT(URL, "username", "password", this.manager, {
          retry: {
            randomize: false,
            retries: 3,
            minTimeout: 100,
            onRetry,
          },
        })
      }
    }

    const task = new TestJWT(null as any)
    const promiseA = task.runInitialize()

    await expect(() => promiseA).rejects.toBeInstanceOf(Error)
    expect(onRetry).toHaveBeenCalledTimes(3)

    jest.useFakeTimers()
  })
})
