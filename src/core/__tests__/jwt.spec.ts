import { rest } from "msw"
import jwt from "jsonwebtoken"
import Singleton, { requestJWT } from "../tokenManager"
import { JWT } from "../jwt"
import { Confidant } from "../task"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require("../../__tests__/server")

describe("Token", () => {
  beforeEach(() => {
    Singleton.clear()
  })

  it("should allow implementations to requestJWT", async () => {
    const URL = "http://test/get-token"

    const token = jwt.sign({ foo: "bar" }, "secret")

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    const result = await requestJWT(URL, "username", "password")

    expect(result).toBe(token)
  })

  it("should error when requestJWT returns an empty string", async () => {
    const URL = "http://test/get-token"

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
    const URL = "http://test/get-token"

    const token = jwt.sign({ hello: "world" }, "secret", { expiresIn: 100 })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    class TestToken extends JWT<any> {
      fetchToken(): Promise<string> {
        return requestJWT(URL, "username", "password")
      }
    }

    const task = new TestToken(null as any)
    const result = await task.runInitialize()
    expect(result).toMatchObject({ hello: "world" })
  })

  it("should allow custom decoding of token string", async () => {
    const URL = "http://test/get-token"

    const token = jwt.sign({ num: "1" }, "secret", { expiresIn: 100 })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    type TestTokenData = { exp: number; num: number }
    class TestToken extends JWT<TestTokenData> {
      fetchToken(): Promise<string> {
        return requestJWT(URL, "username", "password")
      }

      validateToken(decoded: Record<string, unknown>): TestTokenData {
        return {
          ...decoded,
          num: parseInt((decoded.num as string) ?? "0", 10),
        } as TestTokenData
      }
    }

    const task = new TestToken(null as any)
    const result = await task.runInitialize()
    expect(result).toMatchObject({ num: 1 })
  })

  it("should update when token expires", async () => {
    const URL = "http://test/get-token"

    const expiresIn = 600

    const getToken = (num: string) => jwt.sign({ num }, "secret", { expiresIn })

    const values = ["1", "2"]

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const value = values.shift()!
        const token = getToken(value)
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    class TestToken extends JWT<any> {
      fetchToken(): Promise<string> {
        const notifyOnExpiry = () => {
          this.manager.remove(URL, "username", "password")

          void this.fetchTokenAndDecode().then(token => {
            this.set(token)
          })
        }

        return requestJWT(URL, "username", "password", this.manager, {
          notifyOnExpiry,
        })
      }
    }

    const task = new TestToken(null as any)
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
    const URL = "http://test/get-token"

    const getToken = (num: number) => jwt.sign({ num }, "secret")

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
          ctx.text(status === 200 ? getToken(5) : "Error"),
        )
      }),
    )

    type TestTokenData = { exp: number; num: string }
    class TestToken extends JWT<TestTokenData> {
      constructor(manager: Confidant<TestTokenData, Record<string, any>>) {
        super(manager)
      }

      fetchToken(): Promise<string> {
        return requestJWT(URL, "username", "password", this.manager, {
          retry: {
            randomize: false,
            minTimeout: 100,
            onRetry,
          },
        })
      }
    }

    const task = new TestToken(null as any)
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
    const URL = "http://test/get-token"

    const onRetry = jest.fn()

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(500), ctx.text("Error"))
      }),
    )

    class TestToken extends JWT<any> {
      fetchToken(): Promise<string> {
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

    const task = new TestToken(null as any)
    const promiseA = task.runInitialize()

    await expect(() => promiseA).rejects.toBeInstanceOf(Error)
    expect(onRetry).toHaveBeenCalledTimes(3)

    jest.useFakeTimers()
  })
})
